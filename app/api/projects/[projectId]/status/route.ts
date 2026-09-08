import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
import {captureWbsCheckoutSnapshot,recordWbsCheckinChanges} from "../../../../../db/wbs-change-history";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
type ProjectStatus="preparing"|"active"|"stopped"|"completed";
type StatusAction="start"|"stop"|"resume"|"complete"|"prepare";
type StatusInput={action?:StatusAction;force?:boolean;reason?:string};

async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1}
const nextStatus:Record<StatusAction,ProjectStatus>={start:"active",stop:"stopped",resume:"active",complete:"completed",prepare:"preparing"};
const allowedFrom:Record<StatusAction,ProjectStatus[]>={start:["preparing"],stop:["active"],resume:["stopped"],complete:["active"],prepare:["active","stopped"]};

async function ensureBaselineTables(db:D1){await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS project_baselines (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,version integer NOT NULL,name text NOT NULL,captured_at integer NOT NULL,captured_by text,is_active integer DEFAULT 1 NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS project_baselines_project_version_uq ON project_baselines(project_id,version)"),
  db.prepare("CREATE TABLE IF NOT EXISTS project_baseline_tasks (baseline_id text NOT NULL,task_id text NOT NULL,wbs_code text NOT NULL,name text NOT NULL,planned_start text,planned_end text,duration_days integer NOT NULL,sort_order integer NOT NULL,PRIMARY KEY(baseline_id,task_id),FOREIGN KEY(baseline_id) REFERENCES project_baselines(id) ON DELETE CASCADE)"),
])}

async function captureStartBaseline(db:D1,projectId:string,now:number,actorUserId:string){
  await ensureBaselineTables(db);
  const existing=await db.prepare("SELECT id,version FROM project_baselines WHERE project_id=? AND is_active=1 ORDER BY version DESC LIMIT 1").bind(projectId).first() as {id:string;version:number}|null;
  if(existing)return existing;
  const count=await db.prepare("SELECT COUNT(*) AS count FROM project_baselines WHERE project_id=?").bind(projectId).first() as {count:number}|null;
  const version=Number(count?.count||0)+1,id=crypto.randomUUID();
  const tasks=await db.prepare("SELECT id,wbs_code AS wbsCode,name,planned_start AS plannedStart,planned_end AS plannedEnd,duration_days AS durationDays,sort_order AS sortOrder FROM wbs_tasks WHERE project_id=? ORDER BY sort_order").bind(projectId).all();
  await db.batch([
    db.prepare("UPDATE project_baselines SET is_active=0 WHERE project_id=?").bind(projectId),
    db.prepare("INSERT INTO project_baselines (id,project_id,version,name,captured_at,captured_by,is_active) VALUES (?,?,?,?,?,?,1)").bind(id,projectId,version,`프로젝트 시작 Baseline v${version}`,now,actorUserId),
    ...(tasks.results??[]).map((task:any)=>db.prepare("INSERT INTO project_baseline_tasks (baseline_id,task_id,wbs_code,name,planned_start,planned_end,duration_days,sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(id,task.id,task.wbsCode,task.name,task.plannedStart||null,task.plannedEnd||null,Number(task.durationDays)||1,Number(task.sortOrder)||0)),
  ]);
  return {id,version};
}

async function startValidation(db:D1,projectId:string,project:{startDate:string;endDate:string}){
  const taskRows=await db.prepare(`SELECT w.id,w.wbs_code AS wbsCode,w.name,w.kind,w.planned_start AS plannedStart,w.planned_end AS plannedEnd,w.duration_days AS durationDays,w.role_code AS roleCode,w.assignee_user_id AS assigneeUserId,(SELECT COUNT(*) FROM deliverables d WHERE d.task_id=w.id AND d.project_id=w.project_id AND d.required=1) AS requiredDeliverableCount FROM wbs_tasks w WHERE w.project_id=? ORDER BY w.sort_order`).bind(projectId).all();
  const all=(taskRows.results??[]) as Array<any>,executable=all.filter(task=>task.kind!=="summary");
  const errors:Array<{code:string;message:string;wbsCode?:string;taskName?:string}>=[],warnings:Array<{code:string;message:string;wbsCode?:string;taskName?:string}>=[];
  if(!all.length)errors.push({code:"NO_WBS",message:"등록된 WBS가 없습니다."});
  if(all.length&&!executable.length)errors.push({code:"NO_EXECUTABLE_TASK",message:"실행 Task가 없습니다."});
  if(!project.startDate||!project.endDate||project.startDate>project.endDate)errors.push({code:"INVALID_PROJECT_PERIOD",message:"프로젝트 시작일과 종료일을 확인해 주세요."});
  for(const task of executable){
    if(!task.plannedStart)errors.push({code:"MISSING_PLANNED_START",message:"계획 시작일이 없습니다.",wbsCode:task.wbsCode,taskName:task.name});
    if(!Number(task.durationDays)||Number(task.durationDays)<=0)errors.push({code:"MISSING_DURATION",message:"소요일이 없습니다.",wbsCode:task.wbsCode,taskName:task.name});
    if(task.plannedStart&&task.plannedEnd&&task.plannedStart>task.plannedEnd)errors.push({code:"INVALID_TASK_PERIOD",message:"계획 종료일이 시작일보다 빠릅니다.",wbsCode:task.wbsCode,taskName:task.name});
    if(!task.assigneeUserId)warnings.push({code:"UNASSIGNED",message:"담당자가 미배정되었습니다.",wbsCode:task.wbsCode,taskName:task.name});
    if(!task.roleCode)warnings.push({code:"NO_ROLE",message:"담당 Role이 지정되지 않았습니다.",wbsCode:task.wbsCode,taskName:task.name});
    if(Number(task.requiredDeliverableCount)===0)warnings.push({code:"NO_REQUIRED_DELIVERABLE",message:"필수 산출물이 정의되지 않았습니다.",wbsCode:task.wbsCode,taskName:task.name});
  }
  return {errors,warnings,totalWbs:all.length,executableTasks:executable.length};
}

async function completionValidation(db:D1,projectId:string){
  const incomplete=await db.prepare("SELECT COUNT(*) AS count FROM wbs_tasks WHERE project_id=? AND kind<>'summary' AND status<>'completed'").bind(projectId).first() as {count:number}|null;
  const requiredOutputs=await db.prepare("SELECT COUNT(*) AS count FROM deliverables WHERE project_id=? AND required=1 AND (status NOT IN ('submitted','approved','completed') OR file_key IS NULL)").bind(projectId).first() as {count:number}|null;
  const openIssues=await db.prepare("SELECT COUNT(*) AS count FROM project_issues WHERE project_id=? AND status NOT IN ('resolved','closed','completed')").bind(projectId).first() as {count:number}|null;
  const warnings:Array<{code:string;message:string;count:number}>=[];
  if(Number(incomplete?.count))warnings.push({code:"INCOMPLETE_TASK",message:"미완료 실행 Task가 있습니다.",count:Number(incomplete?.count)});
  if(Number(requiredOutputs?.count))warnings.push({code:"REQUIRED_OUTPUT_PENDING",message:"필수 산출물이 미완료 또는 미등록 상태입니다.",count:Number(requiredOutputs?.count)});
  if(Number(openIssues?.count))warnings.push({code:"OPEN_ISSUE",message:"종결되지 않은 이슈·리스크가 있습니다.",count:Number(openIssues?.count)});
  return warnings;
}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,db=await runtimeDb(),input=await request.json() as StatusInput,action=input.action;
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole))return Response.json({error:"PM 또는 PL만 프로젝트 상태를 변경할 수 있습니다."},{status:403});
  if(!action||!nextStatus[action])return Response.json({error:"지원하지 않는 프로젝트 상태 변경입니다."},{status:400});
  const project=await db.prepare("SELECT id,company_id AS companyId,status,start_date AS startDate,end_date AS endDate FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first() as {id:string;companyId:string;status:ProjectStatus;startDate:string;endDate:string}|null;
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  if(!allowedFrom[action].includes(project.status))return Response.json({error:`현재 프로젝트 상태(${project.status})에서는 요청한 작업을 수행할 수 없습니다.`},{status:409});
  if(action==="stop"&&!input.reason?.trim())return Response.json({error:"프로젝트 중단 사유를 입력해 주세요."},{status:400});
  if(action==="start"){const validation=await startValidation(db,projectId,project);if(validation.errors.length)return Response.json({error:"프로젝트 시작 조건을 충족하지 못했습니다.",...validation},{status:422});if(validation.warnings.length&&!input.force)return Response.json({requiresConfirmation:true,...validation})}
  if(action==="complete"){const warnings=await completionValidation(db,projectId);if(warnings.length&&!input.force)return Response.json({requiresConfirmation:true,warnings})}
  const now=Math.floor(Date.now()/1000),toStatus=nextStatus[action];
  if(action==="prepare")await captureWbsCheckoutSnapshot(db,projectId,now,context.userId);
  const wbsChanges=action==="start"?await recordWbsCheckinChanges(db,projectId,now,context.userId):{changeSetId:null,changeCount:0};
  const baseline=action==="start"?await captureStartBaseline(db,projectId,now,context.userId):null;
  await db.batch([
    db.prepare("UPDATE projects SET status=?,updated_at=? WHERE id=? AND company_id=?").bind(toStatus,now,projectId,context.companyId),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,`PROJECT_${action.toUpperCase()}`,"PROJECT",projectId,JSON.stringify({fromStatus:project.status,toStatus,reason:input.reason?.trim()||null,baselineId:baseline?.id||null,wbsChangeSetId:wbsChanges.changeSetId,wbsChangeCount:wbsChanges.changeCount}),now),
  ]);
  return Response.json({projectId,status:toStatus,action,baseline,wbsChanges});
}
