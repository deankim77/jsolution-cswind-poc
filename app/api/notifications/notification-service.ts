/* eslint-disable @typescript-eslint/no-explicit-any */

type D1Statement={bind:(...values:unknown[])=>D1Statement;first:<T=any>()=>Promise<T|null>;all:<T=any>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
export type NotificationD1={prepare:(sql:string)=>D1Statement};
export type NotificationCandidate={kind:"review"|"delayed"|"deliverable";taskId:string;projectId:string;projectCode:string;projectName:string;wbsCode:string;title:string;dueDate?:string;message:string;createdAt:number};

let foundationReady:Promise<void>|null=null;
export const ensureNotificationFoundation=(db:NotificationD1)=>foundationReady??=(Promise.all([
  db.prepare(`CREATE TABLE IF NOT EXISTS user_notifications (
    id TEXT PRIMARY KEY NOT NULL,
    company_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    project_id TEXT,
    task_id TEXT,
    event_key TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    due_date TEXT,
    read_at INTEGER,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run(),
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_event_uq ON user_notifications(user_id,event_key)").run(),
  db.prepare("CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx ON user_notifications(user_id,resolved_at,read_at,created_at DESC)").run(),
  db.prepare("CREATE INDEX IF NOT EXISTS user_notifications_entity_idx ON user_notifications(user_id,entity_type,entity_id,resolved_at)").run(),
]).then(()=>undefined).catch(reason=>{foundationReady=null;throw reason}));

export async function notificationCandidates(db:NotificationD1,companyId:string,userId:string):Promise<NotificationCandidate[]>{
  const result=await db.prepare(`SELECT * FROM (
    SELECT 'review' AS kind,w.id AS taskId,p.id AS projectId,p.code AS projectCode,p.name AS projectName,w.wbs_code AS wbsCode,w.name AS title,w.planned_end AS dueDate,w.updated_at AS createdAt,
      CASE WHEN w.completion_actor='PM' THEN 'PM 완료 승인 대기' ELSE 'PL·PM 완료 승인 대기' END AS message,0 AS priority
      FROM wbs_tasks w JOIN projects p ON p.id=w.project_id JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=?
      WHERE p.company_id=? AND p.status='active' AND w.kind='task' AND w.status='review' AND ((w.completion_actor='PM' AND pm.project_role='PM') OR (w.completion_actor='PL' AND pm.project_role IN ('PL','PM')))
    UNION ALL
    SELECT 'delayed',w.id,p.id,p.code,p.name,w.wbs_code,w.name,w.planned_end,w.updated_at,'담당 Task 일정 지연',1
      FROM wbs_tasks w JOIN projects p ON p.id=w.project_id WHERE p.company_id=? AND p.status='active' AND w.kind='task' AND w.assignee_user_id=? AND w.status NOT IN ('completed','review') AND w.planned_end < CURRENT_DATE::text
    UNION ALL
    SELECT 'deliverable',w.id,p.id,p.code,p.name,w.wbs_code,w.name,w.planned_end,w.updated_at,'필수 산출물 미등록',2
      FROM wbs_tasks w JOIN projects p ON p.id=w.project_id WHERE p.company_id=? AND p.status='active' AND w.kind='task' AND w.assignee_user_id=? AND w.status!='completed' AND EXISTS(SELECT 1 FROM deliverables d WHERE d.task_id=w.id AND d.required=1 AND d.status!='submitted')
  ) ORDER BY priority,COALESCE(dueDate,'9999-12-31'),createdAt DESC`).bind(userId,companyId,companyId,userId,companyId,userId).all<NotificationCandidate>();
  return result.results??[];
}

const eventKey=(item:NotificationCandidate)=>`${item.kind}:task:${item.taskId}`;

export async function syncNotifications(db:NotificationD1,companyId:string,userId:string){
  await ensureNotificationFoundation(db);
  const candidates=await notificationCandidates(db,companyId,userId),now=Math.floor(Date.now()/1000);
  const activeKeys=new Set(candidates.map(eventKey));
  for(const item of candidates){
    const key=eventKey(item);
    await db.prepare(`INSERT INTO user_notifications
      (id,company_id,user_id,kind,entity_type,entity_id,project_id,task_id,event_key,title,message,due_date,read_at,resolved_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,?)
      ON CONFLICT(user_id,event_key) DO UPDATE SET
        title=excluded.title,message=excluded.message,due_date=excluded.due_date,project_id=excluded.project_id,task_id=excluded.task_id,
        resolved_at=NULL,updated_at=excluded.updated_at`).bind(
          crypto.randomUUID(),companyId,userId,item.kind,"task",item.taskId,item.projectId,item.taskId,key,item.title,item.message,item.dueDate||null,Number(item.createdAt)||now,now
        ).run();
  }
  const existing=await db.prepare("SELECT event_key AS eventKey FROM user_notifications WHERE user_id=? AND resolved_at IS NULL").bind(userId).all<{eventKey:string}>();
  const stale=(existing.results??[]).map(row=>row.eventKey).filter(key=>!activeKeys.has(key));
  for(const key of stale)await db.prepare("UPDATE user_notifications SET resolved_at=?,updated_at=? WHERE user_id=? AND event_key=? AND resolved_at IS NULL").bind(now,now,userId,key).run();
}

export async function listUnreadNotifications(db:NotificationD1,companyId:string,userId:string,limit=50){
  await syncNotifications(db,companyId,userId);
  const rows=await db.prepare(`SELECT n.id,n.kind,n.task_id AS taskId,n.project_id AS projectId,p.code AS projectCode,p.name AS projectName,w.wbs_code AS wbsCode,n.title,n.due_date AS dueDate,n.message,n.created_at AS createdAt,n.read_at AS readAt
    FROM user_notifications n
    LEFT JOIN projects p ON p.id=n.project_id
    LEFT JOIN wbs_tasks w ON w.id=n.task_id
    WHERE n.company_id=? AND n.user_id=? AND n.resolved_at IS NULL AND n.read_at IS NULL
    ORDER BY n.created_at DESC LIMIT ?`).bind(companyId,userId,limit).all();
  const count=await db.prepare("SELECT COUNT(*) AS count FROM user_notifications WHERE company_id=? AND user_id=? AND resolved_at IS NULL AND read_at IS NULL").bind(companyId,userId).first<{count:number}>();
  return {items:rows.results??[],unreadCount:Number(count?.count||0)};
}

export async function markNotificationRead(db:NotificationD1,companyId:string,userId:string,id:string){
  await ensureNotificationFoundation(db);const now=Math.floor(Date.now()/1000);
  await db.prepare("UPDATE user_notifications SET read_at=COALESCE(read_at,?),updated_at=? WHERE id=? AND company_id=? AND user_id=?").bind(now,now,id,companyId,userId).run();
}

export async function markAllNotificationsRead(db:NotificationD1,companyId:string,userId:string){
  await ensureNotificationFoundation(db);const now=Math.floor(Date.now()/1000);
  await db.prepare("UPDATE user_notifications SET read_at=COALESCE(read_at,?),updated_at=? WHERE company_id=? AND user_id=? AND resolved_at IS NULL AND read_at IS NULL").bind(now,now,companyId,userId).run();
}
