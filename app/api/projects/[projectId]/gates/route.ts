import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
const DECISIONS=new Set(["PASS","CONDITIONAL_PASS","REJECT","DEFER"]);
const normalizeGateCode=(value:string)=>String(value||"").replace(/-(?:REVIEW|R)$/i,"");
const gateCompleted=(decision?:string)=>decision==="PASS"||decision==="CONDITIONAL_PASS";
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
async function ensureTables(db:D1){
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_gate_decisions (
    id TEXT PRIMARY KEY NOT NULL,project_id TEXT NOT NULL,gate_task_id TEXT NOT NULL,gate_code TEXT NOT NULL,
    decision TEXT NOT NULL,note TEXT,decided_by TEXT NOT NULL,decided_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id),FOREIGN KEY(gate_task_id) REFERENCES wbs_tasks(id),FOREIGN KEY(decided_by) REFERENCES users(id)
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS project_gate_decisions_project_gate_idx ON project_gate_decisions(project_id,gate_code,decided_at)").run();
}

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,db=await runtimeDb();await ensureTables(db);
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  const project=await db.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  const rows=await db.prepare(`SELECT w.id AS taskId,w.wbs_code AS gateCode,w.name,w.planned_end AS plannedDate,w.status,w.progress,
    d.decision,d.note,d.decided_at AS decidedAt,u.name AS decidedBy,
    (SELECT COUNT(*) FROM wbs_tasks s WHERE s.project_id=w.project_id AND s.parent_id=w.parent_id AND s.id<>w.id AND s.kind<>'summary') AS activityCount,
    (SELECT COUNT(*) FROM wbs_tasks s WHERE s.project_id=w.project_id AND s.parent_id=w.parent_id AND s.id<>w.id AND s.kind<>'summary' AND s.status='completed') AS completedActivityCount,
    (SELECT COUNT(*) FROM deliverables o JOIN wbs_tasks s ON s.id=o.task_id WHERE o.project_id=w.project_id AND s.parent_id=w.parent_id AND o.required=1 AND o.status NOT IN ('approved','completed')) AS missingRequiredDeliverables,
    (SELECT COUNT(*) FROM project_issues i JOIN wbs_tasks s ON s.id=i.task_id WHERE i.project_id=w.project_id AND s.parent_id=w.parent_id AND i.status NOT IN ('resolved','closed','completed')) AS openGateIssues
    FROM wbs_tasks w
    LEFT JOIN project_gate_decisions d ON d.id=(SELECT d2.id FROM project_gate_decisions d2 WHERE d2.project_id=w.project_id AND d2.gate_task_id=w.id ORDER BY d2.decided_at DESC,d2.id DESC LIMIT 1)
    LEFT JOIN users u ON u.id=d.decided_by
    WHERE w.project_id=? AND w.task_type='gate' ORDER BY w.sort_order`).bind(projectId).all();
  const gates=(rows.results??[]).map((row:any)=>({...row,gateCode:normalizeGateCode(row.gateCode)}));
  const stale=gates.filter((gate:any)=>gateCompleted(gate.decision)&&(gate.status!=="completed"||Number(gate.progress)!==100));
  if(stale.length){
    const now=Math.floor(Date.now()/1000);
    await db.batch(stale.map((gate:any)=>db.prepare("UPDATE wbs_tasks SET status='completed',progress=100,updated_at=? WHERE id=? AND project_id=?").bind(now,gate.taskId,projectId)));
    stale.forEach((gate:any)=>{gate.status="completed";gate.progress=100});
  }
  return Response.json({gates});
}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,db=await runtimeDb();await ensureTables(db);const input=await request.json() as {taskId?:string;decision?:string;note?:string};
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole))return Response.json({error:"PM 또는 PL만 Gate 결정을 등록할 수 있습니다."},{status:403});
  const decision=String(input.decision||"").toUpperCase();if(!input.taskId||!DECISIONS.has(decision))return Response.json({error:"Gate Task와 결정 상태를 확인해 주세요."},{status:400});
  if(decision!=="PASS"&&!input.note?.trim())return Response.json({error:"PASS 이외의 Gate 결정에는 검토 의견이 필요합니다."},{status:400});
  const gate=await db.prepare("SELECT id,wbs_code AS wbsCode,parent_id AS parentId,name FROM wbs_tasks WHERE id=? AND project_id=? AND task_type='gate'").bind(input.taskId,projectId).first() as {id:string;wbsCode:string;parentId:string;name:string}|null;
  if(!gate)return Response.json({error:"Gate Task를 찾을 수 없습니다."},{status:404});
  const incomplete=await db.prepare("SELECT wbs_code AS wbsCode,name FROM wbs_tasks WHERE project_id=? AND parent_id=? AND id<>? AND kind<>'summary' AND status<>'completed' ORDER BY sort_order").bind(projectId,gate.parentId,gate.id).all();
  const missing=await db.prepare(`SELECT d.name,w.wbs_code AS wbsCode FROM deliverables d JOIN wbs_tasks w ON w.id=d.task_id WHERE d.project_id=? AND w.parent_id=? AND d.required=1 AND d.status NOT IN ('approved','completed') ORDER BY w.sort_order,d.created_at`).bind(projectId,gate.parentId).all();
  const incompleteTasks=incomplete.results??[],missingDeliverables=missing.results??[];
  const warnings=decision==="PASS"&& (incompleteTasks.length||missingDeliverables.length)
    ? {incompleteTasks,missingDeliverables,message:`미완료 활동 ${incompleteTasks.length}건 · 필수 산출물 미충족 ${missingDeliverables.length}건을 확인하고 승인했습니다.`}
    : null;
  const now=Math.floor(Date.now()/1000),gateCode=normalizeGateCode(gate.wbsCode),completed=gateCompleted(decision);
  await db.batch([
    db.prepare("INSERT INTO project_gate_decisions (id,project_id,gate_task_id,gate_code,decision,note,decided_by,decided_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),projectId,gate.id,gateCode,decision,input.note?.trim()||null,context.userId,now),
    db.prepare("UPDATE wbs_tasks SET status=?,progress=?,updated_at=? WHERE id=? AND project_id=?").bind(completed?"completed":"review",completed?100:95,now,gate.id,projectId),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,"GATE_DECIDED","WBS_TASK",gate.id,JSON.stringify({projectId,gateCode,decision,note:input.note?.trim()||null,warnings}),now),
  ]);
  return Response.json({ok:true,projectId,taskId:gate.id,gateCode,decision,decidedAt:now,warnings});
}
