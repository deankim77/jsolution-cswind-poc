/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
import {getStorageAdapter} from "../../../../../lib/storage-adapter";
import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";

type D1={prepare:(sql:string)=>any};
type R2Bucket={put:(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:any)=>Promise<unknown>};
async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;const {DB:db,FILES}=await runtime();
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!FILES)return Response.json({error:"파일 저장소가 연결되지 않았습니다."},{status:503});
  const form=await request.formData();const versionId=String(form.get("versionId")||"").trim();const pdf=form.get("pdf");
  if(!versionId||!(pdf instanceof File)||!pdf.size)return Response.json({error:"versionId와 변환 PDF가 필요합니다."},{status:400});
  const row=await db.prepare("SELECT v.id,v.deliverable_id AS deliverableId,v.revision,v.file_name AS fileName,d.drawing_code AS drawingCode FROM deliverable_versions v JOIN deliverables d ON d.id=v.deliverable_id WHERE v.id=? AND v.project_id=? AND v.deleted_at IS NULL").bind(versionId,projectId).first() as {id:string;deliverableId:string;revision:number;fileName:string;drawingCode?:string}|null;
  if(!row)return Response.json({error:"변환 결과를 연결할 도면 Revision을 찾을 수 없습니다."},{status:404});
  const previewKey=`${projectId}/${row.deliverableId}/rev-${String(row.revision).padStart(2,"0")}-${row.id}-preview.pdf`;
  await FILES.put(previewKey,pdf.stream(),{httpMetadata:{contentType:"application/pdf"},customMetadata:{sourceVersionId:row.id,sourceFileName:row.fileName,drawingCode:row.drawingCode||"",revision:String(row.revision),generatedBy:"z440-cad-worker"}});
  await db.prepare("UPDATE deliverable_versions SET preview_file_key=?,conversion_status='converted',conversion_error=NULL,converted_at=? WHERE id=? AND project_id=?").bind(previewKey,Math.floor(Date.now()/1000),row.id,projectId).run();
  return Response.json({ok:true,versionId:row.id,deliverableId:row.deliverableId,drawingCode:row.drawingCode||null,revision:row.revision,previewFileKey:previewKey,pdfFileName:pdf.name});
}
