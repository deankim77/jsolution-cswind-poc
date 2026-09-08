import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {getChatGPTUser} from "../../../chatgpt-auth";
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1Statement={bind:(...values:unknown[])=>D1Statement;first:<T=any>()=>Promise<T|null>};
type D1={prepare:(sql:string)=>D1Statement};
type SummaryRow={total?:number;activeCount?:number;todayCount?:number;delayedCount?:number;reviewCount?:number;deliverableCount?:number;issueCount?:number};

async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as unknown as D1;}

export async function GET(request:Request){
  const auth=await getChatGPTUser();
  const db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db,{email:auth?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const userId=context.userId;
  const url=new URL(request.url);
  const query=(url.searchParams.get("q")||"").trim().toLowerCase();
  const projectId=url.searchParams.get("projectId")||"";
  const statuses=(url.searchParams.get("statuses")||"").split(",").map(value=>value.trim()).filter(Boolean);
  const role=(url.searchParams.get("role")||"").trim().toLowerCase();
  const dueFrom=url.searchParams.get("dueFrom")||"";
  const dueTo=url.searchParams.get("dueTo")||"";
  const today=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("today")||"")?url.searchParams.get("today")!:new Date().toISOString().slice(0,10);

  const accessSql=`(
    wt.assignee_user_id=?
    OR (
      wt.status='review'
      AND EXISTS (
        SELECT 1 FROM project_members pm
         WHERE pm.project_id=wt.project_id
           AND pm.user_id=?
           AND ((wt.completion_actor='PM' AND pm.project_role='PM') OR (wt.completion_actor='PL' AND pm.project_role IN ('PL','PM')))
      )
    )
  )`;
  const deliverableActionSql=`EXISTS (
    SELECT 1 FROM deliverables d
     WHERE d.task_id=wt.id
       AND (
         (wt.assignee_user_id=(SELECT user_id FROM current_actor) AND d.status IN ('planned','rejected'))
         OR (d.status IN ('submitted','reviewed') AND EXISTS (
           SELECT 1 FROM project_members pm
            WHERE pm.project_id=wt.project_id
              AND pm.user_id=(SELECT user_id FROM current_actor)
              AND pm.project_role IN ('PM','PL')
         ))
       )
  )`;
  const issueActionSql=`EXISTS (
    SELECT 1 FROM project_issues pi
     WHERE pi.task_id=wt.id
       AND pi.owner_user_id=(SELECT user_id FROM current_actor)
       AND pi.status NOT IN ('resolved','closed')
  )`;
  const where=[accessSql,"wt.kind='task'","p.status!='completed'","wt.status!='completed'"];
  const values:unknown[]=[userId,userId];
  const add=(sql:string,...params:unknown[])=>{where.push(sql);values.push(...params)};
  if(query){const keyword=`%${query}%`;add(`(
    LOWER(COALESCE(p.name,'') || ' ' || COALESCE(p.code,'') || ' ' || COALESCE(wt.wbs_code,'') || ' ' || COALESCE(wt.name,'') || ' ' || COALESCE(wt.role_code,'') || ' ' || COALESCE(u.name,'')) LIKE ?
    OR EXISTS (SELECT 1 FROM deliverables sd WHERE sd.task_id=wt.id AND LOWER(COALESCE(sd.name,'')) LIKE ?)
    OR EXISTS (SELECT 1 FROM project_issues si WHERE si.task_id=wt.id AND LOWER(COALESCE(si.title,'') || ' ' || COALESCE(si.description,'')) LIKE ?)
  )`,keyword,keyword,keyword)}
  if(projectId)add("wt.project_id=?",projectId);
  if(statuses.length)add(`wt.status IN (${statuses.map(()=>"?").join(",")})`,...statuses);
  if(role)add("LOWER(COALESCE(wt.role_code,'') || ' ' || COALESCE(u.name,'')) LIKE ?",`%${role}%`);
  if(dueFrom)add("wt.planned_end>=?",dueFrom);
  if(dueTo)add("wt.planned_end<=?",dueTo);

  const row=await db.prepare(`
    WITH current_actor(user_id) AS (SELECT ?)
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN wt.status='active' AND wt.planned_end IS NOT NULL AND wt.planned_end>? THEN 1 ELSE 0 END) AS activeCount,
           SUM(CASE WHEN wt.status NOT IN ('completed','review') AND wt.planned_end=? THEN 1 ELSE 0 END) AS todayCount,
           SUM(CASE WHEN wt.status NOT IN ('completed','review') AND wt.progress<100 AND wt.planned_end IS NOT NULL AND wt.planned_end<? THEN 1 ELSE 0 END) AS delayedCount,
           SUM(CASE WHEN wt.status='review' THEN 1 ELSE 0 END) AS reviewCount,
           SUM(CASE WHEN ${deliverableActionSql} THEN 1 ELSE 0 END) AS deliverableCount,
           SUM(CASE WHEN ${issueActionSql} THEN 1 ELSE 0 END) AS issueCount
      FROM wbs_tasks wt
      JOIN projects p ON p.id=wt.project_id
      LEFT JOIN users u ON u.id=wt.assignee_user_id
     WHERE ${where.join(" AND ")}
  `).bind(userId,today,today,today,...values).first<SummaryRow>();

  return Response.json({summary:{
    total:Number(row?.total||0),
    active:Number(row?.activeCount||0),
    today:Number(row?.todayCount||0),
    delayed:Number(row?.delayedCount||0),
    review:Number(row?.reviewCount||0),
    deliverable:Number(row?.deliverableCount||0),
    issue:Number(row?.issueCount||0),
  }});
}
