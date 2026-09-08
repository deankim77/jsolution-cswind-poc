/* eslint-disable @typescript-eslint/no-explicit-any */
import type {RequestContext} from "../../../db/request-context";
import type {D1} from "./shared";
import {getStorageAdapter} from "../../../lib/storage-adapter";

type R2Bucket={put:(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:any)=>Promise<unknown>;delete:(key:string)=>Promise<unknown>};
export type SourceUploadInput={input:any;files:File[]};

export async function readSourceUpload(request:Request):Promise<SourceUploadInput>{
  const contentType=request.headers.get("content-type")||"";
  if(!contentType.includes("multipart/form-data"))return {input:await request.json(),files:[]};
  const form=await request.formData();
  let input:any={};
  try{input=JSON.parse(String(form.get("payload")||"{}"))}catch{throw new Error("등록 정보를 확인할 수 없습니다.")}
  const files=form.getAll("files").filter((value):value is File=>value instanceof File&&value.size>0);
  return {input,files};
}

export async function syncSourceAttachments(db:D1,context:RequestContext,{projectId,sourceType,sourceId,files,removeAttachmentIds=[]}:{projectId?:string|null;sourceType:"ECR"|"QUALITY";sourceId:string;files:File[];removeAttachmentIds?:string[]}){
  const removeIds=Array.from(new Set(removeAttachmentIds.map(String).filter(Boolean)));
  if(!files.length&&!removeIds.length)return {attachmentCount:0};
  const FILES=getStorageAdapter() as unknown as R2Bucket;
  if(!FILES)throw new Error("파일 저장소가 연결되지 않았습니다.");
  const normalizedProjectId=String(projectId||"").trim()||null;
  const now=Math.floor(Date.now()/1000),statements:any[]=[];
  if(removeIds.length){
    const placeholders=removeIds.map(()=>"?").join(",");
    const removing=await db.prepare(`SELECT id,file_key AS fileKey FROM workflow_source_attachments WHERE company_id=? AND source_type=? AND source_id=? AND id IN (${placeholders})`).bind(context.companyId,sourceType,sourceId,...removeIds).all<{id:string;fileKey:string}>();
    for(const item of removing.results??[])await FILES.delete(item.fileKey);
    if((removing.results??[]).length)statements.push(db.prepare(`DELETE FROM workflow_source_attachments WHERE id IN (${(removing.results??[]).map(()=>"?").join(",")})`).bind(...(removing.results??[]).map(item=>item.id)));
  }
  for(const file of files){
    const id=crypto.randomUUID(),clean=file.name.replace(/[\\/:*?"<>|]/g,"_"),scope=normalizedProjectId||"unassigned",key=`${scope}/${sourceType.toLowerCase()}/${sourceId}/${id}-${clean}`;
    await FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{originalName:file.name,sourceType,sourceId}});
    statements.push(db.prepare("INSERT INTO workflow_source_attachments (id,company_id,project_id,source_type,source_id,file_key,file_name,file_size,content_type,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id,context.companyId,normalizedProjectId,sourceType,sourceId,key,file.name,file.size,file.type||null,context.userId,now));
  }
  if(statements.length)await db.batch(statements);
  return {attachmentCount:files.length};
}

export async function reassignSourceAttachments(db:D1,context:RequestContext,sourceType:"ECR"|"QUALITY",sourceId:string,projectId?:string|null){
  const normalizedProjectId=String(projectId||"").trim()||null;
  await db.prepare("UPDATE workflow_source_attachments SET project_id=? WHERE company_id=? AND source_type=? AND source_id=?").bind(normalizedProjectId,context.companyId,sourceType,sourceId).run();
}

export async function removeSourceFiles(db:D1,context:RequestContext,sourceType:"ECR"|"QUALITY",sourceId:string){
  const rows=await db.prepare("SELECT file_key AS fileKey FROM workflow_source_attachments WHERE company_id=? AND source_type=? AND source_id=?").bind(context.companyId,sourceType,sourceId).all<{fileKey:string}>();
  if((rows.results??[]).length){const FILES=getStorageAdapter() as unknown as R2Bucket;for(const item of rows.results??[])await FILES.delete(item.fileKey)}
  await db.prepare("DELETE FROM workflow_source_attachments WHERE company_id=? AND source_type=? AND source_id=?").bind(context.companyId,sourceType,sourceId).run();
}