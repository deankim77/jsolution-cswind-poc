/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../../db/request-context";
import {getLegacyDbCompat} from "../../../../../../db/postgres-d1-compat";
import {getStorageAdapter} from "../../../../../../lib/storage-adapter";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
type R2Bucket={put:(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:any)=>Promise<unknown>};
async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  try{
    const {projectId}=await params;
    const {DB:db,FILES}=await runtime();
    let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
    const actor=context.userId;
    if(!FILES)return Response.json({error:"파일 저장소가 연결되지 않았습니다."},{status:503});
    const project=await db.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();
    if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
    const form=await request.formData();
    const issueId=String(form.get("issueId")||"");
    if(!issueId)return Response.json({error:"이슈가 필요합니다."},{status:400});
    const issue=await db.prepare("SELECT id FROM project_issues WHERE id=? AND project_id=?").bind(issueId,projectId).first();
    if(!issue)return Response.json({error:"이슈를 찾을 수 없습니다."},{status:404});
    const files=form.getAll("files").filter((value):value is File=>value instanceof File&&value.size>0);
    if(!files.length)return Response.json({error:"첨부할 파일을 선택하세요."},{status:400});
    const now=Math.floor(Date.now()/1000);
    const statements:any[]=[];
    for(const file of files){
      const attachmentId=crypto.randomUUID();
      const clean=file.name.replace(/[\\/:*?"<>|]/g,"_");
      const key=projectId+"/issues/"+issueId+"/"+attachmentId+"-"+clean;
      await FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"}});
      statements.push(db.prepare("INSERT INTO issue_attachments (id,project_id,issue_id,file_key,file_name,file_size,content_type,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(attachmentId,projectId,issueId,key,file.name,file.size,file.type||null,actor,now));
    }
    statements.push(db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,actor,"PROJECT_ISSUE_ATTACHMENTS_ADDED","PROJECT_ISSUE",issueId,JSON.stringify({projectId,attachmentCount:files.length}),now));
    await db.batch(statements);
    return Response.json({ok:true,attachmentCount:files.length});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"첨부파일 등록 중 오류가 발생했습니다."},{status:500});}
}
