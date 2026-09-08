import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getChatGPTUser } from "../../chatgpt-auth";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type D1Statement={bind:(...values:unknown[])=>D1Statement;first:<T=any>()=>Promise<T|null>;all:<T=any>()=>Promise<{results:T[]}>};
type D1={prepare:(sql:string)=>D1Statement};
type SummaryRow={total?:number;activeCount?:number;todayCount?:number;delayedCount?:number;reviewCount?:number;deliverableCount?:number;issueCount?:number;openCount?:number};
type ProjectOption={id:string;code:string;name:string};

const PAGE_SIZE=50;
const MAX_PAGE_SIZE=100;

async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as unknown as D1;}

const positiveInteger=(value:string|null,fallback:number)=>{
  const parsed=Number.parseInt(value||"",10);
  return Number.isFinite(parsed)&&parsed>=0?parsed:fallback;
};

export async function GET(request:Request){
  const auth=await getChatGPTUser();
  const db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db,{email:auth?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const user={id:context.userId,email:context.email||auth?.email||"",name:context.name||auth?.displayName||"사용자"};
  const url=new URL(request.url);
  const limit=Math.min(MAX_PAGE_SIZE,Math.max(10,positiveInteger(url.searchParams.get("limit"),PAGE_SIZE)));
  const offset=positiveInteger(url.searchParams.get("offset"),0);
  const query=(url.searchParams.get("q")||"").trim().toLowerCase();
  const scope=url.searchParams.get("scope")||"all";
  const projectId=url.searchParams.get("projectId")||"";
  const statuses=(url.searchParams.get("statuses")||"").split(",").map(value=>value.trim()).filter(Boolean);
  const role=(url.searchParams.get("role")||"").trim().toLowerCase();
  const actions=(url.searchParams.get("actions")||"").split(",").map(value=>value.trim()).filter(Boolean);
  const deliverableStatuses=(url.searchParams.get("deliverableStatuses")||"").split(",").map(value=>value.trim()).filter(value=>["pending","registered"].includes(value));
  const issueTypes=(url.searchParams.get("issueTypes")||"").split(",").map(value=>value.trim()).filter(value=>["issue","risk","collaboration"].includes(value));
  const dueFrom=url.searchParams.get("dueFrom")||"";
  const dueTo=url.searchParams.get("dueTo")||"";
  const today=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("today")||"")?url.searchParams.get("today")!:new Date().toISOString().slice(0,10);
  const includeSummary=url.searchParams.get("includeSummary")!=="0";

  const accessSql=`(
    wt.assignee_user_id=?
    OR (
      wt.status='review'
      AND EXISTS (
        SELECT 1
          FROM project_members pm
         WHERE pm.project_id=wt.project_id
           AND pm.user_id=?
           AND (
             (wt.completion_actor='PM' AND pm.project_role='PM')
             OR (wt.completion_actor='PL' AND pm.project_role IN ('PL','PM'))
           )
      )
    )
  )`;
  const deliverableActionSql=`EXISTS (
    SELECT 1 FROM deliverables d
     WHERE d.task_id=wt.id
       AND (
         (wt.assignee_user_id=(SELECT user_id FROM current_actor) AND d.status IN ('planned','rejected'))
         OR (
           d.status IN ('submitted','reviewed')
           AND EXISTS (
             SELECT 1 FROM project_members pm
              WHERE pm.project_id=wt.project_id
                AND pm.user_id=(SELECT user_id FROM current_actor)
                AND pm.project_role IN ('PM','PL')
           )
         )
       )
  )`;
  const issueActionSql=`EXISTS (
    SELECT 1 FROM project_issues pi
     WHERE pi.task_id=wt.id
       AND pi.owner_user_id=(SELECT user_id FROM current_actor)
       AND pi.status NOT IN ('resolved','closed')
  )`;
  const registeredDeliverableSql="(NULLIF(TRIM(COALESCE(d.file_key,'')),'') IS NOT NULL OR NULLIF(TRIM(COALESCE(d.version,'')),'') IS NOT NULL)";
  const assignedTaskSql="wt.assignee_user_id=(SELECT user_id FROM current_actor) AND wt.status NOT IN ('completed','review')";
  const baseWhere=[accessSql,"wt.kind='task'","p.status!='completed'","wt.status!='completed'"];
  const where=[...baseWhere];
  const summaryWhere=[...baseWhere];
  const values:unknown[]=[user.id,user.id];
  const summaryValues:unknown[]=[user.id,user.id];
  const addCommon=(sql:string,...params:unknown[])=>{where.push(sql);summaryWhere.push(sql);values.push(...params);summaryValues.push(...params)};

  if(query){const keyword=`%${query}%`;addCommon(`(
    LOWER(COALESCE(p.name,'') || ' ' || COALESCE(p.code,'') || ' ' || COALESCE(wt.wbs_code,'') || ' ' || COALESCE(wt.name,'') || ' ' || COALESCE(wt.role_code,'') || ' ' || COALESCE(u.name,'')) LIKE ?
    OR EXISTS (SELECT 1 FROM deliverables sd WHERE sd.task_id=wt.id AND LOWER(COALESCE(sd.name,'')) LIKE ?)
    OR EXISTS (SELECT 1 FROM project_issues si WHERE si.task_id=wt.id AND LOWER(COALESCE(si.title,'') || ' ' || COALESCE(si.description,'')) LIKE ?)
  )`,keyword,keyword,keyword)}
  if(projectId)addCommon("wt.project_id=?",projectId);
  if(statuses.length)addCommon(`wt.status IN (${statuses.map(()=>"?").join(",")})`,...statuses);
  if(role)addCommon("LOWER(COALESCE(wt.role_code,'') || ' ' || COALESCE(u.name,'')) LIKE ?",`%${role}%`);
  if(dueFrom)addCommon("wt.planned_end>=?",dueFrom);
  if(dueTo)addCommon("wt.planned_end<=?",dueTo);
  if(deliverableStatuses.length){
    const deliverableStatusPredicates=deliverableStatuses.map(status=>status==="pending"
      ?`EXISTS (SELECT 1 FROM deliverables d WHERE d.task_id=wt.id AND NOT ${registeredDeliverableSql})`
      :status==="registered"
        ?`EXISTS (SELECT 1 FROM deliverables d WHERE d.task_id=wt.id) AND NOT EXISTS (SELECT 1 FROM deliverables d WHERE d.task_id=wt.id AND NOT ${registeredDeliverableSql})`
        :"").filter(Boolean);
    if(deliverableStatusPredicates.length)where.push(`(${deliverableStatusPredicates.join(" OR ")})`);
  }
  if(issueTypes.length){
    where.push(`EXISTS (
      SELECT 1 FROM project_issues pi
       WHERE pi.task_id=wt.id
         AND pi.owner_user_id=(SELECT user_id FROM current_actor)
         AND pi.status NOT IN ('resolved','closed')
         AND pi.issue_type IN (${issueTypes.map(()=>"?").join(",")})
    )`);
    values.push(...issueTypes);
  }

  if(scope==="review")where.push("wt.status='review'");
  if(scope==="today"){where.push("wt.status NOT IN ('completed','review') AND wt.planned_end=?");values.push(today)}
  if(scope==="active"){where.push("wt.status='active' AND wt.planned_end IS NOT NULL AND wt.planned_end>?");values.push(today)}
  if(scope==="delayed"){where.push("wt.status NOT IN ('completed','review') AND wt.progress<100 AND wt.planned_end IS NOT NULL AND wt.planned_end<?");values.push(today)}
  if(scope==="deliverable")where.push(deliverableActionSql);
  if(scope==="issue")where.push(issueActionSql);

  const actionPredicates=actions.map(action=>action==="task"?assignedTaskSql:action==="review"?"wt.status='review'":action==="deliverable"?deliverableActionSql:action==="issue"?issueActionSql:"").filter(Boolean);
  if(actionPredicates.length)where.push(`(${actionPredicates.join(" OR ")})`);

  const fromSql=`
      FROM wbs_tasks wt
      JOIN projects p ON p.id=wt.project_id
      LEFT JOIN users u ON u.id=wt.assignee_user_id
  `;
  const filteredWhere=`WHERE ${where.join(" AND ")}`;
  const summaryWhereSql=`WHERE ${summaryWhere.join(" AND ")}`;
  const baseValues=[user.id,user.id];
  const baseWhereSql=`WHERE ${baseWhere.join(" AND ")}`;
  const orderSql=scope==="delayed"
    ?"wt.planned_end ASC,p.name,wt.sort_order"
    :scope==="deliverable"
      ?`CASE
          WHEN EXISTS (SELECT 1 FROM deliverables d WHERE d.task_id=wt.id AND wt.assignee_user_id=(SELECT user_id FROM current_actor) AND d.status IN ('planned','rejected')) AND wt.planned_end IS NOT NULL AND wt.planned_end<? THEN 0
          WHEN EXISTS (SELECT 1 FROM deliverables d WHERE d.task_id=wt.id AND wt.assignee_user_id=(SELECT user_id FROM current_actor) AND d.status IN ('planned','rejected')) THEN 1
          ELSE 2
        END,COALESCE(wt.planned_end,'9999-12-31'),p.name,wt.sort_order`
      :"CASE WHEN wt.status='review' THEN 0 ELSE 1 END,COALESCE(wt.planned_end,'9999-12-31'),p.name,wt.sort_order";
  const orderValues=scope==="deliverable"?[today]:[];

  const taskStatement=db.prepare(`
    WITH current_actor(user_id) AS (SELECT ?), deliverable_stats AS (
      SELECT d.task_id,
             COUNT(*) AS count,
             SUM(CASE WHEN NOT ${registeredDeliverableSql} THEN 1 ELSE 0 END) AS unregisteredCount,
             SUM(CASE WHEN (
               (wt2.assignee_user_id=(SELECT user_id FROM current_actor) AND d.status IN ('planned','rejected'))
               OR (d.status IN ('submitted','reviewed') AND EXISTS (
                 SELECT 1 FROM project_members pm
                  WHERE pm.project_id=wt2.project_id
                    AND pm.user_id=(SELECT user_id FROM current_actor)
                    AND pm.project_role IN ('PM','PL')
               ))
             ) THEN 1 ELSE 0 END) AS actionCount
        FROM deliverables d
        JOIN wbs_tasks wt2 ON wt2.id=d.task_id
       WHERE d.task_id IS NOT NULL
       GROUP BY d.task_id
    ), issue_stats AS (
      SELECT pi.task_id,
             SUM(CASE WHEN pi.status!='closed' THEN 1 ELSE 0 END) AS count,
             SUM(CASE WHEN pi.owner_user_id=(SELECT user_id FROM current_actor) AND pi.status NOT IN ('resolved','closed') THEN 1 ELSE 0 END) AS actionCount,
             SUM(CASE WHEN pi.owner_user_id=(SELECT user_id FROM current_actor) AND pi.status NOT IN ('resolved','closed') AND pi.issue_type='issue' THEN 1 ELSE 0 END) AS issueActionCount,
             SUM(CASE WHEN pi.owner_user_id=(SELECT user_id FROM current_actor) AND pi.status NOT IN ('resolved','closed') AND pi.issue_type='risk' THEN 1 ELSE 0 END) AS riskActionCount,
             SUM(CASE WHEN pi.owner_user_id=(SELECT user_id FROM current_actor) AND pi.status NOT IN ('resolved','closed') AND pi.issue_type='collaboration' THEN 1 ELSE 0 END) AS collaborationActionCount
        FROM project_issues pi
       WHERE pi.task_id IS NOT NULL
       GROUP BY pi.task_id
    )
    SELECT wt.id,
           wt.project_id AS projectId,
           p.code AS projectCode,
           p.name AS projectName,
           wt.wbs_code AS wbsCode,
           wt.level,
           wt.kind,
           wt.name,
           wt.task_type AS taskType,
           wt.planned_start AS plannedStart,
           wt.planned_end AS plannedEnd,
           wt.role_code AS roleCode,
           wt.assignee_user_id AS assigneeUserId,
           u.name AS assigneeName,
           wt.progress,
           wt.status,
           wt.completion_actor AS completionActor,
           CASE WHEN wt.status='review' THEN 1 ELSE 0 END AS approvalRequired,
           COALESCE(ds.count,0) AS deliverableCount,
           COALESCE(ix.count,0) AS issueCount,
           COALESCE(ds.actionCount,0) AS deliverableActionCount,
           COALESCE(ds.unregisteredCount,0) AS unregisteredDeliverableCount,
           COALESCE(ix.actionCount,0) AS issueActionCount,
           COALESCE(ix.issueActionCount,0) AS issueTypeActionCount,
           COALESCE(ix.riskActionCount,0) AS riskActionCount,
           COALESCE(ix.collaborationActionCount,0) AS collaborationActionCount
      ${fromSql}
      LEFT JOIN deliverable_stats ds ON ds.task_id=wt.id
      LEFT JOIN issue_stats ix ON ix.task_id=wt.id
      ${filteredWhere}
     ORDER BY ${orderSql}
     LIMIT ? OFFSET ?
  `).bind(user.id,...values,...orderValues,limit,offset);

  const countStatement=db.prepare(`WITH current_actor(user_id) AS (SELECT ?) SELECT COUNT(*) AS total ${fromSql} ${filteredWhere}`).bind(user.id,...values);
  const summaryStatement=db.prepare(`
    WITH current_actor(user_id) AS (SELECT ?)
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN wt.status='active' AND wt.planned_end IS NOT NULL AND wt.planned_end>? THEN 1 ELSE 0 END) AS activeCount,
           SUM(CASE WHEN wt.status NOT IN ('completed','review') AND wt.planned_end=? THEN 1 ELSE 0 END) AS todayCount,
           SUM(CASE WHEN wt.status NOT IN ('completed','review') AND wt.progress<100 AND wt.planned_end IS NOT NULL AND wt.planned_end<? THEN 1 ELSE 0 END) AS delayedCount,
           SUM(CASE WHEN wt.status='review' THEN 1 ELSE 0 END) AS reviewCount,
           SUM(CASE WHEN ${deliverableActionSql} THEN 1 ELSE 0 END) AS deliverableCount,
           SUM(CASE WHEN ${issueActionSql} THEN 1 ELSE 0 END) AS issueCount,
           COUNT(*) AS openCount
      ${fromSql}
      ${summaryWhereSql}
  `).bind(user.id,today,today,today,...summaryValues);
  const projectsStatement=db.prepare(`
    SELECT DISTINCT p.id,p.code,p.name
      ${fromSql}
      ${baseWhereSql}
     ORDER BY p.name
  `).bind(...baseValues);

  const [taskResult,countResult,summaryResult,projectResult]=await Promise.all([
    taskStatement.all(),
    countStatement.first<SummaryRow>(),
    includeSummary?summaryStatement.first<SummaryRow>():Promise.resolve(null),
    projectsStatement.all<ProjectOption>(),
  ]);
  const total=Number(countResult?.total||0);

  return Response.json({
    user:{id:user.id,email:user.email,name:user.name},
    tasks:taskResult.results,
    projects:projectResult.results,
    total,
    reviewCount:Number(summaryResult?.reviewCount||0),
    openCount:Number(summaryResult?.openCount||0),
    summary:includeSummary?{
      total:Number(summaryResult?.total||0),
      active:Number(summaryResult?.activeCount||0),
      today:Number(summaryResult?.todayCount||0),
      delayed:Number(summaryResult?.delayedCount||0),
      review:Number(summaryResult?.reviewCount||0),
      deliverable:Number(summaryResult?.deliverableCount||0),
      issue:Number(summaryResult?.issueCount||0),
    }:undefined,
    limit,
    offset,
    hasMore:offset+taskResult.results.length<total,
  });
}
