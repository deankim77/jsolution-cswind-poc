/* eslint-disable @typescript-eslint/no-explicit-any */
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../db/request-context";
import {getLegacyDbCompat} from "../../../../db/postgres-d1-compat";
import {getStorageAdapter} from "../../../../lib/storage-adapter";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
type R2Bucket={delete:(key:string)=>Promise<unknown>};
async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};}
async function tableExists(db:D1,name:string){return Boolean(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first())}
async function columnExists(db:D1,table:string,column:string){if(!(await tableExists(db,table)))return false;const result=await db.prepare(`PRAGMA table_info(${table})`).all();return (result.results??[]).some((row:any)=>String(row.name)===column)}

export async function DELETE(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;
  const {DB:db,FILES}=await runtime();
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,false)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole))return Response.json({error:"프로젝트를 삭제할 권한이 없습니다."},{status:403});
  const project=await db.prepare("SELECT id,name,code,status FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first() as {id:string;name:string;code:string;status:string}|null;
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  if(!access.isAdmin&&project.status!=="preparing")return Response.json({error:"PM 또는 PL은 준비중 프로젝트만 삭제할 수 있습니다."},{status:409});
  const now=Math.floor(Date.now()/1000);
  const statements:any[]=[];
  const fileKeys:string[]=[];
  const pushDelete=async(table:string,sql=`DELETE FROM ${table} WHERE project_id=?`)=>{if(await tableExists(db,table))statements.push(db.prepare(sql).bind(projectId))};
  const collectFiles=async(table:string,column="file_key")=>{if(!(await columnExists(db,table,column)))return;const rows=await db.prepare(`SELECT ${column} AS fileKey FROM ${table} WHERE project_id=? AND ${column} IS NOT NULL`).bind(projectId).all();for(const row of rows.results??[]){const key=String((row as any).fileKey||"").trim();if(key)fileKeys.push(key)}};

  await collectFiles("deliverables");
  await collectFiles("deliverable_versions");
  await collectFiles("deliverable_versions","preview_file_key");
  await collectFiles("project_documents");
  await collectFiles("issue_attachments");
  await collectFiles("workflow_source_attachments");

  if(await tableExists(db,"workflow_step_documents")&&await tableExists(db,"workflow_instances"))statements.push(db.prepare("DELETE FROM workflow_step_documents WHERE workflow_id IN (SELECT id FROM workflow_instances WHERE project_id=?)").bind(projectId));
  if(await tableExists(db,"workflow_step_document_rules")&&await tableExists(db,"workflow_instances"))statements.push(db.prepare("DELETE FROM workflow_step_document_rules WHERE workflow_id IN (SELECT id FROM workflow_instances WHERE project_id=?)").bind(projectId));
  if(await tableExists(db,"workflow_history")&&await tableExists(db,"workflow_instances"))statements.push(db.prepare("DELETE FROM workflow_history WHERE workflow_id IN (SELECT id FROM workflow_instances WHERE project_id=?)").bind(projectId));
  if(await tableExists(db,"workflow_instance_steps")&&await tableExists(db,"workflow_instances"))statements.push(db.prepare("DELETE FROM workflow_instance_steps WHERE workflow_id IN (SELECT id FROM workflow_instances WHERE project_id=?)").bind(projectId));
  if(await tableExists(db,"workflow_instance_deliverables")&&await tableExists(db,"workflow_instances"))statements.push(db.prepare("DELETE FROM workflow_instance_deliverables WHERE workflow_id IN (SELECT id FROM workflow_instances WHERE project_id=?)").bind(projectId));
  await pushDelete("design_change_requests");
  await pushDelete("quality_cases");
  await pushDelete("workflow_source_attachments");
  await pushDelete("workflow_instances");

  await pushDelete("issue_attachments");
  await pushDelete("project_issue_actions");
  await pushDelete("deliverable_reviews");
  await pushDelete("deliverable_versions");
  await pushDelete("project_gate_decisions");
  if(await tableExists(db,"project_baseline_tasks")&&await tableExists(db,"project_baselines"))statements.push(db.prepare("DELETE FROM project_baseline_tasks WHERE baseline_id IN (SELECT id FROM project_baselines WHERE project_id=?)").bind(projectId));
  await pushDelete("project_baselines");
  await pushDelete("task_actuals");
  await pushDelete("deliverables");
  await pushDelete("project_issues");
  await pushDelete("project_documents");
  await pushDelete("project_meetings");
  await pushDelete("project_profiles");
  await pushDelete("project_shares");
  await pushDelete("wbs_tasks");
  await pushDelete("project_roles");
  await pushDelete("project_members");
  const uniqueFiles=[...new Set(fileKeys)];
  statements.push(
    db.prepare("DELETE FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,"PROJECT_DELETED","PROJECT",projectId,JSON.stringify({name:project.name,code:project.code,status:project.status,adminDelete:access.isAdmin,fileCount:uniqueFiles.length}),now)
  );
  await db.batch(statements);
  if(FILES&&uniqueFiles.length)await Promise.allSettled(uniqueFiles.map(key=>FILES.delete(key)));
  return Response.json({ok:true,projectId,name:project.name,code:project.code,status:project.status,adminDelete:access.isAdmin,fileCount:uniqueFiles.length});
}
