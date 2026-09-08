/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../db/request-context";
import {workflowDb} from "../shared";
import {getStorageAdapter} from "../../../../lib/storage-adapter";

type R2Object={body:ReadableStream;httpMetadata?:{contentType?:string}};
type R2Bucket={get:(key:string)=>Promise<R2Object|null>};

export async function GET(request:Request){
  const db=await workflowDb();let context;
  try{context=await resolveRequestContext(request,db)}
  catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const url=new URL(request.url),attachmentId=url.searchParams.get("attachmentId")||"",sourceType=(url.searchParams.get("sourceType")||"").toUpperCase(),sourceId=url.searchParams.get("sourceId")||"";
  if(attachmentId){
    const item=await db.prepare("SELECT id,project_id AS projectId,file_key AS fileKey,file_name AS fileName,content_type AS contentType FROM workflow_source_attachments WHERE id=? AND company_id=?").bind(attachmentId,context.companyId).first<any>();
    if(!item)return Response.json({error:"첨부파일을 찾을 수 없습니다."},{status:404});
    if(item.projectId){try{await requireProjectAccess(db,context,item.projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"첨부파일 접근 권한이 없습니다."},{status:403})}}
    const FILES=getStorageAdapter() as unknown as R2Bucket;
    const object=await FILES.get(item.fileKey);if(!object)return Response.json({error:"저장된 파일을 찾을 수 없습니다."},{status:404});
    return new Response(object.body,{headers:{"content-type":item.contentType||object.httpMetadata?.contentType||"application/octet-stream","content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(item.fileName)}`}});
  }
  if(!["ECR","QUALITY"].includes(sourceType)||!sourceId)return Response.json({error:"첨부파일 조회 대상이 필요합니다."},{status:400});
  const sourceTable=sourceType==="ECR"?"design_change_requests":"quality_cases";
  const source=await db.prepare(`SELECT project_id AS projectId FROM ${sourceTable} WHERE id=? AND company_id=?`).bind(sourceId,context.companyId).first<{projectId?:string|null}>();
  if(!source)return Response.json({error:"등록 건을 찾을 수 없습니다."},{status:404});
  if(source.projectId){try{await requireProjectAccess(db,context,source.projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"첨부파일 접근 권한이 없습니다."},{status:403})}}
  const rows=await db.prepare("SELECT id,file_name AS fileName,file_size AS fileSize,content_type AS contentType,created_at AS createdAt FROM workflow_source_attachments WHERE company_id=? AND source_type=? AND source_id=? ORDER BY created_at,id").bind(context.companyId,sourceType,sourceId).all();
  return Response.json({attachments:rows.results??[]});
}