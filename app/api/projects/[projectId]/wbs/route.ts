import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
import { ensureProjectDataFoundation, type RuntimeD1 } from "../../../../../db/project-data-foundation";
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";

/* eslint-disable @typescript-eslint/no-explicit-any */
type D1 = RuntimeD1;
type DeliverableInput = { id?: string; name: string; type?: string; required?: boolean; documentKind?: "document"|"drawing" };
type WbsInput = {
  id?: string;
  clientKey: string;
  wbsCode: string;
  level: number;
  name: string;
  taskType?: string;
  durationDays?: number;
  plannedStart?: string;
  plannedEnd?: string;
  predecessorClientKey?: string;
  roleCode?: string;
  assigneeUserId?: string;
  completionActor?: string;
  completionCriteria?: string;
  deliverables?: DeliverableInput[];
};
type WbsCacheEntry={expiresAt:number;data:any};

const DAY=86_400_000;
const WBS_CACHE_MS=5_000;
const wbsCache=new Map<string,WbsCacheEntry>();
const wbsInflight=new Map<string,Promise<any>>();
const wbsGeneration=new Map<string,number>();
const isoDate=(value:Date)=>value.toISOString().slice(0,10);
const isBusinessDay=(value:Date)=>{const day=value.getUTCDay();return day!==0&&day!==6;};
const toBusinessDate=(value:string)=>{const date=new Date(`${value}T00:00:00Z`);while(!isBusinessDay(date))date.setUTCDate(date.getUTCDate()+1);return isoDate(date);};
const moveBusinessDays=(value:string,days:number)=>{const date=new Date(`${value}T00:00:00Z`);let remaining=Math.abs(days),direction=days<0?-1:1;while(remaining){date.setUTCDate(date.getUTCDate()+direction);if(isBusinessDay(date))remaining--;}return isoDate(date);};
const nextBusinessDate=(value:string)=>moveBusinessDays(value,1);
const endFromDuration=(start:string,durationDays:number)=>moveBusinessDays(start,Math.max(1,Number(durationDays)||1)-1);
const cacheKeyFor=(companyId:string,projectId:string)=>`${companyId}:${projectId}`;
const invalidateWbsCache=(companyId:string,projectId:string)=>{const key=cacheKeyFor(companyId,projectId);wbsGeneration.set(key,(wbsGeneration.get(key)||0)+1);wbsCache.delete(key)};

async function runtimeDb(): Promise<D1> {
  return getLegacyDbCompat() as D1;
}

async function projectFor(db: D1, projectId: string,companyId:string) {
  return db.prepare(
    "SELECT id,company_id AS companyId,code,name,customer_name AS customerName,start_date AS startDate,end_date AS endDate,status,template_snapshot AS templateSnapshot FROM projects WHERE id=? AND company_id=?",
  ).bind(projectId,companyId).first();
}

async function readWbs(db:D1,project:any) {
  const [tasks,outputs,roles,members]=await Promise.all([
    db.prepare(`SELECT w.id,w.wbs_code AS wbsCode,w.parent_id AS parentId,parent.wbs_code AS parentCode,w.level,w.sort_order AS sortOrder,w.kind,w.name,w.task_type AS taskType,w.duration_days AS durationDays,w.planned_start AS plannedStart,w.planned_end AS plannedEnd,w.predecessor_id AS predecessorId,p.wbs_code AS predecessorCode,w.role_code AS roleCode,w.assignee_user_id AS assigneeUserId,u.name AS assigneeName,w.progress,w.status,w.completion_actor AS completionActor,w.completion_criteria AS completionCriteria FROM wbs_tasks w LEFT JOIN wbs_tasks p ON p.id=w.predecessor_id LEFT JOIN wbs_tasks parent ON parent.id=w.parent_id LEFT JOIN users u ON u.id=w.assignee_user_id WHERE w.project_id=? ORDER BY w.sort_order`).bind(project.id).all(),
    db.prepare("SELECT id,task_id AS taskId,name,category AS type,required,status,COALESCE(document_kind,'document') AS documentKind FROM deliverables WHERE project_id=? ORDER BY created_at").bind(project.id).all(),
    db.prepare("SELECT code,name,sort_order AS sortOrder FROM project_roles WHERE project_id=? ORDER BY sort_order,code").bind(project.id).all(),
    db.prepare(`SELECT pm.user_id AS userId,u.name,pm.project_role AS projectRole FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=? ORDER BY u.name`).bind(project.id).all(),
  ]);
  const deliverablesByTask=new Map<string,unknown[]>();
  for(const item of outputs.results as any[]){const list=deliverablesByTask.get(item.taskId)??[];list.push(item);deliverablesByTask.set(item.taskId,list);}
  return {project,tasks:(tasks.results as any[]).map(task=>({...task,deliverables:deliverablesByTask.get(task.id)??[]})),roles:roles.results,members:members.results};
}

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}) {
  const {projectId}=await params;
  const db=await runtimeDb();
  await ensureProjectDataFoundation(db);
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  const project=await projectFor(db,projectId,context.companyId);
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  const key=cacheKeyFor(context.companyId,projectId),now=Date.now(),cached=wbsCache.get(key);
  if(cached&&cached.expiresAt>now)return Response.json(cached.data,{headers:{"x-wbs-cache":"hit"}});
  const existing=wbsInflight.get(key);if(existing){const data=await existing;return Response.json(data,{headers:{"x-wbs-cache":"shared"}})}
  const generation=wbsGeneration.get(key)||0;
  const build=readWbs(db,project);wbsInflight.set(key,build);
  try{const data=await build;if((wbsGeneration.get(key)||0)===generation)wbsCache.set(key,{expiresAt:Date.now()+WBS_CACHE_MS,data});return Response.json(data,{headers:{"x-wbs-cache":"miss"}})}finally{if(wbsInflight.get(key)===build)wbsInflight.delete(key)}
}

export async function PUT(request:Request,{params}:{params:Promise<{projectId:string}>}) {
  const {projectId}=await params;
  const db=await runtimeDb();
  await ensureProjectDataFoundation(db);
  const localDemoSeed=request.headers.get("x-demo-seed")==="jsolution-local-demo"&&["localhost","127.0.0.1"].includes(new URL(request.url).hostname);
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,!localDemoSeed)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole))return Response.json({error:"PM 또는 PL만 WBS 계획을 편집할 수 있습니다."},{status:403});
  const project=await projectFor(db,projectId,context.companyId);
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  const demoSeed=localDemoSeed&&project.code.endsWith("-DEMO")&&context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));
  const preservePlanDates=demoSeed&&request.headers.get("x-demo-schedule")==="preserve-plan-dates";
  if(project.status!=="preparing"&&!demoSeed)return Response.json({error:"준비 상태의 프로젝트만 WBS 계획을 편집할 수 있습니다."},{status:409});

  const input=await request.json() as {tasks?:WbsInput[];projectStart?:string;projectEnd?:string};
  const tasks=input.tasks??[];
  if(preservePlanDates&&(!input.projectStart||!input.projectEnd||input.projectStart>input.projectEnd))return Response.json({error:"데모 프로젝트 기간이 올바르지 않습니다."},{status:400});
  if(tasks.some(task=>!task.clientKey?.trim()||!task.wbsCode?.trim()||!task.name?.trim()))return Response.json({error:"WBS 코드와 Task명은 필수입니다."},{status:400});
  if(new Set(tasks.map(task=>task.clientKey)).size!==tasks.length)return Response.json({error:"중복된 WBS 식별자가 있습니다."},{status:400});
  if(new Set(tasks.map(task=>task.wbsCode.trim())).size!==tasks.length)return Response.json({error:"WBS 코드가 중복되었습니다."},{status:400});
  for(let index=0;index<tasks.length;index++){
    const level=Math.max(1,Math.min(5,Number(tasks[index].level)||1));
    if(index===0&&level!==1)return Response.json({error:"첫 WBS는 1레벨이어야 합니다."},{status:400});
    if(index>0&&level>Math.max(1,Number(tasks[index-1].level)||1)+1)return Response.json({error:`${tasks[index].wbsCode}의 레벨이 바로 앞 WBS보다 두 단계 이상 깊습니다.`},{status:400});
  }

  const existingTasks=await db.prepare("SELECT id,wbs_code AS wbsCode FROM wbs_tasks WHERE project_id=?").bind(projectId).all();
  const existingTaskIds=new Set((existingTasks.results as any[]).map(item=>item.id as string));
  if(tasks.some(task=>task.id&&!existingTaskIds.has(task.id)))return Response.json({error:"다른 프로젝트의 WBS가 포함되어 저장을 중단했습니다."},{status:400});
  const roles=await db.prepare("SELECT code FROM project_roles WHERE project_id=?").bind(projectId).all();
  const roleCodes=new Set((roles.results as any[]).map(item=>item.code as string));
  if(tasks.some(task=>task.roleCode&&!roleCodes.has(task.roleCode)))return Response.json({error:"프로젝트에 등록되지 않은 담당 ROLE이 포함되어 있습니다."},{status:400});
  const members=await db.prepare("SELECT user_id AS userId FROM project_members WHERE project_id=?").bind(projectId).all();
  const memberIds=new Set((members.results as any[]).map(item=>item.userId as string));
  if(tasks.some(task=>task.assigneeUserId&&!memberIds.has(task.assigneeUserId)))return Response.json({error:"프로젝트 참여자가 아닌 담당자가 포함되어 있습니다."},{status:400});

  const keyToTask=new Map(tasks.map(task=>[task.clientKey,task]));
  const hasChild=tasks.map((task,index)=>Boolean(tasks[index+1]&&Number(tasks[index+1].level)>Number(task.level)));
  const allowedCompletionActors=new Set(["assignee","PL","PM"]);
  for(let index=0;index<tasks.length;index++){
    if(hasChild[index])continue;
    const actor=tasks[index].completionActor||"assignee";
    if(!allowedCompletionActors.has(actor))return Response.json({error:`${tasks[index].wbsCode}의 완료 승인 주체가 올바르지 않습니다.`},{status:400});
    if((tasks[index].taskType||"normal")==="gate"&&!["PL","PM"].includes(actor))return Response.json({error:`${tasks[index].wbsCode} Gate Task는 PL 또는 PM 승인이 필요합니다.`},{status:400});
  }
  for(let index=0;index<tasks.length;index++){
    const predecessorKey=tasks[index].predecessorClientKey;
    if(!predecessorKey)continue;
    const predecessor=keyToTask.get(predecessorKey);
    if(!predecessor||predecessorKey===tasks[index].clientKey)return Response.json({error:`${tasks[index].wbsCode}의 선행 Task가 올바르지 않습니다.`},{status:400});
    const predecessorIndex=tasks.findIndex(task=>task.clientKey===predecessorKey);
    if(hasChild[predecessorIndex])return Response.json({error:"그룹 WBS는 선행 Task로 지정할 수 없습니다."},{status:400});
  }
  const visiting=new Set<string>();const visited=new Set<string>();
  const hasCycle=(key:string):boolean=>{if(visiting.has(key))return true;if(visited.has(key))return false;visiting.add(key);const predecessor=keyToTask.get(key)?.predecessorClientKey;if(predecessor&&hasCycle(predecessor))return true;visiting.delete(key);visited.add(key);return false;};
  if(tasks.some(task=>hasCycle(task.clientKey)))return Response.json({error:"선행 Task가 순환 연결되어 있습니다."},{status:400});

  // FS(완료 후 시작)를 기본 관계로 사용한다. 선행 Task가 지정되면 후행 계획은
  // 선행 종료 다음 영업일부터 시작하고, 종료일은 소요일을 기준으로 다시 계산한다.
  const autoScheduledKeys=new Set<string>();
  if(!preservePlanDates){
    for(let pass=0;pass<tasks.length;pass++){
      let changed=false;
      for(let index=0;index<tasks.length;index++){
        if(hasChild[index])continue;
        const task=tasks[index],predecessor=task.predecessorClientKey?keyToTask.get(task.predecessorClientKey):undefined;
        const plannedStart=task.plannedStart?toBusinessDate(task.plannedStart):undefined;
        const dependencyStart=predecessor?.plannedEnd?nextBusinessDate(predecessor.plannedEnd):undefined;
        const start=plannedStart&&dependencyStart?(plannedStart>dependencyStart?plannedStart:dependencyStart):plannedStart||dependencyStart;
        if(!start)continue;
        const end=endFromDuration(start,Math.max(1,Number(task.durationDays)||1));
        if(task.plannedStart!==start||task.plannedEnd!==end){task.plannedStart=start;task.plannedEnd=end;changed=true;autoScheduledKeys.add(task.clientKey);}
      }
      if(!changed)break;
    }
  }
  for(const task of tasks){
    if(task.plannedStart&&task.plannedEnd&&task.plannedStart>task.plannedEnd)return Response.json({error:`${task.wbsCode}의 종료일이 시작일보다 빠릅니다.`},{status:400});
  }
  const autoScheduledCount=autoScheduledKeys.size;

  const ids=new Map(tasks.map(task=>[task.clientKey,task.id||crypto.randomUUID()]));
  const parentKeys=tasks.map((task,index)=>{for(let cursor=index-1;cursor>=0;cursor--)if(Number(tasks[cursor].level)<Number(task.level))return tasks[cursor].clientKey;return null;});
  const desiredTaskIds=new Set(ids.values());
  const removedTaskIds=[...existingTaskIds].filter(id=>!desiredTaskIds.has(id));
  for(const removedId of removedTaskIds){
    const linked=await db.prepare(`SELECT (SELECT COUNT(*) FROM project_issues WHERE project_id=? AND task_id=?)+(SELECT COUNT(*) FROM project_documents WHERE project_id=? AND task_id=?) AS count`).bind(projectId,removedId,projectId,removedId).first() as {count:number}|null;
    if(Number(linked?.count))return Response.json({error:"실적·이슈·문서가 연결된 WBS는 삭제할 수 없습니다."},{status:409});
  }

  const existingDeliverables=await db.prepare("SELECT id,task_id AS taskId FROM deliverables WHERE project_id=?").bind(projectId).all();
  const existingDeliverableIds=new Set((existingDeliverables.results as any[]).map(item=>item.id as string));
  const incomingDeliverableIds=new Set(tasks.flatMap(task=>(hasChild[tasks.indexOf(task)]?[]:task.deliverables??[]).map(item=>item.id).filter(Boolean) as string[]));
  if([...incomingDeliverableIds].some(id=>!existingDeliverableIds.has(id)))return Response.json({error:"다른 프로젝트의 산출물이 포함되어 저장을 중단했습니다."},{status:400});

  const now=Math.floor(Date.now()/1000);
  const statements:any[]=[];
  for(const task of tasks.filter(task=>task.id))statements.push(db.prepare("UPDATE wbs_tasks SET wbs_code=? WHERE id=? AND project_id=?").bind(`__editing__${task.id}`,task.id,projectId));
  for(const id of existingDeliverableIds)if(!incomingDeliverableIds.has(id))statements.push(db.prepare("DELETE FROM deliverables WHERE id=? AND project_id=?").bind(id,projectId));
  for(const id of removedTaskIds)statements.push(db.prepare("DELETE FROM wbs_tasks WHERE id=? AND project_id=?").bind(id,projectId));

  tasks.forEach((task,index)=>{
    const id=ids.get(task.clientKey)!;
    const group=hasChild[index];
    const duration=group?0:Math.max(1,Number(task.durationDays)||1);
    const values=[task.wbsCode.trim(),parentKeys[index]?ids.get(parentKeys[index]!)!:null,Math.max(1,Math.min(5,Number(task.level)||1)),index,group?"summary":"task",task.name.trim(),group?"normal":task.taskType||"normal",duration,task.plannedStart||null,task.plannedEnd||null,task.predecessorClientKey?ids.get(task.predecessorClientKey)??null:null,group?null:task.roleCode||null,group?null:task.assigneeUserId||null,task.completionActor||"assignee",task.completionCriteria||null,now];
    if(task.id){
      statements.push(db.prepare(`UPDATE wbs_tasks SET wbs_code=?,parent_id=?,level=?,sort_order=?,kind=?,name=?,task_type=?,duration_days=?,planned_start=?,planned_end=?,predecessor_id=?,role_code=?,assignee_user_id=?,completion_actor=?,completion_criteria=?,updated_at=? WHERE id=? AND project_id=?`).bind(...values,id,projectId));
    }else{
      statements.push(db.prepare(`INSERT INTO wbs_tasks (id,project_id,wbs_code,parent_id,level,sort_order,kind,name,task_type,duration_days,planned_start,planned_end,predecessor_id,role_code,assignee_user_id,progress,status,completion_actor,completion_criteria,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'planned',?,?,?,?)`).bind(id,projectId,...values.slice(0,13),values[13],values[14],now,now));
    }
    if(group)return;
    for(const output of task.deliverables??[]){
      if(!output.name?.trim())continue;
      if(output.id)statements.push(db.prepare("UPDATE deliverables SET task_id=?,name=?,category=?,required=?,document_kind=?,updated_at=? WHERE id=? AND project_id=?").bind(id,output.name.trim(),output.type||null,output.required===false?0:1,output.documentKind==="drawing"?"drawing":"document",now,output.id,projectId));
      else statements.push(db.prepare("INSERT INTO deliverables (id,project_id,task_id,name,category,required,status,document_kind,created_at,updated_at) VALUES (?,?,?,?,?,?,'planned',?,?,?)").bind(crypto.randomUUID(),projectId,id,output.name.trim(),output.type||null,output.required===false?0:1,output.documentKind==="drawing"?"drawing":"document",now,now));
    }
  });
  if(preservePlanDates)statements.push(db.prepare("UPDATE projects SET start_date=?,end_date=?,updated_at=? WHERE id=?").bind(input.projectStart,input.projectEnd,now,projectId));
  else statements.push(db.prepare("UPDATE projects SET updated_at=? WHERE id=?").bind(now,projectId));
  statements.push(db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'WBS_UPDATED','PROJECT',?,?,?)").bind(crypto.randomUUID(),project.companyId,context.userId,projectId,JSON.stringify({taskCount:tasks.length,removedTaskCount:removedTaskIds.length,autoScheduledCount,demoSeed}),now));
  await db.batch(statements);
  invalidateWbsCache(project.companyId,projectId);
  return Response.json({ok:true,taskCount:tasks.length,autoScheduledCount,scheduleRule:preservePlanDates?"PRESERVE_PLAN_DATES":"FS_NEXT_BUSINESS_DAY"});
}
