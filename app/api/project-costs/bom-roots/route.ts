import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const ADMIN_ROLES=new Set(["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"]);

async function ensureTable(db:D1){
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_cost_bom_roots (
    company_id TEXT NOT NULL,project_id TEXT NOT NULL,root_part_id TEXT NOT NULL,owner_user_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,created_by TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
    PRIMARY KEY(project_id,root_part_id)
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS project_cost_bom_roots_project_idx ON project_cost_bom_roots(project_id,sort_order)").run();
}
async function requireAccess(db:D1,context:any,projectId:string){
  const project=await db.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();if(!project)throw new Error("NOT_FOUND");
  if(context.systemRoles.some((role:string)=>ADMIN_ROLES.has(role)))return;
  const member=await db.prepare("SELECT user_id FROM project_members WHERE project_id=? AND user_id=?").bind(projectId,context.userId).first();if(!member)throw new Error("FORBIDDEN");
}
async function descendants(db:D1,companyId:string,rootId:string){
  const links=(await db.prepare("SELECT parent_part_id AS parentId,child_part_id AS childId FROM product_bom_items WHERE company_id=?").bind(companyId).all()).results??[];
  const byParent=new Map<string,string[]>();for(const row of links as any[]){const arr=byParent.get(row.parentId)||[];arr.push(row.childId);byParent.set(row.parentId,arr)}
  const seen=new Set<string>(),stack=[rootId];while(stack.length){const id=stack.pop()!;for(const child of byParent.get(id)||[]){if(seen.has(child))continue;seen.add(child);stack.push(child)}}return seen;
}

export async function GET(request:Request){
  const db=await runtimeDb();await ensureTable(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const url=new URL(request.url),projectId=String(url.searchParams.get("projectId")||"");if(!projectId)return Response.json({roots:[],candidates:[],members:[]});
  try{await requireAccess(db,context,projectId)}catch(reason){return Response.json({error:reason instanceof Error&&reason.message==="FORBIDDEN"?"프로젝트 접근 권한이 없습니다.":"프로젝트를 찾을 수 없습니다."},{status:reason instanceof Error&&reason.message==="FORBIDDEN"?403:404})}
  const [rootRows,partsRows,linksRows,memberRows]=await Promise.all([
    db.prepare(`SELECT r.root_part_id AS rootPartId,r.owner_user_id AS ownerUserId,r.sort_order AS sortOrder,r.enabled,
      p.part_number AS partNumber,p.name,p.part_type AS partType,p.spec,p.unit,u.name AS ownerName
      FROM project_cost_bom_roots r JOIN product_parts p ON p.id=r.root_part_id LEFT JOIN users u ON u.id=r.owner_user_id
      WHERE r.company_id=? AND r.project_id=? AND r.enabled=1 ORDER BY r.sort_order,p.part_number`).bind(context.companyId,projectId).all(),
    db.prepare("SELECT id,part_number AS partNumber,name,part_type AS partType,spec,unit FROM product_parts WHERE company_id=? AND status='active' ORDER BY part_number").bind(context.companyId).all(),
    db.prepare("SELECT parent_part_id AS parentId,child_part_id AS childId FROM product_bom_items WHERE company_id=?").bind(context.companyId).all(),
    db.prepare(`SELECT pm.user_id AS id,u.name,u.email FROM project_members pm LEFT JOIN users u ON u.id=pm.user_id WHERE pm.project_id=? ORDER BY u.name,u.email`).bind(projectId).all(),
  ]);
  const childCount=new Map<string,number>();for(const row of linksRows.results??[])childCount.set((row as any).parentId,(childCount.get((row as any).parentId)||0)+1);
  const selected=new Set((rootRows.results??[]).map((row:any)=>row.rootPartId));
  const candidates=(partsRows.results??[]).map((row:any)=>({...row,childCount:childCount.get(row.id)||0,selected:selected.has(row.id)}));
  return Response.json({roots:rootRows.results??[],candidates,members:memberRows.results??[]});
}

export async function POST(request:Request){
  const db=await runtimeDb();await ensureTable(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as any,projectId=String(input.projectId||""),action=String(input.action||"");if(!projectId)return Response.json({error:"프로젝트를 선택해 주세요."},{status:400});
  try{await requireAccess(db,context,projectId)}catch(reason){return Response.json({error:"프로젝트 접근 권한이 없습니다."},{status:403})}
  const t=Math.floor(Date.now()/1000);
  if(action==="add"){
    const rootId=String(input.rootPartId||"");const part=await db.prepare("SELECT id,part_number AS partNumber,name FROM product_parts WHERE id=? AND company_id=? AND status='active'").bind(rootId,context.companyId).first() as any;if(!part)return Response.json({error:"추가할 PART/BOM을 찾을 수 없습니다."},{status:404});
    const current=(await db.prepare("SELECT root_part_id AS rootId FROM project_cost_bom_roots WHERE company_id=? AND project_id=? AND enabled=1").bind(context.companyId,projectId).all()).results??[];
    for(const row of current as any[]){const existingDesc=await descendants(db,context.companyId,row.rootId);if(existingDesc.has(rootId))return Response.json({error:`${part.partNumber}은(는) 이미 등록된 Root BOM의 하위에 포함되어 있어 중복 집계될 수 있습니다.`},{status:409});const newDesc=await descendants(db,context.companyId,rootId);if(newDesc.has(row.rootId))return Response.json({error:"선택한 BOM 안에 이미 등록된 Root BOM이 포함되어 있습니다. 기존 Root를 먼저 정리해 주세요."},{status:409})}
    const max=await db.prepare("SELECT COALESCE(MAX(sort_order),0) AS n FROM project_cost_bom_roots WHERE company_id=? AND project_id=? AND enabled=1").bind(context.companyId,projectId).first() as any;
    await db.prepare(`INSERT INTO project_cost_bom_roots (company_id,project_id,root_part_id,owner_user_id,sort_order,enabled,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,1,?,?,?) ON CONFLICT(project_id,root_part_id) DO UPDATE SET enabled=1,owner_user_id=excluded.owner_user_id,sort_order=excluded.sort_order,updated_at=excluded.updated_at`)
      .bind(context.companyId,projectId,rootId,String(input.ownerUserId||"")||null,Number(max?.n||0)+10,context.userId,t,t).run();return Response.json({ok:true});
  }
  if(action==="remove"){
    const rootId=String(input.rootPartId||"");await db.prepare("UPDATE project_cost_bom_roots SET enabled=0,updated_at=? WHERE company_id=? AND project_id=? AND root_part_id=?").bind(t,context.companyId,projectId,rootId).run();return Response.json({ok:true});
  }
  if(action==="owner"){
    const rootId=String(input.rootPartId||""),owner=String(input.ownerUserId||"")||null;await db.prepare("UPDATE project_cost_bom_roots SET owner_user_id=?,updated_at=? WHERE company_id=? AND project_id=? AND root_part_id=?").bind(owner,t,context.companyId,projectId,rootId).run();return Response.json({ok:true});
  }
  if(action==="reorder"){
    const ids=Array.isArray(input.rootPartIds)?input.rootPartIds.map(String):[];let order=10;for(const id of ids){await db.prepare("UPDATE project_cost_bom_roots SET sort_order=?,updated_at=? WHERE company_id=? AND project_id=? AND root_part_id=?").bind(order,t,context.companyId,projectId,id).run();order+=10}return Response.json({ok:true});
  }
  return Response.json({error:"지원하지 않는 작업입니다."},{status:400});
}
