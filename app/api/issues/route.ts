import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=any>()=>Promise<{results:T[]}>;first:<T=any>()=>Promise<T|null>;run:()=>Promise<unknown>};
type D1={prepare:(sql:string)=>D1Statement};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as unknown as D1;}
const positiveInt=(value:string|null,fallback:number)=>{const parsed=Number.parseInt(value||"",10);return Number.isFinite(parsed)&&parsed>=0?parsed:fallback};
let issueIndexesReady:Promise<void>|null=null;
const ensureIssueIndexes=(db:D1)=>issueIndexesReady??=(Promise.all([
  db.prepare("CREATE INDEX IF NOT EXISTS project_issues_project_status_updated_idx ON project_issues(project_id,status,updated_at DESC)").run(),
  db.prepare("CREATE INDEX IF NOT EXISTS project_issues_task_owner_status_idx ON project_issues(task_id,owner_user_id,status)").run(),
  db.prepare("CREATE INDEX IF NOT EXISTS project_issues_owner_due_idx ON project_issues(owner_user_id,due_date)").run(),
  db.prepare("CREATE INDEX IF NOT EXISTS issue_attachments_issue_idx ON issue_attachments(issue_id)").run(),
  db.prepare("CREATE INDEX IF NOT EXISTS project_members_user_project_idx ON project_members(user_id,project_id)").run(),
]).then(()=>undefined).catch(reason=>{issueIndexesReady=null;throw reason}));

export async function GET(request:Request){
  try{
    const db=await runtimeDb();await ensureIssueIndexes(db);
    let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
    const isAdmin=context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));
    const url=new URL(request.url);
    const q=(url.searchParams.get("q")||"").trim().toLowerCase();
    const projectId=(url.searchParams.get("projectId")||"").trim();
    const type=(url.searchParams.get("type")||"").trim();
    const status=(url.searchParams.get("status")||"").trim();
    const owner=(url.searchParams.get("owner")||"").trim();
    const dueFrom=(url.searchParams.get("dueFrom")||"").trim();
    const dueTo=(url.searchParams.get("dueTo")||"").trim();
    const attachments=(url.searchParams.get("attachments")||"").trim();
    const severities=(url.searchParams.get("severities")||"").split(",").map(value=>value.trim()).filter(Boolean);
    const paged=url.searchParams.has("limit")||url.searchParams.has("offset");
    const limit=Math.min(200,Math.max(10,positiveInt(url.searchParams.get("limit"),50)));
    const offset=positiveInt(url.searchParams.get("offset"),0);
    const accessSql=`p.company_id=? AND (?=1 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?))`;
    const filters=[accessSql];
    const values:unknown[]=[context.companyId,isAdmin?1:0,context.userId];
    if(projectId){filters.push("i.project_id=?");values.push(projectId)}
    if(type&&type!=="all"){filters.push("i.issue_type=?");values.push(type)}
    if(status&&status!=="all"){filters.push("i.status=?");values.push(status)}
    if(severities.length){filters.push(`i.severity IN (${severities.map(()=>"?").join(",")})`);values.push(...severities)}
    if(owner){filters.push("owner.name=?");values.push(owner)}
    if(dueFrom){filters.push("i.due_date>=?");values.push(dueFrom)}
    if(dueTo){filters.push("i.due_date<=?");values.push(dueTo)}
    if(attachments==="yes")filters.push("EXISTS(SELECT 1 FROM issue_attachments ax WHERE ax.issue_id=i.id)");
    if(attachments==="no")filters.push("NOT EXISTS(SELECT 1 FROM issue_attachments ax WHERE ax.issue_id=i.id)");
    if(q){const keyword=`%${q}%`;filters.push(`LOWER(COALESCE(p.code,'')||' '||COALESCE(p.name,'')||' '||COALESCE(wt.wbs_code,'')||' '||COALESCE(wt.name,'')||' '||COALESCE(i.title,'')||' '||COALESCE(i.description,'')||' '||COALESCE(creator.name,'')||' '||COALESCE(owner.name,'')) LIKE ?`);values.push(keyword)}
    const whereSql=filters.join(" AND ");
    const baseFrom=`FROM project_issues i JOIN projects p ON p.id=i.project_id LEFT JOIN wbs_tasks wt ON wt.id=i.task_id LEFT JOIN users owner ON owner.id=i.owner_user_id LEFT JOIN users creator ON creator.id=i.created_by`;
    const issueSql=`SELECT i.id,i.project_id AS projectId,p.code AS projectCode,p.name AS projectName,
      i.task_id AS taskId,wt.wbs_code AS taskWbsCode,wt.name AS taskName,
      i.issue_type AS issueType,i.title,i.description,i.severity,i.status,
      i.owner_user_id AS ownerUserId,owner.name AS ownerName,
      i.created_by AS createdByUserId,creator.name AS createdByName,
      i.due_date AS dueDate,i.created_at AS createdAt,i.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM issue_attachments a WHERE a.issue_id=i.id) AS attachmentCount
      ${baseFrom} WHERE ${whereSql}
      ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,i.updated_at DESC${paged?" LIMIT ? OFFSET ?":""}`;
    const issueValues=paged?[...values,limit,offset]:values;
    const projectValues=[context.companyId,isAdmin?1:0,context.userId];
    const countSql=`SELECT COUNT(*) AS total ${baseFrom} WHERE ${whereSql}`;
    const [issueResult,projectResult,countResult]=await Promise.all([
      db.prepare(issueSql).bind(...issueValues).all(),
      db.prepare(`SELECT p.id,p.code,p.name FROM projects p WHERE ${accessSql} ORDER BY p.name,p.code`).bind(...projectValues).all(),
      paged?db.prepare(countSql).bind(...values).first<{total:number}>():Promise.resolve(null),
    ]);
    const total=paged?Number(countResult?.total||0):issueResult.results?.length||0;
    return Response.json({issues:issueResult.results??[],projects:projectResult.results??[],total,limit:paged?limit:total,offset:paged?offset:0,hasMore:paged?offset+(issueResult.results?.length||0)<total:false});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"전체 이슈 조회 중 오류가 발생했습니다."},{status:500});
  }
}
