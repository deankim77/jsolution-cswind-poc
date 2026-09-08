import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};

const baselineSchemaReadyByDb=new WeakMap<object,Promise<void>>();
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1}
function ensureBaselineTables(db:D1){const key=db as object,existing=baselineSchemaReadyByDb.get(key);if(existing)return existing;const ready=ensureBaselineTablesImpl(db).catch(reason=>{baselineSchemaReadyByDb.delete(key);throw reason});baselineSchemaReadyByDb.set(key,ready);return ready}
async function ensureBaselineTablesImpl(db:D1){await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS project_baselines (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,version integer NOT NULL,name text NOT NULL,captured_at integer NOT NULL,captured_by text,is_active integer DEFAULT 1 NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS project_baselines_project_version_uq ON project_baselines(project_id,version)"),
  db.prepare("CREATE TABLE IF NOT EXISTS project_baseline_tasks (baseline_id text NOT NULL,task_id text NOT NULL,wbs_code text NOT NULL,name text NOT NULL,planned_start text,planned_end text,duration_days integer NOT NULL,sort_order integer NOT NULL,PRIMARY KEY(baseline_id,task_id),FOREIGN KEY(baseline_id) REFERENCES project_baselines(id) ON DELETE CASCADE)"),
])}

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,db=await runtimeDb();await ensureBaselineTables(db);
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  const project=await db.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  const baseline=await db.prepare("SELECT id,version,name,captured_at AS capturedAt,captured_by AS capturedBy FROM project_baselines WHERE project_id=? AND is_active=1 ORDER BY version DESC LIMIT 1").bind(projectId).first() as {id:string;version:number;name:string;capturedAt:number;capturedBy?:string}|null;
  if(!baseline)return Response.json({baseline:null,tasks:[],comparisons:[],summary:{changed:0,delayed:0,ahead:0,maxDelayDays:0}});
  const tasks=await db.prepare("SELECT task_id AS taskId,wbs_code AS wbsCode,name,planned_start AS plannedStart,planned_end AS plannedEnd,duration_days AS durationDays,sort_order AS sortOrder FROM project_baseline_tasks WHERE baseline_id=? ORDER BY sort_order").bind(baseline.id).all();
  const comparisons=await db.prepare(`SELECT b.task_id AS taskId,b.wbs_code AS wbsCode,b.name,b.planned_start AS baselineStart,b.planned_end AS baselineEnd,w.planned_start AS currentStart,w.planned_end AS currentEnd,(CAST(NULLIF(w.planned_end,'') AS date)-CAST(NULLIF(b.planned_end,'') AS date)) AS delayDays FROM project_baseline_tasks b LEFT JOIN wbs_tasks w ON w.id=b.task_id AND w.project_id=? WHERE b.baseline_id=? ORDER BY b.sort_order`).bind(projectId,baseline.id).all();
  const rows=(comparisons.results??[]) as Array<{baselineStart?:string;baselineEnd?:string;currentStart?:string;currentEnd?:string;delayDays?:number}>;
  const changed=rows.filter(row=>row.baselineStart!==row.currentStart||row.baselineEnd!==row.currentEnd),delayed=rows.filter(row=>Number(row.delayDays)>0),ahead=rows.filter(row=>Number(row.delayDays)<0);
  return Response.json({baseline,tasks:tasks.results??[],comparisons:rows,summary:{changed:changed.length,delayed:delayed.length,ahead:ahead.length,maxDelayDays:Math.max(0,...delayed.map(row=>Number(row.delayDays)||0))}});
}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,db=await runtimeDb();await ensureBaselineTables(db);
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole))return Response.json({error:"PM 또는 PL만 Baseline을 등록할 수 있습니다."},{status:403});
  const project=await db.prepare("SELECT id,status FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first() as {id:string;status:string}|null;
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  if(project.status==="preparing")return Response.json({error:"준비 중 프로젝트는 시작 시 Baseline이 자동 생성됩니다."},{status:409});
  const existing=await db.prepare("SELECT id,version,name,captured_at AS capturedAt FROM project_baselines WHERE project_id=? AND is_active=1 ORDER BY version DESC LIMIT 1").bind(projectId).first();
  if(existing)return Response.json({baseline:existing,created:false});
  const count=await db.prepare("SELECT COUNT(*) AS count FROM project_baselines WHERE project_id=?").bind(projectId).first() as {count:number}|null;
  const version=Number(count?.count||0)+1,id=crypto.randomUUID(),now=Math.floor(Date.now()/1000);
  const tasks=await db.prepare("SELECT id,wbs_code AS wbsCode,name,planned_start AS plannedStart,planned_end AS plannedEnd,duration_days AS durationDays,sort_order AS sortOrder FROM wbs_tasks WHERE project_id=? ORDER BY sort_order").bind(projectId).all();
  if(!(tasks.results??[]).length)return Response.json({error:"Baseline으로 저장할 WBS가 없습니다."},{status:422});
  await db.batch([
    db.prepare("INSERT INTO project_baselines (id,project_id,version,name,captured_at,captured_by,is_active) VALUES (?,?,?,?,?,?,1)").bind(id,projectId,version,`기존 프로젝트 초기 Baseline v${version}`,now,context.userId),
    ...(tasks.results??[]).map((task:any)=>db.prepare("INSERT INTO project_baseline_tasks (baseline_id,task_id,wbs_code,name,planned_start,planned_end,duration_days,sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(id,task.id,task.wbsCode,task.name,task.plannedStart||null,task.plannedEnd||null,Number(task.durationDays)||1,Number(task.sortOrder)||0)),
  ]);
  return Response.json({baseline:{id,version,name:`기존 프로젝트 초기 Baseline v${version}`,capturedAt:now},created:true});
}
