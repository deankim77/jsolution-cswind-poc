/* eslint-disable @typescript-eslint/no-explicit-any */
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";
import {getStorageAdapter} from "../../../../../lib/storage-adapter";
type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
type R2Object={body:ReadableStream;httpMetadata?:{contentType?:string}};
type R2Bucket={put:(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:any)=>Promise<unknown>;get:(key:string)=>Promise<R2Object|null>};
const TYPES=new Set(["issue","risk","collaboration"]),STATUSES=new Set(["open","in_progress","resolved","closed"]),SEVERITIES=new Set(["low","medium","high","critical"]);
const issueSchemaReadyByDb=new WeakMap<object,Promise<void>>();
async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};}
function ensureTables(db:D1){const key=db as object,existing=issueSchemaReadyByDb.get(key);if(existing)return existing;const ready=ensureTablesImpl(db).catch(reason=>{issueSchemaReadyByDb.delete(key);throw reason});issueSchemaReadyByDb.set(key,ready);return ready;}
async function ensureTablesImpl(db:D1){
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_issues (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    task_id TEXT,
    issue_type TEXT NOT NULL DEFAULT 'issue',
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    owner_user_id TEXT,
    due_date TEXT,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(task_id) REFERENCES wbs_tasks(id),
    FOREIGN KEY(owner_user_id) REFERENCES users(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS project_issues_project_task_idx ON project_issues(project_id,task_id,status)").run();
  const columns=await db.prepare("PRAGMA table_info(project_issues)").all();
  const names=new Set((columns.results??[]).map((row:any)=>String(row.name)));
  if(!names.has("created_by"))await db.prepare("ALTER TABLE project_issues ADD COLUMN created_by TEXT").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS issue_attachments (
    id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, issue_id TEXT NOT NULL, file_key TEXT NOT NULL,
    file_name TEXT NOT NULL, file_size INTEGER NOT NULL DEFAULT 0, content_type TEXT, created_by TEXT, created_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(issue_id) REFERENCES project_issues(id), FOREIGN KEY(created_by) REFERENCES users(id)
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS issue_attachments_issue_idx ON issue_attachments(issue_id,created_at)").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_issue_actions (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,issue_id text NOT NULL,action text NOT NULL,note text,actor_user_id text,created_at integer NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(id),FOREIGN KEY(issue_id) REFERENCES project_issues(id) ON DELETE CASCADE)`).run();
}
const errorResponse=(error:unknown,fallback:string)=>Response.json({error:error instanceof Error?error.message:fallback},{status:500});

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  try{
    const {projectId}=await params;const {DB:db,FILES}=await runtime();await ensureTables(db);
    let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
    const project=await db.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
    const url=new URL(request.url);const attachmentId=url.searchParams.get("attachmentId");
    if(attachmentId){
      if(!FILES)return Response.json({error:"파일 저장소가 연결되지 않았습니다."},{status:503});
      const row=await db.prepare("SELECT file_key AS fileKey,file_name AS fileName,content_type AS contentType FROM issue_attachments WHERE id=? AND project_id=?").bind(attachmentId,projectId).first() as {fileKey:string;fileName:string;contentType?:string}|null;
      if(!row)return Response.json({error:"첨부파일을 찾을 수 없습니다."},{status:404});const object=await FILES.get(row.fileKey);if(!object)return Response.json({error:"저장된 파일을 찾을 수 없습니다."},{status:404});
      const safeName=encodeURIComponent(row.fileName).replace(/'/g,"%27");return new Response(object.body,{headers:{"content-type":row.contentType||object.httpMetadata?.contentType||"application/octet-stream","content-disposition":`attachment; filename*=UTF-8''${safeName}`}});
    }
    const taskId=url.searchParams.get("taskId");
    const rows=await db.prepare(`SELECT i.id,i.task_id AS taskId,i.issue_type AS issueType,i.title,i.description,i.severity,i.status,i.owner_user_id AS ownerUserId,owner.name AS ownerName,i.created_by AS createdByUserId,creator.name AS createdByName,i.due_date AS dueDate,i.created_at AS createdAt,i.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM issue_attachments a WHERE a.issue_id=i.id) AS attachmentCount
      FROM project_issues i LEFT JOIN users owner ON owner.id=i.owner_user_id LEFT JOIN users creator ON creator.id=i.created_by
      WHERE i.project_id=? ${taskId?"AND i.task_id=?":""} ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,i.updated_at DESC`).bind(...(taskId?[projectId,taskId]:[projectId])).all();
    const issueIds=(rows.results as any[]).map(r=>r.id);let attachments:any[]=[];
    if(issueIds.length){const marks=issueIds.map(()=>"?").join(",");const ar=await db.prepare(`SELECT a.id,a.issue_id AS issueId,a.file_name AS fileName,a.file_size AS fileSize,a.content_type AS contentType,a.created_at AS createdAt,u.name AS createdBy FROM issue_attachments a LEFT JOIN users u ON u.id=a.created_by WHERE a.issue_id IN (${marks}) ORDER BY a.created_at DESC`).bind(...issueIds).all();attachments=ar.results as any[];}
    const byIssue=new Map<string,any[]>();for(const a of attachments){const list=byIssue.get(a.issueId)||[];list.push(a);byIssue.set(a.issueId,list);}
    const actions=await db.prepare("SELECT a.id,a.issue_id AS issueId,a.action,a.note,a.created_at AS createdAt,u.name AS actorName FROM project_issue_actions a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.project_id=? ORDER BY a.created_at DESC").bind(projectId).all();
    return Response.json({issues:(rows.results as any[]).map(r=>({...r,attachments:byIssue.get(r.id)||[]})),actions:actions.results??[]});
  }catch(error){return errorResponse(error,"이슈 조회 중 오류가 발생했습니다.");}
}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  try{
    const {projectId}=await params;const {DB:db,FILES}=await runtime();await ensureTables(db);let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}const actor=context.userId;
    const project=await db.prepare("SELECT id,status FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first() as {id:string;status:string}|null;if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
    const form=await request.formData();const taskId=String(form.get("taskId")||"");const typeRaw=String(form.get("issueType")||"issue");const type=TYPES.has(typeRaw)?typeRaw:"issue";const title=String(form.get("title")||"").trim();const description=String(form.get("description")||"").trim();const severityRaw=String(form.get("severity")||"medium");const severity=SEVERITIES.has(severityRaw)?severityRaw:"medium";const ownerUserId=String(form.get("ownerUserId")||"")||null;const dueDate=String(form.get("dueDate")||"")||null;
    if(!taskId)return Response.json({error:"Task가 필요합니다."},{status:400});if(!title)return Response.json({error:"제목을 입력하세요."},{status:400});
    const task=await db.prepare("SELECT id,kind,assignee_user_id AS assigneeUserId FROM wbs_tasks WHERE id=? AND project_id=?").bind(taskId,projectId).first() as {id:string;kind:string;assigneeUserId?:string}|null;if(!task||task.kind==="summary")return Response.json({error:"실행 Task에만 등록할 수 있습니다."},{status:400});
    if(!canManageProject(context,access.projectRole)&&task.assigneeUserId!==context.userId)return Response.json({error:"담당자 본인의 Task에만 이슈를 등록할 수 있습니다."},{status:403});
    if(ownerUserId){const member=await db.prepare("SELECT 1 FROM project_members WHERE project_id=? AND user_id=?").bind(projectId,ownerUserId).first();if(!member)return Response.json({error:"프로젝트 참여자가 아닌 처리 담당자입니다."},{status:400});}
    const now=Math.floor(Date.now()/1000),id=crypto.randomUUID();
    await db.prepare("INSERT INTO project_issues (id,project_id,task_id,issue_type,title,description,severity,status,owner_user_id,due_date,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,projectId,taskId,type,title,description||null,severity,"open",ownerUserId,dueDate,actor,now,now).run();
    const files=form.getAll("files").filter((v):v is File=>v instanceof File&&v.size>0);if(files.length&&!FILES)return Response.json({error:"이슈는 등록되었지만 파일 저장소가 연결되지 않아 첨부파일을 저장하지 못했습니다.",id},{status:503});
    const statements:any[]=[];for(const file of files){const aid=crypto.randomUUID(),clean=file.name.replace(/[\\/:*?\"<>|]/g,"_"),key=`${projectId}/issues/${id}/${aid}-${clean}`;await FILES!.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"}});statements.push(db.prepare("INSERT INTO issue_attachments (id,project_id,issue_id,file_key,file_name,file_size,content_type,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(aid,projectId,id,key,file.name,file.size,file.type||null,actor,now));}
    statements.push(db.prepare("INSERT INTO project_issue_actions (id,project_id,issue_id,action,note,actor_user_id,created_at) VALUES (?,?,?,'CREATED',?,?,?)").bind(crypto.randomUUID(),projectId,id,description||null,actor,now));
    statements.push(db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,actor,"PROJECT_ISSUE_CREATED","PROJECT_ISSUE",id,JSON.stringify({projectId,projectStatus:project.status,taskId,issueType:type,title,severity,ownerUserId,attachmentCount:files.length}),now));await db.batch(statements);
    return Response.json({ok:true,id,createdByUserId:actor,attachmentCount:files.length,warning:project.status==="active"?null:`${project.status==="preparing"?"준비 중":"중단"} 프로젝트에서 등록했습니다.`});
  }catch(error){return errorResponse(error,"이슈 등록 중 오류가 발생했습니다.");}
}

type PatchInput={id?:string;issueType?:string;title?:string;description?:string;severity?:string;status?:string;ownerUserId?:string|null;dueDate?:string|null;note?:string;action?:string};
export async function PATCH(request:Request,{params}:{params:Promise<{projectId:string}>}){
  try{
    const {projectId}=await params;const {DB:db,FILES}=await runtime();await ensureTables(db);let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}const actor=context.userId;
    const multipart=request.headers.get("content-type")?.includes("multipart/form-data");let input:PatchInput;let files:File[]=[];
    if(multipart){const form=await request.formData();const text=(key:string)=>String(form.get(key)||"").trim();input={id:text("id"),action:text("action")||undefined,note:text("note")||undefined,status:text("status")||undefined,issueType:text("issueType")||undefined,title:text("title")||undefined,severity:text("severity")||undefined,ownerUserId:form.has("ownerUserId")?text("ownerUserId")||null:undefined,dueDate:form.has("dueDate")?text("dueDate")||null:undefined};files=form.getAll("files").filter((value):value is File=>value instanceof File&&value.size>0)}else input=await request.json() as PatchInput;
    if(!input.id)return Response.json({error:"대상이 필요합니다."},{status:400});
    const current=await db.prepare("SELECT id,owner_user_id AS ownerUserId,created_by AS createdBy FROM project_issues WHERE id=? AND project_id=?").bind(input.id,projectId).first() as {id:string;ownerUserId?:string;createdBy?:string}|null;if(!current)return Response.json({error:"대상을 찾을 수 없습니다."},{status:404});
    if(!canManageProject(context,access.projectRole)&&![current.ownerUserId,current.createdBy].includes(context.userId))return Response.json({error:"등록자·담당자 또는 PM/PL만 이 항목을 수정할 수 있습니다."},{status:403});
    if(input.ownerUserId){const member=await db.prepare("SELECT 1 FROM project_members WHERE project_id=? AND user_id=?").bind(projectId,input.ownerUserId).first();if(!member)return Response.json({error:"프로젝트 참여자가 아닌 처리 담당자입니다."},{status:400});}
    if(files.length&&!FILES)return Response.json({error:"파일 저장소가 연결되지 않아 회신 첨부파일을 저장할 수 없습니다."},{status:503});
    const now=Math.floor(Date.now()/1000),type=input.issueType&&TYPES.has(input.issueType)?input.issueType:null,severity=input.severity&&SEVERITIES.has(input.severity)?input.severity:null,status=input.status&&STATUSES.has(input.status)?input.status:null,note=input.note?.trim()||(!input.action?input.description?.trim():"")||null,action=input.action?.trim()||(status?`STATUS_${status.toUpperCase()}`:"UPDATED");
    const statements:any[]=[
      db.prepare(`UPDATE project_issues SET issue_type=COALESCE(?,issue_type),title=COALESCE(?,title),description=COALESCE(?,description),severity=COALESCE(?,severity),status=COALESCE(?,status),owner_user_id=CASE WHEN ?=1 THEN ? ELSE owner_user_id END,due_date=CASE WHEN ?=1 THEN ? ELSE due_date END,updated_at=? WHERE id=? AND project_id=?`).bind(type,input.title?.trim()||null,input.description===undefined?null:input.description.trim(),severity,status,input.ownerUserId!==undefined?1:0,input.ownerUserId||null,input.dueDate!==undefined?1:0,input.dueDate||null,now,input.id,projectId),
      db.prepare("INSERT INTO project_issue_actions (id,project_id,issue_id,action,note,actor_user_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),projectId,input.id,action,note,actor,now),
      db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,actor,"PROJECT_ISSUE_UPDATED","PROJECT_ISSUE",input.id,JSON.stringify({projectId,status,type,severity,ownerUserId:input.ownerUserId,action,attachmentCount:files.length}),now),
    ];
    for(const file of files){const attachmentId=crypto.randomUUID(),clean=file.name.replace(/[\\/:*?"<>|]/g,"_"),key=`${projectId}/issues/${input.id}/${attachmentId}-${clean}`;await FILES!.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"}});statements.push(db.prepare("INSERT INTO issue_attachments (id,project_id,issue_id,file_key,file_name,file_size,content_type,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(attachmentId,projectId,input.id,key,file.name,file.size,file.type||null,actor,now));}
    await db.batch(statements);return Response.json({ok:true,attachmentCount:files.length});
  }catch(error){return errorResponse(error,"이슈 수정 중 오류가 발생했습니다.");}
}
