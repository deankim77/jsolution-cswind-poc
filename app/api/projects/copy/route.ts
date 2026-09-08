import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {ensureProjectDataFoundation,type RuntimeD1} from "../../../../db/project-data-foundation";
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1=RuntimeD1;
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const shiftDate=(value:string|undefined,sourceStart:string,targetStart:string)=>{if(!value)return null;const offset=Math.round((Date.parse(`${value}T00:00:00Z`)-Date.parse(`${sourceStart}T00:00:00Z`))/86_400_000);const target=new Date(`${targetStart}T00:00:00Z`);target.setUTCDate(target.getUTCDate()+offset);return target.toISOString().slice(0,10)};
async function nextProjectCode(db:D1,companyId:string){
  const year=new Date().getUTCFullYear();
  const prefix=`PJT-${year}-`;
  const latest=await db.prepare("SELECT code FROM projects WHERE company_id=? AND code LIKE ? ORDER BY CAST(SUBSTR(code, ?) AS INTEGER) DESC LIMIT 1").bind(companyId,`${prefix}%`,prefix.length+1).first<{code:string}>();
  const lastNumber=latest?.code?.match(/(\d+)$/)?.[1];
  return `${prefix}${String((lastNumber?Number(lastNumber):0)+1).padStart(4,"0")}`;
}

export async function POST(request:Request){
  const input=await request.json() as {sourceProjectId?:string;name?:string;code?:string;customerName?:string;partnerId?:string;projectTypeId?:string;description?:string;referenceCode?:string;visibility?:"company"|"restricted";sharedOrganizationIds?:string[];startDate?:string;endDate?:string;includeAssignees?:boolean};
  if(!input.sourceProjectId||![input.name,input.startDate,input.endDate].every(value=>value?.trim()))return Response.json({error:"복사 원본과 필수 프로젝트 정보를 모두 입력해 주세요."},{status:400});
  if(input.startDate!>input.endDate!)return Response.json({error:"종료일은 시작일보다 빠를 수 없습니다."},{status:400});
  const db=await runtimeDb();await ensureProjectDataFoundation(db);try{await db.prepare("ALTER TABLE projects ADD COLUMN partner_id text").run();}catch{}try{await db.prepare("ALTER TABLE projects ADD COLUMN project_type_id text").run();}catch{}await db.batch([db.prepare(`CREATE TABLE IF NOT EXISTS project_profiles (project_id text PRIMARY KEY NOT NULL,description text,reference_code text,visibility text DEFAULT 'company' NOT NULL,updated_at integer NOT NULL)`),db.prepare(`CREATE TABLE IF NOT EXISTS project_shares (project_id text NOT NULL,organization_id text NOT NULL,created_at integer NOT NULL,PRIMARY KEY(project_id,organization_id))`)]);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const source=await db.prepare("SELECT id,company_id AS companyId,template_version_id AS templateVersionId,name,start_date AS startDate,template_snapshot AS templateSnapshot FROM projects WHERE id=? AND company_id=?").bind(input.sourceProjectId,context.companyId).first<any>();
  if(!source)return Response.json({error:"복사할 프로젝트를 찾을 수 없습니다."},{status:404});
  const projectCode=await nextProjectCode(db,context.companyId);
  const duplicate=await db.prepare("SELECT id FROM projects WHERE company_id=? AND code=?").bind(context.companyId,projectCode).first();
  if(duplicate)return Response.json({error:"프로젝트 코드 생성이 충돌했습니다. 다시 시도해 주세요."},{status:409});
  const [taskRows,roleRows,outputRows,memberRows]=await Promise.all([
    db.prepare("SELECT * FROM wbs_tasks WHERE project_id=? ORDER BY sort_order").bind(source.id).all(),
    db.prepare("SELECT * FROM project_roles WHERE project_id=? ORDER BY sort_order").bind(source.id).all(),
    db.prepare("SELECT * FROM deliverables WHERE project_id=? ORDER BY created_at").bind(source.id).all(),
    db.prepare("SELECT * FROM project_members WHERE project_id=?").bind(source.id).all(),
  ]);
  const tasks=taskRows.results??[],roles=roleRows.results??[],outputs=outputRows.results??[],members=input.includeAssignees?(memberRows.results??[]):[];
  const projectId=crypto.randomUUID(),now=Math.floor(Date.now()/1000);const taskIds=new Map(tasks.map((task:any)=>[task.id,crypto.randomUUID()]));
  const snapshot=JSON.stringify({copiedFrom:{projectId:source.id,projectName:source.name,copiedAt:now},sourceTemplate:JSON.parse(source.templateSnapshot||"{}")});
  const statements:any[]=[
    db.prepare("INSERT INTO projects (id,company_id,template_version_id,code,name,customer_name,partner_id,project_type_id,start_date,end_date,status,template_snapshot,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'preparing',?,?,?)").bind(projectId,context.companyId,source.templateVersionId,projectCode,input.name!.trim(),input.customerName?.trim()||null,input.partnerId||null,input.projectTypeId||null,input.startDate,input.endDate,snapshot,now,now),
    db.prepare("INSERT INTO project_profiles (project_id,description,reference_code,visibility,updated_at) VALUES (?,?,?,?,?)").bind(projectId,input.description?.trim()||null,input.referenceCode?.trim()||null,input.visibility||"company",now),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'PROJECT_COPIED','PROJECT',?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,projectId,JSON.stringify({sourceProjectId:source.id,code:projectCode,taskCount:tasks.length,includeAssignees:Boolean(input.includeAssignees)}),now),
  ];
  for(const organizationId of input.visibility==="restricted"?(input.sharedOrganizationIds??[]):[])statements.push(db.prepare("INSERT OR IGNORE INTO project_shares (project_id,organization_id,created_at) VALUES (?,?,?)").bind(projectId,organizationId,now));
  for(const role of roles as any[])statements.push(db.prepare("INSERT INTO project_roles (id,project_id,code,name,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),projectId,role.code,role.name,role.sort_order,now,now));
  for(const member of members as any[])statements.push(db.prepare("INSERT INTO project_members (project_id,user_id,project_role,created_at,updated_at) VALUES (?,?,?,?,?)").bind(projectId,member.user_id,member.project_role,now,now));
  for(const task of tasks as any[])statements.push(db.prepare("INSERT INTO wbs_tasks (id,project_id,wbs_code,parent_id,level,sort_order,kind,name,task_type,duration_days,planned_start,planned_end,predecessor_id,role_code,assignee_user_id,progress,status,completion_actor,completion_criteria,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(taskIds.get(task.id),projectId,task.wbs_code,task.parent_id?taskIds.get(task.parent_id)||null:null,task.level,task.sort_order,task.kind,task.name,task.task_type,task.duration_days,shiftDate(task.planned_start,source.startDate,input.startDate!),shiftDate(task.planned_end,source.startDate,input.startDate!),task.predecessor_id?taskIds.get(task.predecessor_id)||null:null,task.role_code,input.includeAssignees?task.assignee_user_id:null,0,"planned",task.completion_actor,task.completion_criteria,now,now));
  for(const output of outputs as any[])statements.push(db.prepare("INSERT INTO deliverables (id,project_id,task_id,name,category,required,status,file_key,version,created_at,updated_at) VALUES (?,?,?,?,?,?,'planned',NULL,NULL,?,?)").bind(crypto.randomUUID(),projectId,output.task_id?taskIds.get(output.task_id)||null:null,output.name,output.category,output.required,now,now));
  await db.batch(statements);
  return Response.json({id:projectId,name:input.name,code:projectCode,status:"preparing",copiedTaskCount:tasks.length},{status:201});
}
