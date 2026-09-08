import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
type ScheduleTask={
  taskId:string;
  wbsCode:string;
  name:string;
  plannedStart?:string;
  plannedEnd?:string;
  durationDays:number;
  sortOrder:number;
  status:"planned"|"active"|"review"|"completed";
  progress:number;
};
type ActualRow={taskId:string;actualDate:string;progress:number;completed:boolean;actualHours?:number;workNote?:string};
type Input={projectStart:string;projectEnd:string;baselineName:string;baselineTasks:ScheduleTask[];currentTasks:ScheduleTask[];actuals:ActualRow[]};

async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1}
async function ensureTables(db:D1){await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS project_baselines (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,version integer NOT NULL,name text NOT NULL,captured_at integer NOT NULL,captured_by text,is_active integer DEFAULT 1 NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS project_baselines_project_version_uq ON project_baselines(project_id,version)"),
  db.prepare("CREATE TABLE IF NOT EXISTS project_baseline_tasks (baseline_id text NOT NULL,task_id text NOT NULL,wbs_code text NOT NULL,name text NOT NULL,planned_start text,planned_end text,duration_days integer NOT NULL,sort_order integer NOT NULL,PRIMARY KEY(baseline_id,task_id),FOREIGN KEY(baseline_id) REFERENCES project_baselines(id) ON DELETE CASCADE)"),
  db.prepare(`CREATE TABLE IF NOT EXISTS task_actuals (
    id TEXT PRIMARY KEY NOT NULL,project_id TEXT NOT NULL,task_id TEXT NOT NULL,user_id TEXT NOT NULL,
    actual_date TEXT NOT NULL,actual_hours REAL NOT NULL DEFAULT 0,progress INTEGER NOT NULL DEFAULT 0,
    work_note TEXT,completed INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id),FOREIGN KEY(task_id) REFERENCES wbs_tasks(id),FOREIGN KEY(user_id) REFERENCES users(id))`),
  db.prepare("CREATE INDEX IF NOT EXISTS task_actuals_project_task_idx ON task_actuals(project_id,task_id,actual_date)"),
])}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const url=new URL(request.url);
  const localDemo=request.headers.get("x-demo-seed")==="jsolution-local-demo"&&["localhost","127.0.0.1"].includes(url.hostname);
  if(!localDemo)return Response.json({error:"로컬 데모 환경에서만 일정 보정을 실행할 수 있습니다."},{status:403});
  const {projectId}=await params,db=await runtimeDb();await ensureTables(db);
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole)||!context.systemRoles.some((role:string)=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role)))return Response.json({error:"관리자이면서 PM 또는 PL인 사용자만 데모 일정을 보정할 수 있습니다."},{status:403});
  const project=await db.prepare("SELECT id,code,name FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first() as {id:string;code:string;name:string}|null;
  if(!project||project.code!=="CIM-2026-PILOT-DEMO")return Response.json({error:"CIM Pilot 데모 프로젝트만 보정할 수 있습니다."},{status:404});
  const input=await request.json() as Input;
  if(!input.projectStart||!input.projectEnd||input.projectStart>input.projectEnd||!input.baselineName?.trim())return Response.json({error:"프로젝트 기간과 Baseline 정보가 올바르지 않습니다."},{status:400});
  const existing=await db.prepare("SELECT id,wbs_code AS wbsCode FROM wbs_tasks WHERE project_id=? ORDER BY sort_order").bind(projectId).all();
  const existingById=new Map((existing.results??[]).map((task:{id:string;wbsCode:string})=>[task.id,task.wbsCode]));
  if(!input.currentTasks?.length||input.currentTasks.length!==existingById.size||input.baselineTasks?.length!==existingById.size)return Response.json({error:"현재 WBS 전체 일정이 포함되지 않아 보정을 중단했습니다."},{status:400});
  for(const task of [...input.currentTasks,...input.baselineTasks]){
    if(existingById.get(task.taskId)!==task.wbsCode||task.plannedStart&&task.plannedEnd&&task.plannedStart>task.plannedEnd)return Response.json({error:`${task.wbsCode||"WBS"} 일정 정보가 올바르지 않습니다.`},{status:400});
  }
  const allowed=new Set(["planned","active","review","completed"]);
  if(input.currentTasks.some(task=>!allowed.has(task.status)||task.progress<0||task.progress>100))return Response.json({error:"Task 상태 또는 진행률이 올바르지 않습니다."},{status:400});
  const nextVersion=Number((await db.prepare("SELECT COALESCE(MAX(version),0)+1 AS version FROM project_baselines WHERE project_id=?").bind(projectId).first() as {version:number}|null)?.version||1);
  const baselineId=crypto.randomUUID(),now=Math.floor(Date.now()/1000),marker="[CIM 데모 보정]";
  const statements:any[]=[
    db.prepare("UPDATE project_baselines SET is_active=0 WHERE project_id=?").bind(projectId),
    db.prepare("INSERT INTO project_baselines (id,project_id,version,name,captured_at,captured_by,is_active) VALUES (?,?,?,?,?,?,1)").bind(baselineId,projectId,nextVersion,input.baselineName.trim(),now,context.userId),
    db.prepare("UPDATE projects SET start_date=?,end_date=?,updated_at=? WHERE id=? AND company_id=?").bind(input.projectStart,input.projectEnd,now,projectId,context.companyId),
    db.prepare("DELETE FROM task_actuals WHERE project_id=? AND work_note LIKE ?").bind(projectId,`${marker}%`),
  ];
  for(const task of input.baselineTasks)statements.push(db.prepare("INSERT INTO project_baseline_tasks (baseline_id,task_id,wbs_code,name,planned_start,planned_end,duration_days,sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(baselineId,task.taskId,task.wbsCode,task.name,task.plannedStart||null,task.plannedEnd||null,Math.max(0,Number(task.durationDays)||0),task.sortOrder));
  for(const task of input.currentTasks)statements.push(db.prepare("UPDATE wbs_tasks SET planned_start=?,planned_end=?,duration_days=?,status=?,progress=?,updated_at=? WHERE id=? AND project_id=?").bind(task.plannedStart||null,task.plannedEnd||null,Math.max(0,Number(task.durationDays)||0),task.status,Math.round(task.progress),now,task.taskId,projectId));
  for(const actual of input.actuals??[]){
    if(!existingById.has(actual.taskId))return Response.json({error:"다른 프로젝트의 실적이 포함되어 있습니다."},{status:400});
    statements.push(db.prepare("INSERT INTO task_actuals (id,project_id,task_id,user_id,actual_date,actual_hours,progress,work_note,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),projectId,actual.taskId,context.userId,actual.actualDate,Math.max(0,Number(actual.actualHours)||0),Math.max(0,Math.min(100,Math.round(actual.progress))),`${marker} ${actual.workNote||"일정·실적 정합성 보정"}`,actual.completed?1:0,now,now));
  }
  statements.push(db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'CIM_DEMO_REBALANCED','PROJECT',?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,projectId,JSON.stringify({baselineId,baselineVersion:nextVersion,taskCount:input.currentTasks.length,actualCount:input.actuals?.length||0,predecessorsPreserved:true}),now));
  await db.batch(statements);
  return Response.json({ok:true,projectId,projectName:project.name,baseline:{id:baselineId,version:nextVersion,name:input.baselineName},taskCount:input.currentTasks.length,actualCount:input.actuals?.length||0,predecessorsPreserved:true});
}
