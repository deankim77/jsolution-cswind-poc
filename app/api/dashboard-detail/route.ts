import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {getChatGPTUser} from "../../chatgpt-auth";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";
import {listUnreadNotifications} from "../notifications/notification-service";

type D1Statement={bind:(...values:unknown[])=>D1Statement;first:<T=any>()=>Promise<T|null>;all:<T=any>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1={prepare:(sql:string)=>D1Statement};
type CachedDashboard={expiresAt:number;data:any};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as unknown as D1;}
const DAY=86_400_000;
const DASHBOARD_CACHE_MS=20_000;
const dashboardCache=new Map<string,CachedDashboard>();
const dashboardInflight=new Map<string,Promise<any>>();
let gateDecisionSchemaReady:Promise<void>|null=null;
const ensureGateDecisionSchema=(db:D1)=>gateDecisionSchemaReady??=(async()=>{
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_gate_decisions (id TEXT PRIMARY KEY NOT NULL,project_id TEXT NOT NULL,gate_task_id TEXT NOT NULL,gate_code TEXT NOT NULL,decision TEXT NOT NULL,note TEXT,decided_by TEXT NOT NULL,decided_at INTEGER NOT NULL)`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS project_gate_decisions_project_gate_idx ON project_gate_decisions(project_id,gate_code,decided_at)").run();
})().catch(reason=>{gateDecisionSchemaReady=null;throw reason});
const spanDays=(start?:string,end?:string)=>start&&end?Math.max(1,Math.floor((Date.parse(`${end}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/DAY)+1):1;
const healthScore=(delayRate:number)=>delayRate<=0?100:delayRate<5?90:delayRate<10?80:delayRate<20?60:delayRate<30?40:20;
const healthBucket=(delayRate:number)=>delayRate<=0?"normal":delayRate<5?"under5":delayRate<10?"under10":delayRate<20?"under20":delayRate<30?"under30":"over30";

export async function GET(request:Request){
  const auth=await getChatGPTUser();const db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db,{email:auth?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const user={id:context.userId,companyId:context.companyId,email:context.email||auth?.email||"",name:context.name||auth?.displayName||"사용자"};
  const cacheKey=`${user.companyId}:${user.id}`;const now=Date.now(),cached=dashboardCache.get(cacheKey);
  if(cached&&cached.expiresAt>now)return Response.json(cached.data,{headers:{"x-dashboard-cache":"hit"}});
  const existing=dashboardInflight.get(cacheKey);if(existing){const data=await existing;return Response.json(data,{headers:{"x-dashboard-cache":"shared"}})}
  const build=(async()=>{
    await ensureGateDecisionSchema(db);
    const [projects,gateResult,notificationData]=await Promise.all([
      db.prepare(`WITH task_stats AS (
          SELECT project_id,
            COALESCE(ROUND(AVG(CASE WHEN kind='task' THEN progress END)),0) AS progress,
            SUM(CASE WHEN kind='task' THEN 1 ELSE 0 END) AS taskCount,
            SUM(CASE WHEN kind='task' AND status='completed' THEN 1 ELSE 0 END) AS completedCount,
            SUM(CASE WHEN kind='task' AND status='review' THEN 1 ELSE 0 END) AS reviewCount,
            SUM(CASE WHEN kind='task' AND status NOT IN ('completed','review') AND planned_end IS NOT NULL AND planned_end<CURRENT_DATE::text THEN 1 ELSE 0 END) AS delayedCount
          FROM wbs_tasks GROUP BY project_id
        ), deliverable_stats AS (
          SELECT project_id,
            SUM(CASE WHEN required=1 AND status!='submitted' THEN 1 ELSE 0 END) AS missingDeliverables
          FROM deliverables GROUP BY project_id
        ), issue_stats AS (
          SELECT project_id,
            SUM(CASE WHEN status NOT IN ('closed','completed','resolved') THEN 1 ELSE 0 END) AS openIssues,
            SUM(CASE WHEN issue_type='issue' AND status NOT IN ('closed','completed','resolved') THEN 1 ELSE 0 END) AS issueCount,
            SUM(CASE WHEN issue_type='risk' AND status NOT IN ('closed','completed','resolved') THEN 1 ELSE 0 END) AS riskCount,
            SUM(CASE WHEN issue_type='collaboration' AND status NOT IN ('closed','completed','resolved') THEN 1 ELSE 0 END) AS collaborationCount
          FROM project_issues GROUP BY project_id
        )
        SELECT p.id,p.code,p.name,p.customer_name AS customerName,p.start_date AS startDate,p.end_date AS endDate,p.status,
          COALESCE(ts.progress,0) AS progress,
          COALESCE(ts.taskCount,0) AS taskCount,
          COALESCE(ts.completedCount,0) AS completedCount,
          COALESCE(ts.reviewCount,0) AS reviewCount,
          COALESCE(ts.delayedCount,0) AS delayedCount,
          COALESCE(ds.missingDeliverables,0) AS missingDeliverables,
          COALESCE(isx.openIssues,0) AS openIssues,
          COALESCE(isx.issueCount,0) AS issueCount,
          COALESCE(isx.riskCount,0) AS riskCount,
          COALESCE(isx.collaborationCount,0) AS collaborationCount
        FROM projects p
        LEFT JOIN task_stats ts ON ts.project_id=p.id
        LEFT JOIN deliverable_stats ds ON ds.project_id=p.id
        LEFT JOIN issue_stats isx ON isx.project_id=p.id
        WHERE p.company_id=?
        ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'preparing' THEN 1 WHEN 'stopped' THEN 2 ELSE 3 END,p.updated_at DESC`).bind(user.companyId).all<any>(),
      db.prepare(`WITH gate_task_stats AS (
          SELECT g.id AS gateTaskId,
            COUNT(s.id) AS activityCount,
            SUM(CASE WHEN s.status='completed' THEN 1 ELSE 0 END) AS completedActivityCount,
            MIN(s.planned_start) AS segmentStart,
            MAX(s.planned_end) AS segmentEnd,
            COALESCE(MAX(CASE WHEN s.status NOT IN ('completed','review') AND s.planned_end IS NOT NULL AND s.planned_end<date('now') THEN (CURRENT_DATE - s.planned_end::date) ELSE 0 END),0) AS delayDays
          FROM wbs_tasks g
          LEFT JOIN wbs_tasks s ON s.project_id=g.project_id AND s.parent_id=g.parent_id AND s.id<>g.id AND s.kind<>'summary'
          WHERE g.task_type='gate'
          GROUP BY g.id
        ), gate_deliverable_stats AS (
          SELECT g.id AS gateTaskId,COUNT(o.id) AS missingRequiredDeliverables
          FROM wbs_tasks g
          LEFT JOIN wbs_tasks s ON s.project_id=g.project_id AND s.parent_id=g.parent_id
          LEFT JOIN deliverables o ON o.task_id=s.id AND o.project_id=g.project_id AND o.required=1 AND o.status NOT IN ('approved','completed')
          WHERE g.task_type='gate'
          GROUP BY g.id
        ), gate_issue_stats AS (
          SELECT g.id AS gateTaskId,COUNT(i.id) AS openGateIssues
          FROM wbs_tasks g
          LEFT JOIN wbs_tasks s ON s.project_id=g.project_id AND s.parent_id=g.parent_id
          LEFT JOIN project_issues i ON i.task_id=s.id AND i.project_id=g.project_id AND i.status NOT IN ('resolved','closed','completed')
          WHERE g.task_type='gate'
          GROUP BY g.id
        )
        SELECT p.id AS projectId,p.customer_name AS customerName,w.id AS taskId,REPLACE(w.wbs_code,'-REVIEW','') AS gateCode,w.name,w.status,w.progress,w.planned_end AS plannedDate,
          d.decision,d.note,d.decided_at AS decidedAt,u.name AS decidedBy,
          COALESCE(gts.activityCount,0) AS activityCount,
          COALESCE(gts.completedActivityCount,0) AS completedActivityCount,
          COALESCE(gds.missingRequiredDeliverables,0) AS missingRequiredDeliverables,
          COALESCE(gis.openGateIssues,0) AS openGateIssues,
          gts.segmentStart,gts.segmentEnd,COALESCE(gts.delayDays,0) AS delayDays
        FROM projects p JOIN wbs_tasks w ON w.project_id=p.id
        LEFT JOIN gate_task_stats gts ON gts.gateTaskId=w.id
        LEFT JOIN gate_deliverable_stats gds ON gds.gateTaskId=w.id
        LEFT JOIN gate_issue_stats gis ON gis.gateTaskId=w.id
        LEFT JOIN project_gate_decisions d ON d.id=(SELECT d2.id FROM project_gate_decisions d2 WHERE d2.project_id=p.id AND d2.gate_task_id=w.id ORDER BY d2.decided_at DESC,d2.id DESC LIMIT 1)
        LEFT JOIN users u ON u.id=d.decided_by WHERE p.company_id=? AND w.task_type='gate' ORDER BY p.id,w.sort_order`).bind(user.companyId).all<any>(),
      listUnreadNotifications(db,user.companyId,user.id,50),
    ]);
    const baseRows=projects.results.map(item=>({...item,progress:Number(item.progress)||0,taskCount:Number(item.taskCount)||0,completedCount:Number(item.completedCount)||0,reviewCount:Number(item.reviewCount)||0,delayedCount:Number(item.delayedCount)||0,missingDeliverables:Number(item.missingDeliverables)||0,openIssues:Number(item.openIssues)||0,issueCount:Number(item.issueCount)||0,riskCount:Number(item.riskCount)||0,collaborationCount:Number(item.collaborationCount)||0}));
    const gatesByProject=new Map<string,any[]>();for(const raw of gateResult.results){const plannedDurationDays=spanDays(raw.segmentStart,raw.segmentEnd);const liveDelayDays=Math.max(0,Number(raw.delayDays)||0);const passedAt=raw.decision==="PASS"&&Number(raw.decidedAt)>0?Number(raw.decidedAt):0;const plannedEndAt=raw.segmentEnd?Date.parse(`${raw.segmentEnd}T00:00:00Z`):0;const passedDelayDays=passedAt&&plannedEndAt?Math.max(0,Math.ceil((passedAt-plannedEndAt)/DAY)):0;const delayDays=raw.decision==="PASS"?passedDelayDays:liveDelayDays,delayRate=Math.round(delayDays/plannedDurationDays*1000)/10;const gate={...raw,activityCount:Number(raw.activityCount)||0,completedActivityCount:Number(raw.completedActivityCount)||0,missingRequiredDeliverables:Number(raw.missingRequiredDeliverables)||0,openGateIssues:Number(raw.openGateIssues)||0,decision:raw.decision||null,plannedDurationDays,delayDays,delayRate,healthScore:healthScore(delayRate)};const list=gatesByProject.get(raw.projectId)||[];list.push(gate);gatesByProject.set(raw.projectId,list)}
    const gateCodes=["G1","G2","G3","G4","G5","G6"],currentFor=(gates:any[])=>gateCodes.find(code=>gates.find(item=>item.gateCode===code)?.decision!=="PASS")||"COMPLETE";
    const rows=baseRows.map(item=>{const gates=gatesByProject.get(item.id)||[],currentGate=currentFor(gates),current=gates.find(gate=>gate.gateCode===currentGate);return {...item,gateSummary:{currentGate,decision:current?.decision||current?.status||null,passedCount:gates.filter(gate=>gate.decision==="PASS").length,nextReviewDate:current?.plannedDate||null},gates}});
    const cumulative=gateCodes.map(gateCode=>({gateCode,count:rows.filter(item=>item.gates.some((gate:any)=>gate.gateCode===gateCode&&gate.decision==="PASS")).length}));
    const currentDistribution=[...gateCodes,"COMPLETE"].map(gateCode=>({gateCode,count:rows.filter(item=>item.gateSummary.currentGate===gateCode).length})).filter(item=>item.count>0);
    const customerNames=Array.from(new Set(rows.map(item=>item.customerName||"거래처 미지정")));
    const customers=customerNames.map(customerName=>{const customerRows=rows.filter(item=>(item.customerName||"거래처 미지정")===customerName);const delayed=customerRows.filter(item=>item.delayedCount>0).length;return {customerName,total:customerRows.length,stages:[...gateCodes,"COMPLETE"].map(gateCode=>({gateCode,count:customerRows.filter(item=>item.gateSummary.currentGate===gateCode).length})).filter(item=>item.count>0),healthy:customerRows.length-delayed,delayed}});
    const gateHealth=gateCodes.map(gateCode=>{const gates=rows.flatMap(item=>item.gates).filter((gate:any)=>gate.gateCode===gateCode&&gate.decision==="PASS"),scores=gates.map((gate:any)=>Number(gate.healthScore)||100),rates=gates.map((gate:any)=>Number(gate.delayRate)||0),distribution={normal:0,under5:0,under10:0,under20:0,under30:0,over30:0} as Record<string,number>;for(const rate of rates)distribution[healthBucket(rate)]++;return {gateCode,projectCount:gates.length,healthScore:gates.length?Math.round(scores.reduce((sum:number,value:number)=>sum+value,0)/gates.length):100,averageDelayRate:gates.length?Math.round(rates.reduce((sum:number,value:number)=>sum+value,0)/gates.length*10)/10:0,distribution,normalCount:distribution.normal,delayedCount:gates.length-distribution.normal,activityProgress:gates.length?Math.round(gates.reduce((sum:number,gate:any)=>sum+(gate.activityCount?gate.completedActivityCount/gate.activityCount*100:100),0)/gates.length):100,missingDeliverables:gates.reduce((sum:number,gate:any)=>sum+gate.missingRequiredDeliverables,0),openIssues:gates.reduce((sum:number,gate:any)=>sum+gate.openGateIssues,0),conditional:gates.filter((gate:any)=>gate.decision==="CONDITIONAL_PASS").length,rejected:gates.filter((gate:any)=>gate.decision==="REJECT").length,deferred:gates.filter((gate:any)=>gate.decision==="DEFER").length}});
    const upcomingReviews=rows.flatMap(item=>item.gates.filter((gate:any)=>gate.decision!=="PASS"&&gate.plannedDate).map((gate:any)=>({projectId:item.id,projectCode:item.code,projectName:item.name,customerName:item.customerName,gateCode:gate.gateCode,plannedDate:gate.plannedDate,decision:gate.decision||gate.status}))).sort((a,b)=>a.plannedDate.localeCompare(b.plannedDate)).slice(0,12);
    const summary={total:rows.length,active:rows.filter(item=>item.status==="active").length,preparing:rows.filter(item=>item.status==="preparing").length,review:rows.reduce((sum,item)=>sum+item.reviewCount,0),delayed:rows.reduce((sum,item)=>sum+item.delayedCount,0),missingDeliverables:rows.reduce((sum,item)=>sum+item.missingDeliverables,0),openIssues:rows.reduce((sum,item)=>sum+item.openIssues,0),issues:rows.reduce((sum,item)=>sum+item.issueCount,0),risks:rows.reduce((sum,item)=>sum+item.riskCount,0),collaborations:rows.reduce((sum,item)=>sum+item.collaborationCount,0)};
    return {user:{id:user.id,email:user.email,name:user.name},summary,projects:rows,gatePortfolio:{cumulative,currentDistribution,customers,gateHealth,upcomingReviews},notifications:notificationData.items,notificationUnreadCount:notificationData.unreadCount};
  })();
  dashboardInflight.set(cacheKey,build);
  try{const data=await build;dashboardCache.set(cacheKey,{expiresAt:Date.now()+DASHBOARD_CACHE_MS,data});return Response.json(data,{headers:{"x-dashboard-cache":"miss"}})}finally{dashboardInflight.delete(cacheKey)}
}