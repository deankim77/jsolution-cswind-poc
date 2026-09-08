/* eslint-disable @typescript-eslint/no-explicit-any */
type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};

async function ensureTables(db:D1){
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS project_wbs_edit_snapshots (project_id text PRIMARY KEY NOT NULL,captured_at integer NOT NULL,captured_by text,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
    db.prepare("CREATE TABLE IF NOT EXISTS project_wbs_edit_snapshot_tasks (project_id text NOT NULL,task_id text NOT NULL,wbs_code text NOT NULL,name text NOT NULL,kind text,planned_start text,planned_end text,duration_days integer NOT NULL,assignee_user_id text,assignee_name text,deliverables_json text,sort_order integer NOT NULL,PRIMARY KEY(project_id,task_id),FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
    db.prepare("CREATE TABLE IF NOT EXISTS project_wbs_change_sets (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,checked_in_at integer NOT NULL,checked_in_by text,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
    db.prepare("CREATE INDEX IF NOT EXISTS project_wbs_change_sets_project_time_idx ON project_wbs_change_sets(project_id,checked_in_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS project_wbs_change_items (id text PRIMARY KEY NOT NULL,change_set_id text NOT NULL,project_id text NOT NULL,task_id text,wbs_code text,task_name text,change_type text NOT NULL,before_value text,after_value text,sort_order integer NOT NULL DEFAULT 0,FOREIGN KEY(change_set_id) REFERENCES project_wbs_change_sets(id) ON DELETE CASCADE,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
    db.prepare("CREATE INDEX IF NOT EXISTS project_wbs_change_items_task_idx ON project_wbs_change_items(project_id,task_id)"),
  ]);
  for(const sql of [
    "ALTER TABLE project_wbs_edit_snapshot_tasks ADD COLUMN kind text",
    "ALTER TABLE project_wbs_edit_snapshot_tasks ADD COLUMN deliverables_json text",
  ]){try{await db.prepare(sql).run()}catch{}}
}

async function readTasks(db:D1,projectId:string){
  const [tasks,outputs]=await Promise.all([
    db.prepare("SELECT w.id,w.wbs_code AS wbsCode,w.name,w.kind,w.planned_start AS plannedStart,w.planned_end AS plannedEnd,w.duration_days AS durationDays,w.assignee_user_id AS assigneeUserId,u.name AS assigneeName,w.sort_order AS sortOrder FROM wbs_tasks w LEFT JOIN users u ON u.id=w.assignee_user_id WHERE w.project_id=? ORDER BY w.sort_order").bind(projectId).all(),
    db.prepare("SELECT id,task_id AS taskId,name,category AS type,required,COALESCE(document_kind,'document') AS documentKind FROM deliverables WHERE project_id=? ORDER BY task_id,created_at,id").bind(projectId).all(),
  ]);
  const byTask=new Map<string,any[]>();
  for(const output of (outputs.results??[]) as any[]){const list=byTask.get(String(output.taskId))??[];list.push({id:output.id,name:output.name,type:output.type||null,required:Boolean(output.required),documentKind:output.documentKind||"document"});byTask.set(String(output.taskId),list)}
  return ((tasks.results??[]) as any[]).map(task=>({...task,deliverables:byTask.get(String(task.id))??[]}));
}

const stableDeliverables=(items:any[])=>[...(items??[])].map(item=>({id:item.id||null,name:item.name||"",type:item.type||null,required:item.required!==false,documentKind:item.documentKind||"document"})).sort((a,b)=>`${a.name}|${a.id}`.localeCompare(`${b.name}|${b.id}`));
const scheduleValue=(task:any)=>JSON.stringify({plannedStart:task.plannedStart||null,plannedEnd:task.plannedEnd||null,durationDays:Number(task.durationDays)||1,kind:task.kind||null});
const assigneeValue=(task:any)=>JSON.stringify({userId:task.assigneeUserId||null,name:task.assigneeName||null});
const taskValue=(task:any)=>JSON.stringify({wbsCode:task.wbsCode||"",name:task.name||"",kind:task.kind||null,plannedStart:task.plannedStart||null,plannedEnd:task.plannedEnd||null,durationDays:Number(task.durationDays)||1,assigneeUserId:task.assigneeUserId||null,assigneeName:task.assigneeName||null,deliverables:stableDeliverables(task.deliverables)});
const outputsValue=(task:any)=>JSON.stringify(stableDeliverables(task.deliverables));

export async function captureWbsCheckoutSnapshot(db:D1,projectId:string,now:number,actorUserId:string){
  await ensureTables(db);
  const tasks=await readTasks(db,projectId);
  await db.batch([
    db.prepare("DELETE FROM project_wbs_edit_snapshot_tasks WHERE project_id=?").bind(projectId),
    db.prepare("DELETE FROM project_wbs_edit_snapshots WHERE project_id=?").bind(projectId),
    db.prepare("INSERT INTO project_wbs_edit_snapshots (project_id,captured_at,captured_by) VALUES (?,?,?)").bind(projectId,now,actorUserId),
    ...tasks.map(task=>db.prepare("INSERT INTO project_wbs_edit_snapshot_tasks (project_id,task_id,wbs_code,name,kind,planned_start,planned_end,duration_days,assignee_user_id,assignee_name,deliverables_json,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(projectId,task.id,task.wbsCode,task.name,task.kind||null,task.plannedStart||null,task.plannedEnd||null,Number(task.durationDays)||1,task.assigneeUserId||null,task.assigneeName||null,outputsValue(task),Number(task.sortOrder)||0)),
  ]);
}

export async function recordWbsCheckinChanges(db:D1,projectId:string,now:number,actorUserId:string){
  await ensureTables(db);
  const snapshot=await db.prepare("SELECT project_id AS projectId FROM project_wbs_edit_snapshots WHERE project_id=?").bind(projectId).first();
  if(!snapshot)return {changeSetId:null,changeCount:0};
  const beforeRows=await db.prepare("SELECT task_id AS id,wbs_code AS wbsCode,name,kind,planned_start AS plannedStart,planned_end AS plannedEnd,duration_days AS durationDays,assignee_user_id AS assigneeUserId,assignee_name AS assigneeName,deliverables_json AS deliverablesJson,sort_order AS sortOrder FROM project_wbs_edit_snapshot_tasks WHERE project_id=? ORDER BY sort_order").bind(projectId).all();
  const before=((beforeRows.results??[]) as any[]).map(task=>({...task,deliverables:(()=>{try{return JSON.parse(task.deliverablesJson||"[]")}catch{return []}})()}));
  const current=await readTasks(db,projectId);
  const beforeMap=new Map(before.map(task=>[String(task.id),task])),currentMap=new Map(current.map(task=>[String(task.id),task]));
  const changes:Array<{taskId:string|null;wbsCode:string;taskName:string;changeType:string;beforeValue:string|null;afterValue:string|null;sortOrder:number}>=[];
  for(const oldTask of before){
    const next=currentMap.get(String(oldTask.id));
    if(!next){changes.push({taskId:String(oldTask.id),wbsCode:oldTask.wbsCode||"",taskName:oldTask.name||"",changeType:"TASK_DELETED",beforeValue:taskValue(oldTask),afterValue:null,sortOrder:Number(oldTask.sortOrder)||0});continue}
    if((oldTask.name||"")!==(next.name||""))changes.push({taskId:String(next.id),wbsCode:next.wbsCode||oldTask.wbsCode||"",taskName:next.name||oldTask.name||"",changeType:"TASK_NAME_CHANGE",beforeValue:String(oldTask.name||""),afterValue:String(next.name||""),sortOrder:Number(next.sortOrder)||0});
    if((oldTask.plannedStart||null)!==(next.plannedStart||null)||(oldTask.plannedEnd||null)!==(next.plannedEnd||null)||Number(oldTask.durationDays||1)!==Number(next.durationDays||1))changes.push({taskId:String(next.id),wbsCode:next.wbsCode||oldTask.wbsCode||"",taskName:next.name||oldTask.name||"",changeType:next.kind==="summary"?"GROUP_SCHEDULE_CHANGE":"SCHEDULE_CHANGE",beforeValue:scheduleValue(oldTask),afterValue:scheduleValue(next),sortOrder:Number(next.sortOrder)||0});
    if((oldTask.assigneeUserId||null)!==(next.assigneeUserId||null))changes.push({taskId:String(next.id),wbsCode:next.wbsCode||oldTask.wbsCode||"",taskName:next.name||oldTask.name||"",changeType:"ASSIGNEE_CHANGE",beforeValue:assigneeValue(oldTask),afterValue:assigneeValue(next),sortOrder:Number(next.sortOrder)||0});
    if(outputsValue(oldTask)!==outputsValue(next))changes.push({taskId:String(next.id),wbsCode:next.wbsCode||oldTask.wbsCode||"",taskName:next.name||oldTask.name||"",changeType:"DELIVERABLE_CHANGE",beforeValue:outputsValue(oldTask),afterValue:outputsValue(next),sortOrder:Number(next.sortOrder)||0});
  }
  for(const next of current)if(!beforeMap.has(String(next.id)))changes.push({taskId:String(next.id),wbsCode:next.wbsCode||"",taskName:next.name||"",changeType:"TASK_ADDED",beforeValue:null,afterValue:taskValue(next),sortOrder:Number(next.sortOrder)||0});
  if(changes.length){
    const changeSetId=crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO project_wbs_change_sets (id,project_id,checked_in_at,checked_in_by) VALUES (?,?,?,?)").bind(changeSetId,projectId,now,actorUserId),
      ...changes.map(change=>db.prepare("INSERT INTO project_wbs_change_items (id,change_set_id,project_id,task_id,wbs_code,task_name,change_type,before_value,after_value,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),changeSetId,projectId,change.taskId,change.wbsCode||null,change.taskName||null,change.changeType,change.beforeValue,change.afterValue,change.sortOrder)),
    ]);
  }
  await db.batch([db.prepare("DELETE FROM project_wbs_edit_snapshot_tasks WHERE project_id=?").bind(projectId),db.prepare("DELETE FROM project_wbs_edit_snapshots WHERE project_id=?").bind(projectId)]);
  return {changeSetId:changes.length?(await db.prepare("SELECT id FROM project_wbs_change_sets WHERE project_id=? ORDER BY checked_in_at DESC LIMIT 1").bind(projectId).first() as any)?.id||null:null,changeCount:changes.length};
}
