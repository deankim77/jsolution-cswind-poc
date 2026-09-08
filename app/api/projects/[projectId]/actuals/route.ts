import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};

async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
async function ensureActualTable(db:D1){
  await db.prepare(`CREATE TABLE IF NOT EXISTS task_actuals (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    actual_date TEXT NOT NULL,
    actual_hours REAL NOT NULL DEFAULT 0,
    progress INTEGER NOT NULL DEFAULT 0,
    work_note TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(task_id) REFERENCES wbs_tasks(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS task_actuals_project_task_idx ON task_actuals(project_id, task_id, actual_date)").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_gate_decisions (
    id TEXT PRIMARY KEY NOT NULL,project_id TEXT NOT NULL,gate_task_id TEXT NOT NULL,gate_code TEXT NOT NULL,
    decision TEXT NOT NULL,note TEXT,decided_by TEXT NOT NULL,decided_at INTEGER NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS project_gate_decisions_project_gate_idx ON project_gate_decisions(project_id,gate_code,decided_at)").run();
}

type RollupTask={id:string;parentId?:string|null;kind:string;durationDays:number;progress:number;status:string;level:number};
async function recalculateGroupProgress(db:D1,projectId:string){
  const result=await db.prepare(`SELECT id,parent_id AS parentId,kind,duration_days AS durationDays,progress,status,level FROM wbs_tasks WHERE project_id=? ORDER BY level DESC,sort_order DESC`).bind(projectId).all();
  const tasks=(result.results??[]) as RollupTask[];
  const byId=new Map(tasks.map(task=>[task.id,task]));
  const leaves=tasks.filter(task=>task.kind!=="summary");
  const now=Math.floor(Date.now()/1000);
  const updates:any[]=[];
  const isDescendant=(leaf:RollupTask,groupId:string)=>{let parent=leaf.parentId||null;const guard=new Set<string>();while(parent&&!guard.has(parent)){if(parent===groupId)return true;guard.add(parent);parent=byId.get(parent)?.parentId||null;}return false;};
  for(const group of tasks.filter(task=>task.kind==="summary")){
    const descendants=leaves.filter(leaf=>isDescendant(leaf,group.id));
    if(!descendants.length)continue;
    const totalWeight=descendants.reduce((sum,leaf)=>sum+Math.max(1,Number(leaf.durationDays)||1),0);
    const weighted=descendants.reduce((sum,leaf)=>sum+(Math.max(0,Math.min(100,Number(leaf.progress)||0))*Math.max(1,Number(leaf.durationDays)||1)),0);
    const progress=Math.round(weighted/Math.max(1,totalWeight));
    const completed=descendants.every(leaf=>leaf.status==="completed"||Number(leaf.progress)>=100);
    const active=descendants.some(leaf=>leaf.status==="active"||(Number(leaf.progress)>0&&Number(leaf.progress)<100));
    const status=completed?"completed":active||progress>0?"active":"planned";
    group.progress=progress;group.status=status;
    updates.push(db.prepare("UPDATE wbs_tasks SET progress=?,status=?,updated_at=? WHERE id=? AND project_id=?").bind(progress,status,now,group.id,projectId));
  }
  if(updates.length)await db.batch(updates);
}

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;const db=await runtimeDb();await ensureActualTable(db);
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  const project=await db.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  await recalculateGroupProgress(db,projectId);
  const rows=await db.prepare(`SELECT t.id AS taskId,
    MIN(a.actual_date) AS actualStart,
    MAX(CASE WHEN a.completed=1 THEN a.actual_date END) AS actualEnd,
    MAX(a.actual_date) AS latestActualDate,
    COALESCE((SELECT a2.progress FROM task_actuals a2 WHERE a2.project_id=t.project_id AND a2.task_id=t.id ORDER BY a2.actual_date DESC,a2.created_at DESC LIMIT 1),t.progress) AS latestProgress,
    COALESCE(SUM(a.actual_hours),0) AS totalHours,
    (SELECT COUNT(*) FROM project_issues i WHERE i.project_id=t.project_id AND i.task_id=t.id AND i.status NOT IN ('resolved','closed')) AS issueCount
    FROM wbs_tasks t LEFT JOIN task_actuals a ON a.task_id=t.id AND a.project_id=t.project_id
    WHERE t.project_id=? GROUP BY t.id,t.project_id,t.progress`).bind(projectId).all();
  return Response.json({summaries:rows.results??[]});
}

type Input={taskId?:string;action?:"start"|"approve"|"reject";actualDate?:string;actualHours?:number;progress?:number;workNote?:string;completed?:boolean;completionConfirmed?:boolean};
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;const db=await runtimeDb();await ensureActualTable(db);const input=await request.json() as Input;
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!input.taskId)return Response.json({error:"Task가 필요합니다."},{status:400});
  const project=await db.prepare("SELECT id,status,company_id AS companyId FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first() as {id:string;status:string;companyId:string}|null;
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  const warnings:string[]=[];
  if(project.status==="preparing")warnings.push("준비 중 프로젝트에서 테스트/업무 처리를 진행했습니다.");
  if(project.status==="stopped")warnings.push("중단 상태 프로젝트에서 업무 처리를 진행했습니다.");
  const task=await db.prepare("SELECT id,kind,task_type AS taskType,status,progress,assignee_user_id AS assigneeUserId,completion_actor AS completionActor,completion_criteria AS completionCriteria FROM wbs_tasks WHERE id=? AND project_id=?").bind(input.taskId,projectId).first() as {id:string;kind:string;taskType:string;status:string;progress:number;assigneeUserId?:string;completionActor?:string;completionCriteria?:string}|null;
  if(!task)return Response.json({error:"Task를 찾을 수 없습니다."},{status:404});
  if(task.kind==="summary")return Response.json({error:"그룹 WBS에는 실적을 입력할 수 없습니다."},{status:400});
  if(task.status==="planned"){
    const predecessor=await db.prepare(`SELECT p.id,p.name,p.task_type AS taskType,p.status,
      (SELECT decision FROM project_gate_decisions g WHERE g.project_id=p.project_id AND g.gate_task_id=p.id ORDER BY g.decided_at DESC,g.id DESC LIMIT 1) AS gateDecision
      FROM wbs_tasks current JOIN wbs_tasks p ON p.id=current.predecessor_id WHERE current.id=? AND current.project_id=?`).bind(task.id,projectId).first() as {id:string;name:string;taskType:string;status:string;gateDecision?:string}|null;
    if(predecessor?.taskType==="gate"&&!['PASS','CONDITIONAL_PASS'].includes(predecessor.gateDecision||""))warnings.push(`선행 Gate '${predecessor.name}'가 아직 승인 완료되지 않았습니다.`);
    if(predecessor&&predecessor.taskType!=="gate"&&predecessor.status!=="completed")warnings.push(`선행 Task '${predecessor.name}'가 아직 완료되지 않았습니다.`);
  }
  const now=Math.floor(Date.now()/1000);const actualDate=input.actualDate||new Date().toISOString().slice(0,10);
  if(input.action==="start"){
    if(task.assigneeUserId!==context.userId)return Response.json({error:"담당자 본인만 Task를 시작할 수 있습니다."},{status:403});
    if(task.status==="completed")return Response.json({error:"완료된 Task는 다시 시작할 수 없습니다."},{status:409});
    await db.batch([
      db.prepare("UPDATE wbs_tasks SET status='active',updated_at=? WHERE id=? AND project_id=?").bind(now,task.id,projectId),
      db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,"TASK_STARTED","WBS_TASK",task.id,JSON.stringify({projectId,actualDate,warnings}),now),
    ]);
    await recalculateGroupProgress(db,projectId);
    return Response.json({ok:true,status:"active",progress:task.progress,warnings,message:warnings.length?`Task를 시작했습니다. 확인: ${warnings.join(" / ")}`:"Task를 시작했습니다."});
  }
  if(input.action==="approve"||input.action==="reject"){
    if(task.taskType==="gate")return Response.json({error:"Gate 완료는 Gate Review에서 PASS 또는 조건부 승인을 등록해 주세요.",code:"GATE_DECISION_REQUIRED"},{status:409});
    if(task.status!=="review")return Response.json({error:"완료 검토 대기 중인 Task가 아닙니다."},{status:409});
    if(!canManageProject(context,access.projectRole))return Response.json({error:"PM 또는 PL만 완료를 승인하거나 보완 요청할 수 있습니다."},{status:403});
    const actor=task.completionActor||"assignee";const allowed=actor==="PM"?access.projectRole==="PM"||access.isAdmin:actor==="PL"?["PM","PL"].includes(access.projectRole||"")||access.isAdmin:true;
    if(!allowed)return Response.json({error:`${actor} 권한이 있는 참여자만 완료를 승인하거나 보완 요청할 수 있습니다.`},{status:403});
    if(input.action==="reject"&&!input.workNote?.trim())return Response.json({error:"보완 요청 사유를 입력해 주세요."},{status:400});
    const approved=input.action==="approve";const nextStatus=approved?"completed":"active";const nextProgress=approved?100:Math.min(95,Math.max(1,Number(task.progress)||95));
    await db.batch([
      db.prepare("UPDATE wbs_tasks SET progress=?,status=?,updated_at=? WHERE id=? AND project_id=?").bind(nextProgress,nextStatus,now,task.id,projectId),
      db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),context.companyId,context.userId,approved?"TASK_COMPLETION_APPROVED":"TASK_COMPLETION_REJECTED","WBS_TASK",task.id,JSON.stringify({projectId,note:input.workNote?.trim()||null,completionActor:actor,warnings}),now),
    ]);
    await recalculateGroupProgress(db,projectId);
    return Response.json({ok:true,status:nextStatus,progress:nextProgress,warnings,message:approved?"Task 완료를 승인했습니다.":"보완 요청으로 Task를 진행 중 상태로 전환했습니다."});
  }
  if(task.assigneeUserId!==context.userId)return Response.json({error:"담당자 본인만 Task 실적을 등록할 수 있습니다."},{status:403});
  const rawProgress=Math.max(0,Math.min(100,Number(input.progress)||0));const gateTask=task.taskType==="gate";const completed=Boolean(input.completed)||rawProgress>=100;const nextProgress=completed?100:rawProgress;const nextStatus=completed?"completed":nextProgress>0?"active":task.status==="planned"?"active":task.status;
  if(completed){
    if(!input.completionConfirmed)return Response.json({error:"완료 조건을 확인한 뒤 Task 완료를 저장해 주세요."},{status:400});
    const known=new Set(["PROGRESS","REQUIRED_UPLOAD","REQUIRED_APPROVAL","CHILD_COMPLETE","GATE_APPROVAL","OWNER_CONFIRM"]),parsed=new Set((task.completionCriteria||"").split(",").map(value=>value.trim()).filter(value=>known.has(value)));if(!parsed.size){parsed.add("PROGRESS");parsed.add("REQUIRED_UPLOAD")}
    if(parsed.has("REQUIRED_UPLOAD")||parsed.has("REQUIRED_APPROVAL")){const accepted=parsed.has("REQUIRED_APPROVAL")?"('approved','completed')":"('submitted','approved','completed')";const missing=await db.prepare(`SELECT name FROM deliverables WHERE project_id=? AND task_id=? AND required=1 AND status NOT IN ${accepted} ORDER BY created_at`).bind(projectId,task.id).all();const names=(missing.results??[]).map((item:{name?:string})=>item.name).filter(Boolean);if(names.length)warnings.push(`${parsed.has("REQUIRED_APPROVAL")?"필수 산출물 승인 미완료":"필수 산출물 미등록"}: ${names.join(", ")}`)}
    if(parsed.has("CHILD_COMPLETE")){const children=await db.prepare("SELECT name FROM wbs_tasks WHERE project_id=? AND parent_id=? AND kind<>'summary' AND status<>'completed' ORDER BY sort_order").bind(projectId,task.id).all();const names=(children.results??[]).map((item:{name?:string})=>item.name).filter(Boolean);if(names.length)warnings.push(`하위 업무 미완료: ${names.join(", ")}`)}
  }
  const completionActor=task.completionActor||"assignee";const requiresReview=completed&&!gateTask&&["PM","PL"].includes(completionActor);const storedCompleted=completed&&!requiresReview;const storedStatus=requiresReview?"review":nextStatus;
  const id=crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO task_actuals (id,project_id,task_id,user_id,actual_date,actual_hours,progress,work_note,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,projectId,task.id,context.userId,actualDate,Math.max(0,Number(input.actualHours)||0),nextProgress,input.workNote?.trim()||null,storedCompleted?1:0,now,now),
    db.prepare("UPDATE wbs_tasks SET progress=?,status=?,updated_at=? WHERE id=? AND project_id=?").bind(nextProgress,storedStatus,now,task.id,projectId),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),context.companyId,context.userId,gateTask&&completed?"GATE_TASK_COMPLETED":gateTask?"GATE_ACTUAL_RECORDED":requiresReview?"TASK_COMPLETION_REQUESTED":completed?"TASK_COMPLETED":"TASK_ACTUAL_RECORDED","WBS_TASK",task.id,JSON.stringify({projectId,actualId:id,actualDate,actualHours:Math.max(0,Number(input.actualHours)||0),progress:nextProgress,workNote:input.workNote?.trim()||null,completionActor,warnings}),now),
  ]);
  await recalculateGroupProgress(db,projectId);
  const baseMessage=gateTask&&completed?"Gate Task를 완료했습니다.":gateTask?"Gate 실적을 저장했습니다.":requiresReview?`${task.completionActor} 완료 검토를 요청했습니다.`:completed?"Task를 완료했습니다.":"실적을 저장했습니다.";
  return Response.json({ok:true,id,status:storedStatus,progress:nextProgress,warnings,message:warnings.length?`${baseMessage} 확인: ${warnings.join(" / ")}`:baseMessage});
}
