import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {getChatGPTUser} from "../../../chatgpt-auth";
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=any>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1={prepare:(sql:string)=>D1Statement};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as unknown as D1;}

let gateDecisionSchemaReady:Promise<void>|null=null;
const ensureGateDecisionSchema=(db:D1)=>gateDecisionSchemaReady??=(async()=>{
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_gate_decisions (id TEXT PRIMARY KEY NOT NULL,project_id TEXT NOT NULL,gate_task_id TEXT NOT NULL,gate_code TEXT NOT NULL,decision TEXT NOT NULL,note TEXT,decided_by TEXT NOT NULL,decided_at INTEGER NOT NULL)`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS project_gate_decisions_project_gate_idx ON project_gate_decisions(project_id,gate_code,decided_at)").run();
})().catch(reason=>{gateDecisionSchemaReady=null;throw reason});

export async function GET(request:Request){
  const auth=await getChatGPTUser();const db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db,{email:auth?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  await ensureGateDecisionSchema(db);
  const [projectResult,gateResult]=await Promise.all([
    db.prepare(`WITH task_stats AS (
        SELECT project_id,
          COALESCE(ROUND(AVG(CASE WHEN kind='task' THEN progress END)),0) AS progress,
          SUM(CASE WHEN kind='task' THEN 1 ELSE 0 END) AS taskCount,
          SUM(CASE WHEN kind='task' AND status='completed' THEN 1 ELSE 0 END) AS completedCount,
          SUM(CASE WHEN kind='task' AND status='review' THEN 1 ELSE 0 END) AS reviewCount,
          SUM(CASE WHEN kind='task' AND status NOT IN ('completed','review') AND planned_end IS NOT NULL AND planned_end<CURRENT_DATE::text THEN 1 ELSE 0 END) AS delayedCount
        FROM wbs_tasks GROUP BY project_id
      ), deliverable_stats AS (
        SELECT project_id,SUM(CASE WHEN required=1 AND status!='submitted' THEN 1 ELSE 0 END) AS missingDeliverables
        FROM deliverables GROUP BY project_id
      ), issue_stats AS (
        SELECT project_id,
          SUM(CASE WHEN status NOT IN ('closed','completed','resolved') THEN 1 ELSE 0 END) AS openIssues,
          SUM(CASE WHEN issue_type='issue' AND status NOT IN ('closed','completed','resolved') THEN 1 ELSE 0 END) AS issueCount,
          SUM(CASE WHEN issue_type='risk' AND status NOT IN ('closed','completed','resolved') THEN 1 ELSE 0 END) AS riskCount,
          SUM(CASE WHEN issue_type='collaboration' AND status NOT IN ('closed','completed','resolved') THEN 1 ELSE 0 END) AS collaborationCount
        FROM project_issues GROUP BY project_id
      )
      SELECT p.id,p.status,
        COALESCE(ts.progress,0) AS progress,COALESCE(ts.taskCount,0) AS taskCount,
        COALESCE(ts.completedCount,0) AS completedCount,COALESCE(ts.reviewCount,0) AS reviewCount,
        COALESCE(ts.delayedCount,0) AS delayedCount,COALESCE(ds.missingDeliverables,0) AS missingDeliverables,
        COALESCE(ix.openIssues,0) AS openIssues,COALESCE(ix.issueCount,0) AS issueCount,
        COALESCE(ix.riskCount,0) AS riskCount,COALESCE(ix.collaborationCount,0) AS collaborationCount
      FROM projects p
      LEFT JOIN task_stats ts ON ts.project_id=p.id
      LEFT JOIN deliverable_stats ds ON ds.project_id=p.id
      LEFT JOIN issue_stats ix ON ix.project_id=p.id
      WHERE p.company_id=?`).bind(context.companyId).all<any>(),
    db.prepare(`SELECT p.id AS projectId,REPLACE(w.wbs_code,'-REVIEW','') AS gateCode,w.status,
        (SELECT d.decision FROM project_gate_decisions d WHERE d.project_id=p.id AND d.gate_task_id=w.id ORDER BY d.decided_at DESC,d.id DESC LIMIT 1) AS decision
      FROM projects p JOIN wbs_tasks w ON w.project_id=p.id
      WHERE p.company_id=? AND w.task_type='gate'
      ORDER BY p.id,w.sort_order`).bind(context.companyId).all<any>(),
  ]);
  const gatesByProject=new Map<string,any[]>();
  for(const gate of gateResult.results){const list=gatesByProject.get(gate.projectId)||[];list.push({gateCode:gate.gateCode,decision:gate.decision||null,status:gate.status});gatesByProject.set(gate.projectId,list)}
  const gateCodes=["G1","G2","G3","G4","G5","G6"];
  const rows=projectResult.results.map(raw=>{const gates=gatesByProject.get(raw.id)||[];const currentGate=gateCodes.find(code=>gates.find(item=>item.gateCode===code)?.decision!=="PASS")||"COMPLETE";return {...raw,progress:Number(raw.progress)||0,taskCount:Number(raw.taskCount)||0,completedCount:Number(raw.completedCount)||0,reviewCount:Number(raw.reviewCount)||0,delayedCount:Number(raw.delayedCount)||0,missingDeliverables:Number(raw.missingDeliverables)||0,openIssues:Number(raw.openIssues)||0,issueCount:Number(raw.issueCount)||0,riskCount:Number(raw.riskCount)||0,collaborationCount:Number(raw.collaborationCount)||0,gateSummary:{currentGate,passedCount:gates.filter(item=>item.decision==="PASS").length},gates}});
  const summary={total:rows.length,active:rows.filter(item=>item.status==="active").length,preparing:rows.filter(item=>item.status==="preparing").length,review:rows.reduce((sum,item)=>sum+item.reviewCount,0),delayed:rows.reduce((sum,item)=>sum+item.delayedCount,0),missingDeliverables:rows.reduce((sum,item)=>sum+item.missingDeliverables,0),openIssues:rows.reduce((sum,item)=>sum+item.openIssues,0),issues:rows.reduce((sum,item)=>sum+item.issueCount,0),risks:rows.reduce((sum,item)=>sum+item.riskCount,0),collaborations:rows.reduce((sum,item)=>sum+item.collaborationCount,0)};
  return Response.json({summary,projects:rows,summaryOnly:true});
}
