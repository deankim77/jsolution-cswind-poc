import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
import { ensureProjectDataFoundation, type RuntimeD1 } from "../../../db/project-data-foundation";
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../db/request-context";

type ProjectInput = {
  id?: string;
  name?: string;
  code?: string;
  customerName?: string;
  partnerId?: string;
  projectTypeId?: string;
  startDate?: string;
  endDate?: string;
  templateVersionId?: string;
  creationMode?: "template" | "blank";
  description?: string;
  referenceCode?: string;
  visibility?: "company" | "restricted";
  sharedOrganizationIds?: string[];
  members?: Array<{ userId: string; projectRole: string }>;
};
type TemplateDefinition={roles?:string[];wbs?:Array<{id?:string;parentId?:string;level?:number;kind?:string;name?:string;taskType?:string;durationDays?:number;predecessor?:string;role?:string;completionActor?:string;completionCriteria?:string;deliverable?:string;deliverableCategory?:string;deliverableRequired?:boolean;deliverableDocumentKind?:"document"|"drawing";deliverables?:Array<{name:string;type?:string;required?:boolean;documentKind?:"document"|"drawing"}>}>};
type ProjectListCache={expiresAt:number;data:{projects:unknown[]}};

// D1 statements are supplied by the Cloudflare runtime and intentionally kept opaque here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1 = RuntimeD1;
const PROJECT_LIST_CACHE_MS=5_000;
const SYSTEM_LIBRARY_CODE="SYS-DOCUMENT-LIBRARY";
const projectListCache=new Map<string,ProjectListCache>();
const projectListInflight=new Map<string,Promise<{projects:unknown[]}>>();
const masterLinksReadyByDb=new WeakMap<object,Promise<void>>();
async function runtimeDb():Promise<D1> {
  return getLegacyDbCompat() as D1;
}
function ensureProjectMasterLinks(_db:D1){return Promise.resolve()}
const invalidateProjectList=(companyId:string)=>{projectListCache.delete(companyId)};
async function nextProjectCode(db:D1,companyId:string){
  const year=new Date().getUTCFullYear();
  const prefix=`PJT-${year}-`;
  const latest=await db.prepare("SELECT code FROM projects WHERE company_id=? AND code LIKE ? ORDER BY CAST(SUBSTR(code, ?) AS INTEGER) DESC LIMIT 1").bind(companyId,`${prefix}%`,prefix.length+1).first<{code:string}>();
  const lastNumber=latest?.code?.match(/(\d+)$/)?.[1];
  return `${prefix}${String((lastNumber?Number(lastNumber):0)+1).padStart(4,"0")}`;
}
async function readProjects(db:D1,companyId:string){
  const result = await db.prepare(
    `SELECT p.id, p.code, p.name, p.customer_name AS customerName,p.partner_id AS partnerId,p.project_type_id AS projectTypeId,partner.name AS partnerName,pt.name AS projectTypeName,profile.description,profile.reference_code AS referenceCode,profile.visibility,
            p.start_date AS startDate, p.end_date AS endDate, p.status,p.updated_at AS updatedAt,
            tv.version AS templateVersion,
            COALESCE(t.name, json_extract(p.template_snapshot, '$.templateName'), '연결 정보 확인 필요') AS templateName,
            (SELECT COUNT(*) FROM project_members pmc WHERE pmc.project_id=p.id) AS memberCount,
            COALESCE((SELECT GROUP_CONCAT(DISTINCT u.name) FROM project_members pm2 JOIN users u ON u.id=pm2.user_id WHERE pm2.project_id=p.id AND pm2.project_role='PM'),'') AS pmNamesText,
            COALESCE((SELECT GROUP_CONCAT(DISTINCT u.name) FROM wbs_tasks wt JOIN users u ON u.id=wt.assignee_user_id WHERE wt.project_id=p.id AND wt.assignee_user_id IS NOT NULL),'') AS assigneeNamesText,
            COALESCE((SELECT GROUP_CONCAT(ps.organization_id) FROM project_shares ps WHERE ps.project_id=p.id),'') AS sharedOrganizationIdsText
       FROM projects p
       LEFT JOIN template_versions tv ON tv.id = p.template_version_id
       LEFT JOIN templates t ON t.id = tv.template_id
       LEFT JOIN partners partner ON partner.id=p.partner_id
       LEFT JOIN project_types pt ON pt.id=p.project_type_id
       LEFT JOIN project_profiles profile ON profile.project_id=p.id
      WHERE p.company_id = ? AND p.code <> ?
      ORDER BY p.created_at DESC`
  ).bind(companyId,SYSTEM_LIBRARY_CODE).all();
  const projects=(result.results??[]).map((row:unknown)=>{const value=row as Record<string,unknown>;const split=(input:unknown)=>String(input||"").split(",").map(item=>item.trim()).filter(Boolean);const {pmNamesText,assigneeNamesText,sharedOrganizationIdsText,...project}=value;return {...project,pmNames:split(pmNamesText),assigneeNames:split(assigneeNamesText),sharedOrganizationIds:split(sharedOrganizationIdsText)}});
  return {projects};
}

export async function GET(request:Request) {
  const db = await runtimeDb();
  await ensureProjectDataFoundation(db);
  await ensureProjectMasterLinks(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const url=new URL(request.url);
  if(url.searchParams.get("action")==="next-code")return Response.json({code:await nextProjectCode(db,context.companyId)});
  const cached=projectListCache.get(context.companyId),now=Date.now();
  if(cached&&cached.expiresAt>now)return Response.json(cached.data,{headers:{"x-project-list-cache":"hit"}});
  const existing=projectListInflight.get(context.companyId);if(existing){const data=await existing;return Response.json(data,{headers:{"x-project-list-cache":"shared"}})}
  const build=readProjects(db,context.companyId);projectListInflight.set(context.companyId,build);
  try{const data=await build;projectListCache.set(context.companyId,{expiresAt:Date.now()+PROJECT_LIST_CACHE_MS,data});return Response.json(data,{headers:{"x-project-list-cache":"miss"}})}finally{if(projectListInflight.get(context.companyId)===build)projectListInflight.delete(context.companyId)}
}

export async function POST(request: Request) {
  try {
  const db = await runtimeDb();
  await ensureProjectDataFoundation(db);
  await ensureProjectMasterLinks(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const input = await request.json<ProjectInput>();
  const required = [input.name, input.startDate, input.endDate];
  if (required.some(value => !value?.trim())) {
    return Response.json({ error: "필수 프로젝트 정보를 모두 입력해 주세요." }, { status: 400 });
  }
  if (input.startDate! > input.endDate!) {
    return Response.json({ error: "종료일은 시작일보다 빠를 수 없습니다." }, { status: 400 });
  }

  const templateVersionId=input.creationMode==="blank"?"tv-blank-10":input.templateVersionId;
  if(!templateVersionId?.trim()) return Response.json({ error:"사용할 템플릿을 선택해 주세요." },{status:400});
  const version = await db.prepare(
    `SELECT tv.id, tv.definition, tv.version, t.name AS template_name
       FROM template_versions tv JOIN templates t ON t.id = tv.template_id
      WHERE tv.id = ? AND t.company_id = ? AND t.status = 'active'`
  ).bind(templateVersionId, context.companyId).first<{ id:string; definition:string; version:string; template_name:string }>();
  if (!version) return Response.json({ error: "사용 가능한 템플릿 버전을 찾을 수 없습니다." }, { status: 404 });

  const projectCode=await nextProjectCode(db,context.companyId);
  const duplicate = await db.prepare("SELECT id FROM projects WHERE company_id = ? AND code = ?").bind(context.companyId,projectCode).first();
  if (duplicate) return Response.json({ error: "프로젝트 코드 생성이 충돌했습니다. 다시 시도해 주세요." }, { status: 409 });
  if(input.partnerId){const partner=await db.prepare("SELECT id FROM partners WHERE id=? AND company_id=? AND status='active'").bind(input.partnerId,context.companyId).first();if(!partner)return Response.json({error:"사용 가능한 거래처를 찾을 수 없습니다."},{status:400});}
  if(input.projectTypeId){const projectType=await db.prepare("SELECT id FROM project_types WHERE id=? AND company_id=? AND status='active'").bind(input.projectTypeId,context.companyId).first();if(!projectType)return Response.json({error:"사용 가능한 프로젝트 유형을 찾을 수 없습니다."},{status:400});}

  const now = Math.floor(Date.now() / 1000);
  const projectId = crypto.randomUUID();
  const members = input.members ?? [];
  const definition=JSON.parse(version.definition) as TemplateDefinition;
  const taskIds=new Map((definition.wbs??[]).map((task,index)=>[task.id||String(index+1),crypto.randomUUID()]));
  const calendar=await db.prepare("SELECT id,working_days AS workingDays FROM work_calendars WHERE company_id=? AND is_default=1").bind(context.companyId).first<{id:string;workingDays:string}>();
  const workingDays=new Set<number>((()=>{try{return JSON.parse(calendar?.workingDays||"[1,2,3,4,5]") as number[]}catch{return [1,2,3,4,5]}})());
  const holidayRows=calendar?await db.prepare("SELECT holiday_date AS date FROM calendar_holidays WHERE calendar_id=?").bind(calendar.id).all():{results:[]};
  const holidays=new Set((holidayRows.results??[]).map((row:{date?:unknown})=>String(row.date||"")));
  const isBusinessDay=(date:string)=>{const value=new Date(`${date}T00:00:00Z`);return workingDays.has(value.getUTCDay())&&!holidays.has(date)};
  const shiftToBusinessDay=(date:string)=>{const value=new Date(`${date}T00:00:00Z`);let result=value.toISOString().slice(0,10);while(!isBusinessDay(result)){value.setUTCDate(value.getUTCDate()+1);result=value.toISOString().slice(0,10)}return result};
  const endFromBusinessDuration=(start:string,duration:number)=>{const value=new Date(`${shiftToBusinessDay(start)}T00:00:00Z`);let remaining=Math.max(1,duration)-1;while(remaining>0){value.setUTCDate(value.getUTCDate()+1);const date=value.toISOString().slice(0,10);if(isBusinessDay(date))remaining--}return value.toISOString().slice(0,10)};
  const nextBusinessDay=(date:string)=>{const value=new Date(`${date}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+1);return shiftToBusinessDay(value.toISOString().slice(0,10))};
  let cursor=shiftToBusinessDay(input.startDate!);
  const statements = [
    db.prepare(`INSERT INTO projects
      (id, company_id, template_version_id, code, name, customer_name, partner_id, project_type_id, start_date, end_date, status, template_snapshot, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'preparing', ?, ?, ?)`)
      .bind(projectId, context.companyId, version.id, projectCode, input.name!.trim(), input.customerName?.trim() || null,input.partnerId||null,input.projectTypeId||null, input.startDate, input.endDate, JSON.stringify({ templateName:version.template_name, version:version.version, definition:JSON.parse(version.definition) }), now, now),
    db.prepare("INSERT INTO project_profiles (project_id,description,reference_code,visibility,updated_at) VALUES (?,?,?,?,?)")
      .bind(projectId,input.description?.trim()||null,input.referenceCode?.trim()||null,input.visibility||"company",now),
    ...(input.visibility==="restricted"?(input.sharedOrganizationIds??[]):[]).map(organizationId=>db.prepare("INSERT OR IGNORE INTO project_shares (project_id,organization_id,created_at) VALUES (?,?,?)").bind(projectId,organizationId,now)),
    ...members.map(member => db.prepare(`INSERT INTO project_members
      (project_id, user_id, project_role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(projectId, member.userId, member.projectRole, now, now)),
    db.prepare(`INSERT INTO audit_logs
      (id, company_id, actor_user_id, action, entity_type, entity_id, detail, created_at)
      VALUES (?, ?, ?, 'PROJECT_CREATED', 'PROJECT', ?, ?, ?)`)
      .bind(crypto.randomUUID(), context.companyId, context.userId, projectId, JSON.stringify({ code:projectCode, templateVersionId:version.id, members:members.length }), now),
  ];
  (definition.roles??[]).forEach((code,index)=>statements.push(db.prepare("INSERT INTO project_roles (id,project_id,code,name,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),projectId,code,code,index,now,now)));
  (definition.wbs??[]).forEach((task,index)=>{
    const code=task.id||String(index+1),group=(task.kind||"task")==="summary",duration=group?0:Math.max(1,task.durationDays||1),plannedStart=group?null:cursor,plannedEnd=group?null:endFromBusinessDuration(cursor,duration);
    statements.push(db.prepare(`INSERT INTO wbs_tasks (id,project_id,wbs_code,parent_id,level,sort_order,kind,name,task_type,duration_days,planned_start,planned_end,predecessor_id,role_code,assignee_user_id,progress,status,completion_actor,completion_criteria,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(taskIds.get(code),projectId,code,task.parentId?taskIds.get(task.parentId)??null:null,task.level||1,index,group?"summary":"task",task.name||`Task ${code}`,group?"normal":task.taskType||"normal",duration,plannedStart,plannedEnd,task.predecessor?taskIds.get(task.predecessor)??null:null,group?null:task.role||null,null,0,"planned",task.completionActor||"assignee",task.completionCriteria||null,now,now));
    const outputs=group?[]:task.deliverables?.length?task.deliverables:task.deliverable?[{name:task.deliverable,type:task.deliverableCategory||"GENERAL",required:task.deliverableRequired!==false,documentKind:task.deliverableDocumentKind==="drawing"?"drawing":"document"}]:[];
    outputs.forEach(output=>statements.push(db.prepare("INSERT INTO deliverables (id,project_id,task_id,name,category,required,status,document_kind,created_at,updated_at) VALUES (?,?,?,?,?,?,'planned',?,?,?)").bind(crypto.randomUUID(),projectId,taskIds.get(code),output.name,output.type||null,output.required===false?0:1,output.documentKind==="drawing"?"drawing":"document",now,now)));
    if(plannedEnd)cursor=nextBusinessDay(plannedEnd);
  });
  await db.batch(statements);
  invalidateProjectList(context.companyId);
  return Response.json({ id: projectId, name: input.name, code: projectCode, template: `${version.template_name} ${version.version}` }, { status: 201 });
  } catch (error) {
    console.error("Project creation failed", error);
    return Response.json(
      { error: error instanceof Error ? `프로젝트 생성 중 오류가 발생했습니다: ${error.message}` : "프로젝트 생성 중 오류가 발생했습니다." }, { status: 500 },
    );
  }
}

export async function PATCH(request:Request) {
  try {
    const db=await runtimeDb();
    await ensureProjectDataFoundation(db);
    await ensureProjectMasterLinks(db);
    let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
    const input=await request.json<ProjectInput>();
    if(!input.id?.trim())return Response.json({error:"수정할 프로젝트를 확인할 수 없습니다."},{status:400});
    const access=await requireProjectAccess(db,context,input.id,true);
    if(!canManageProject(context,access.projectRole))return Response.json({error:"프로젝트 기본정보를 수정할 권한이 없습니다."},{status:403});
    if(!input.name?.trim()||!input.startDate?.trim()||!input.endDate?.trim())return Response.json({error:"프로젝트명, 시작일, 종료일을 입력해 주세요."},{status:400});
    if(input.startDate>input.endDate)return Response.json({error:"종료일은 시작일보다 빠를 수 없습니다."},{status:400});
    if(input.visibility&&!["company","restricted"].includes(input.visibility))return Response.json({error:"올바른 프로젝트 공개 범위를 선택해 주세요."},{status:400});
    if(input.partnerId){const partner=await db.prepare("SELECT id FROM partners WHERE id=? AND company_id=? AND status='active'").bind(input.partnerId,context.companyId).first();if(!partner)return Response.json({error:"사용 가능한 거래처를 찾을 수 없습니다."},{status:400});}
    if(input.projectTypeId){const projectType=await db.prepare("SELECT id FROM project_types WHERE id=? AND company_id=? AND status='active'").bind(input.projectTypeId,context.companyId).first();if(!projectType)return Response.json({error:"사용 가능한 프로젝트 유형을 찾을 수 없습니다."},{status:400});}
    if(input.visibility==="restricted"&&!(input.sharedOrganizationIds??[]).length)return Response.json({error:"지정 조직 공개는 공유 조직을 하나 이상 선택해 주세요."},{status:400});
    const organizationIds=Array.from(new Set(input.visibility==="restricted"?(input.sharedOrganizationIds??[]):[]));
    for(const organizationId of organizationIds){const organization=await db.prepare("SELECT id FROM organizations WHERE id=? AND company_id=?").bind(organizationId,context.companyId).first();if(!organization)return Response.json({error:"사용 가능한 공유 조직을 확인해 주세요."},{status:400});}
    const now=Math.floor(Date.now()/1000);
    const statements=[
      db.prepare("UPDATE projects SET name=?,customer_name=?,partner_id=?,project_type_id=?,start_date=?,end_date=?,updated_at=? WHERE id=? AND company_id=?").bind(input.name.trim(),input.customerName?.trim()||null,input.partnerId||null,input.projectTypeId||null,input.startDate,input.endDate,now,input.id,context.companyId),
      db.prepare("INSERT INTO project_profiles (project_id,description,reference_code,visibility,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET description=excluded.description,reference_code=excluded.reference_code,visibility=excluded.visibility,updated_at=excluded.updated_at").bind(input.id,input.description?.trim()||null,input.referenceCode?.trim()||null,input.visibility||"company",now),
      db.prepare("DELETE FROM project_shares WHERE project_id=?").bind(input.id),
      ...organizationIds.map(organizationId=>db.prepare("INSERT INTO project_shares (project_id,organization_id,created_at) VALUES (?,?,?)").bind(input.id,organizationId,now)),
      db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'PROJECT_UPDATED','PROJECT',?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,input.id,JSON.stringify({name:input.name,partnerId:input.partnerId||null,projectTypeId:input.projectTypeId||null,startDate:input.startDate,endDate:input.endDate,visibility:input.visibility||"company"}),now),
    ];
    await db.batch(statements);
    invalidateProjectList(context.companyId);
    const stored=await db.prepare("SELECT code,status FROM projects WHERE id=? AND company_id=?").bind(input.id,context.companyId).first<{code:string;status:string}>();
    const partner=input.partnerId?await db.prepare("SELECT name FROM partners WHERE id=? AND company_id=?").bind(input.partnerId,context.companyId).first<{name:string}>():null;
    const projectType=input.projectTypeId?await db.prepare("SELECT name FROM project_types WHERE id=? AND company_id=?").bind(input.projectTypeId,context.companyId).first<{name:string}>():null;
    return Response.json({project:{id:input.id,code:stored?.code||"",name:input.name.trim(),customerName:input.customerName?.trim()||undefined,partnerId:input.partnerId,partnerName:partner?.name,projectTypeId:input.projectTypeId,projectTypeName:projectType?.name,description:input.description?.trim()||undefined,referenceCode:input.referenceCode?.trim()||undefined,visibility:input.visibility||"company",sharedOrganizationIds:organizationIds,startDate:input.startDate,endDate:input.endDate,status:stored?.status||access.project.status,updatedAt:now}});
  } catch(error) {
    const contextResponse=contextErrorResponse(error);if(contextResponse)return contextResponse;
    console.error("Project update failed",error);
    return Response.json({error:error instanceof Error?`프로젝트 수정 중 오류가 발생했습니다: ${error.message}`:"프로젝트 수정 중 오류가 발생했습니다."},{status:500});
  }
}
