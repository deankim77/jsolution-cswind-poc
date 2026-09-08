import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
import { ensureProjectDataFoundation, type RuntimeD1 } from "../../../db/project-data-foundation";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type WbsTemplateItem = {
  id: string;
  name: string;
  durationDays: number;
  predecessor?: string;
  role: string;
  deliverable?: string;
  deliverableCategory?: string;
  deliverableRequired?: boolean;
  deliverableDocumentKind?: "document"|"drawing";
  completionCriteria: string;
};

type TemplateDefinition = {
  description?: string;
  roles: string[];
  wbs: WbsTemplateItem[];
};

type TemplateInput = {
  id?: string;
  code?: string;
  name?: string;
  version?: string;
  status?: "draft" | "active" | "inactive";
  mode?: "create" | "update" | "copy" | "new-version" | "status";
  definition?: TemplateDefinition;
};

// D1 statements are supplied by the Cloudflare runtime and intentionally kept opaque here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1 = RuntimeD1;

function parseDefinition(value: unknown): Partial<TemplateDefinition> & {wbsCount?:number} {
  if (typeof value !== "string") return (value ?? {}) as Partial<TemplateDefinition> & {wbsCount?:number};
  try { return JSON.parse(value) as Partial<TemplateDefinition> & {wbsCount?:number}; }
  catch { return {description:"이전 버전 데이터",roles:[],wbs:[]}; }
}

async function runtimeDb():Promise<D1> {
  return getLegacyDbCompat() as D1;
}

async function ensureFoundation(db:D1) {
  await ensureProjectDataFoundation(db);
}

export async function GET(request:Request) {
  const db = await runtimeDb();
  await ensureFoundation(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const isAdmin=context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));
  const result = await db.prepare(`
    SELECT t.id, t.code, t.name, t.status, tv.id AS versionId, tv.version,
           tv.definition, t.updated_at AS updatedAt, tv.created_by AS createdBy,
           u.name AS createdByName
      FROM templates t
      JOIN template_versions tv ON tv.id = (
        SELECT tv2.id FROM template_versions tv2
         WHERE tv2.template_id = t.id
         ORDER BY tv2.updated_at DESC, tv2.created_at DESC, tv2.id DESC LIMIT 1
      )
      LEFT JOIN users u ON u.id = tv.created_by
     WHERE t.company_id = ? ORDER BY CASE WHEN t.status = 'inactive' THEN 1 ELSE 0 END ASC, t.updated_at DESC, t.name ASC
  `).bind(context.companyId).all();
  const templates = (result.results as Array<Record<string,unknown>>).map(row => {
    const raw = parseDefinition(row.definition);
    const definition:TemplateDefinition = {
      description:raw.description || "",
      roles:raw.roles || [],
      wbs:raw.wbs || [],
    };
    return {...row, canDelete:isAdmin || row.createdBy === context.userId, definition};
  });
  return Response.json({templates});
}

export async function DELETE(request:Request) {
  const db=await runtimeDb();
  await ensureFoundation(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const isAdmin=context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return Response.json({error:"삭제할 템플릿을 선택해 주세요."},{status:400});
  const template=await db.prepare(`SELECT t.id,(SELECT created_by FROM template_versions WHERE template_id=t.id ORDER BY created_at ASC LIMIT 1) AS createdBy FROM templates t WHERE t.id=? AND t.company_id=?`).bind(id,context.companyId).first<{id:string;createdBy:string}>();
  if(!template)return Response.json({error:"템플릿을 찾을 수 없습니다."},{status:404});
  if(!isAdmin&&template.createdBy!==context.userId)return Response.json({error:"자신이 만든 템플릿만 삭제할 수 있습니다."},{status:403});
  const projectUse=await db.prepare("SELECT id FROM projects WHERE template_version_id IN (SELECT id FROM template_versions WHERE template_id=?) LIMIT 1").bind(id).first();
  if(projectUse)return Response.json({error:"프로젝트에서 사용 중인 템플릿은 삭제할 수 없습니다. 사용 중지로 전환해 주세요."},{status:409});
  await db.batch([
    db.prepare("DELETE FROM template_versions WHERE template_id=?").bind(id),
    db.prepare("DELETE FROM templates WHERE id=? AND company_id=?").bind(id,context.companyId),
  ]);
  return Response.json({ok:true});
}

export async function POST(request:Request) {
  const db = await runtimeDb();
  await ensureFoundation(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const input = await request.json<TemplateInput>();
  if (!input.name?.trim() || !input.code?.trim() || !input.version?.trim() || !input.definition?.wbs?.length) {
    return Response.json({error:"템플릿명, 코드, 버전과 WBS를 입력해 주세요."},{status:400});
  }
  const duplicate = await db.prepare("SELECT id FROM templates WHERE company_id = ? AND code = ?").bind(context.companyId,input.code.trim()).first();
  if (duplicate) return Response.json({error:"이미 사용 중인 템플릿 코드입니다."},{status:409});
  const now = Math.floor(Date.now()/1000);
  const templateId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const status = input.status ?? "draft";
  await db.batch([
    db.prepare("INSERT INTO templates (id,company_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(templateId,context.companyId,input.code.trim(),input.name.trim(),status,now,now),
    db.prepare("INSERT INTO template_versions (id,template_id,version,definition,published_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(versionId,templateId,input.version.trim(),JSON.stringify(input.definition),status === "active" ? now : null,context.userId,now,now),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'TEMPLATE_CREATED','TEMPLATE',?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,templateId,JSON.stringify({version:input.version}),now),
  ]);
  return Response.json({id:templateId,versionId},{status:201});
}

export async function PATCH(request:Request) {
  const db = await runtimeDb();
  await ensureFoundation(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const input = await request.json<TemplateInput>();
  if (!input.id) return Response.json({error:"템플릿을 선택해 주세요."},{status:400});
  const existing = await db.prepare("SELECT id,code,name,status FROM templates WHERE id = ? AND company_id = ?").bind(input.id,context.companyId).first<{id:string;code:string;name:string;status:string}>();
  if (!existing) return Response.json({error:"템플릿을 찾을 수 없습니다."},{status:404});
  const now = Math.floor(Date.now()/1000);
  if (input.mode === "status") {
    await db.prepare("UPDATE templates SET status = ?, updated_at = ? WHERE id = ?").bind(input.status ?? "inactive",now,input.id).run();
    return Response.json({ok:true});
  }
  if (!input.definition?.wbs?.length || !input.version?.trim()) return Response.json({error:"버전과 WBS를 입력해 주세요."},{status:400});
  if (input.mode === "copy") {
    const copyCode = `${existing.code}-COPY-${String(now).slice(-4)}`;
    const copyId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO templates (id,company_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?, 'draft',?,?)").bind(copyId,context.companyId,copyCode,`${existing.name} 복사본`,now,now),
      db.prepare("INSERT INTO template_versions (id,template_id,version,definition,published_at,created_by,created_at,updated_at) VALUES (?,?,?,?,NULL,?,?,?)").bind(versionId,copyId,"v1.0",JSON.stringify(input.definition),context.userId,now,now),
    ]);
    return Response.json({id:copyId,versionId});
  }
  if (input.mode === "update") {
    const currentVersion = await db.prepare("SELECT id FROM template_versions WHERE template_id = ? AND version = ?").bind(input.id,input.version.trim()).first<{id:string}>();
    if (!currentVersion) return Response.json({error:"수정할 템플릿 버전을 찾을 수 없습니다."},{status:404});
    await db.batch([
      db.prepare("UPDATE templates SET name = ?, status = ?, updated_at = ? WHERE id = ?").bind(input.name?.trim() || existing.name,input.status ?? existing.status,now,input.id),
      db.prepare("UPDATE template_versions SET definition = ?, published_at = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(input.definition),input.status === "active" ? now : null,now,currentVersion.id),
      db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'TEMPLATE_VERSION_UPDATED','TEMPLATE',?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,input.id,JSON.stringify({version:input.version}),now),
    ]);
    return Response.json({id:input.id,versionId:currentVersion.id});
  }
  const versionId = crypto.randomUUID();
  const versionExists = await db.prepare("SELECT id FROM template_versions WHERE template_id = ? AND version = ?").bind(input.id,input.version.trim()).first();
  if (versionExists) return Response.json({error:"이미 존재하는 버전입니다. 새 버전 번호를 입력해 주세요."},{status:409});
  await db.batch([
    db.prepare("UPDATE templates SET name = ?, status = ?, updated_at = ? WHERE id = ?").bind(input.name?.trim() || existing.name,input.status ?? existing.status,now,input.id),
    db.prepare("INSERT INTO template_versions (id,template_id,version,definition,published_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(versionId,input.id,input.version.trim(),JSON.stringify(input.definition),input.status === "active" ? now : null,context.userId,now,now),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'TEMPLATE_VERSION_CREATED','TEMPLATE',?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,input.id,JSON.stringify({version:input.version}),now),
  ]);
  return Response.json({id:input.id,versionId});
}
