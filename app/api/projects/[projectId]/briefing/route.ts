import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1}
async function ensureTables(db:D1){await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS task_actuals (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,task_id text NOT NULL,user_id text NOT NULL,actual_date text NOT NULL,actual_hours real NOT NULL DEFAULT 0,progress integer NOT NULL DEFAULT 0,work_note text,completed integer NOT NULL DEFAULT 0,created_at integer NOT NULL,updated_at integer NOT NULL)"),
  db.prepare("CREATE TABLE IF NOT EXISTS project_baselines (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,version integer NOT NULL,name text NOT NULL,captured_at integer NOT NULL,captured_by text,is_active integer DEFAULT 1 NOT NULL)"),
  db.prepare("CREATE TABLE IF NOT EXISTS project_baseline_tasks (baseline_id text NOT NULL,task_id text NOT NULL,wbs_code text NOT NULL,name text NOT NULL,planned_start text,planned_end text,duration_days integer NOT NULL,sort_order integer NOT NULL,PRIMARY KEY(baseline_id,task_id))"),
])}

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,db=await runtimeDb();await ensureTables(db);
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  const project=await db.prepare("SELECT id,code,name,status,start_date AS startDate,end_date AS endDate FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first() as {id:string;code:string;name:string;status:string;startDate:string;endDate:string}|null;
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  const taskResult=await db.prepare(`SELECT w.id,w.wbs_code AS wbsCode,w.name,w.status,w.progress,w.planned_end AS plannedEnd,u.name AS assigneeName,
    (SELECT MAX(a.actual_date) FROM task_actuals a WHERE a.project_id=w.project_id AND a.task_id=w.id) AS latestActualDate,
    (SELECT COUNT(*) FROM deliverables d WHERE d.project_id=w.project_id AND d.task_id=w.id AND d.required=1 AND d.status!='submitted') AS missingDeliverables,
    (SELECT COUNT(*) FROM project_issues i WHERE i.project_id=w.project_id AND i.task_id=w.id AND i.status NOT IN ('resolved','closed')) AS openIssues
    FROM wbs_tasks w LEFT JOIN users u ON u.id=w.assignee_user_id WHERE w.project_id=? AND w.kind='task' ORDER BY w.sort_order`).bind(projectId).all();
  const tasks=(taskResult.results??[]) as Array<any>,today=new Date().toISOString().slice(0,10);
  const delayed=tasks.filter(task=>!["completed","review"].includes(task.status)&&task.plannedEnd&&task.plannedEnd<today),missing=tasks.filter(task=>Number(task.missingDeliverables)>0),stale=tasks.filter(task=>task.status==="active"&&(!task.latestActualDate||task.latestActualDate<new Date(Date.now()-7*86400000).toISOString().slice(0,10)));
  const issues=await db.prepare(`SELECT i.id,i.task_id AS taskId,i.title,i.severity,i.status,w.wbs_code AS wbsCode,w.name AS taskName FROM project_issues i LEFT JOIN wbs_tasks w ON w.id=i.task_id WHERE i.project_id=? AND i.status NOT IN ('resolved','closed') ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,i.updated_at DESC`).bind(projectId).all();
  const openIssues=(issues.results??[]) as Array<any>,critical=openIssues.filter(issue=>issue.severity==="critical"),important=openIssues.filter(issue=>issue.severity==="critical"||issue.severity==="high");
  const baseline=await db.prepare("SELECT id,version,name,captured_at AS capturedAt FROM project_baselines WHERE project_id=? AND is_active=1 ORDER BY version DESC LIMIT 1").bind(projectId).first() as {id:string;version:number;name:string;capturedAt:number}|null;
  let baselineChanged=0,baselineDelayed=0,maxDelayDays=0;
  if(baseline){const comparison=await db.prepare(`SELECT b.planned_start AS baselineStart,b.planned_end AS baselineEnd,w.planned_start AS currentStart,w.planned_end AS currentEnd,CAST(julianday(w.planned_end)-julianday(b.planned_end) AS integer) AS delayDays FROM project_baseline_tasks b LEFT JOIN wbs_tasks w ON w.id=b.task_id AND w.project_id=? WHERE b.baseline_id=?`).bind(projectId,baseline.id).all();const rows=(comparison.results??[]) as Array<any>;baselineChanged=rows.filter(row=>row.baselineStart!==row.currentStart||row.baselineEnd!==row.currentEnd).length;const shifted=rows.filter(row=>Number(row.delayDays)>0);baselineDelayed=shifted.length;maxDelayDays=Math.max(0,...shifted.map(row=>Number(row.delayDays)||0))}
  const completed=tasks.filter(task=>task.status==="completed").length,active=tasks.filter(task=>task.status==="active"||task.status==="review").length,planned=tasks.filter(task=>task.status==="planned").length,progress=Math.round(tasks.reduce((sum,task)=>sum+Number(task.progress||0),0)/Math.max(1,tasks.length));
  const priorityItems=[
    ...critical.map(issue=>({kind:"critical-issue",level:"critical",taskId:issue.taskId,wbsCode:issue.wbsCode,title:issue.title,detail:`Critical 이슈 · ${issue.taskName||"프로젝트 공통"}`})),
    ...delayed.map(task=>({kind:"delayed",level:"high",taskId:task.id,wbsCode:task.wbsCode,title:task.name,detail:`계획 종료 ${task.plannedEnd} · ${task.assigneeName||"담당자 미배정"}`})),
    ...missing.map(task=>({kind:"deliverable",level:"medium",taskId:task.id,wbsCode:task.wbsCode,title:task.name,detail:`필수 산출물 ${Number(task.missingDeliverables)}건 미등록`})),
    ...stale.map(task=>({kind:"stale-actual",level:"medium",taskId:task.id,wbsCode:task.wbsCode,title:task.name,detail:`최근 실적 ${task.latestActualDate||"없음"}`})),
    ...important.filter(issue=>issue.severity!=="critical").map(issue=>({kind:"important-issue",level:"high",taskId:issue.taskId,wbsCode:issue.wbsCode,title:issue.title,detail:`중요 이슈 · ${issue.taskName||"프로젝트 공통"}`})),
  ].filter((item,index,rows)=>rows.findIndex(candidate=>candidate.kind===item.kind&&candidate.taskId===item.taskId&&candidate.title===item.title)===index).slice(0,12);
  const health=critical.length||delayed.length?"risk":missing.length||important.length||stale.length?"warning":"stable";
  return Response.json({project,health,summary:{progress,total:tasks.length,completed,active,planned,delayed:delayed.length,missingDeliverables:missing.reduce((sum,task)=>sum+Number(task.missingDeliverables),0),openIssues:openIssues.length,criticalIssues:critical.length,importantIssues:important.length,staleActuals:stale.length,baselineChanged,baselineDelayed,maxDelayDays},baseline,priorityItems,generatedAt:Math.floor(Date.now()/1000)});
}
