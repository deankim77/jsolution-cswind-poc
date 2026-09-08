/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
import {getStorageAdapter} from "../../../../../lib/storage-adapter";
import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
type R2Object={body:ReadableStream;httpMetadata?:{contentType?:string};customMetadata?:Record<string,string>};
type R2Bucket={put:(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:any)=>Promise<unknown>;get:(key:string)=>Promise<R2Object|null>};
async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;const {DB:db,FILES}=await runtime();
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!FILES)return Response.json({error:"파일 저장소가 연결되지 않았습니다."},{status:503});
  const body=await request.json() as {taskId?:string;sourceDeliverableId?:string;targetDeliverableId?:string};
  const taskId=String(body.taskId||"").trim(),sourceDeliverableId=String(body.sourceDeliverableId||"").trim(),targetDeliverableId=String(body.targetDeliverableId||"").trim();
  if(!taskId||!sourceDeliverableId)return Response.json({error:"연결할 Task와 기존 자료를 선택해 주세요."},{status:400});
  const task=await db.prepare("SELECT id,kind FROM wbs_tasks WHERE id=? AND project_id=?").bind(taskId,projectId).first() as {id:string;kind:string}|null;
  if(!task||task.kind==="summary")return Response.json({error:"실행 Task만 연결할 수 있습니다."},{status:400});
  const source=await db.prepare(`SELECT d.id,d.project_id AS projectId,d.name,d.category,d.required,d.status,d.file_key AS fileKey,COALESCE(d.document_kind,'document') AS documentKind,d.drawing_code AS drawingCode,d.drawing_company_id AS drawingCompanyId,d.drawing_type AS drawingType,d.internal_drawing_number AS internalDrawingNumber,d.customer_drawing_number AS customerDrawingNumber,d.owner_department AS ownerDepartment,d.owner_user_id AS ownerUserId,v.id AS versionId,v.revision,v.file_key AS versionFileKey,v.file_name AS fileName,v.file_size AS fileSize,v.content_type AS contentType,v.note,v.preview_file_key AS previewFileKey,v.conversion_status AS conversionStatus,v.conversion_error AS conversionError,v.converted_at AS convertedAt FROM deliverables d JOIN projects p ON p.id=d.project_id JOIN deliverable_versions v ON v.id=(SELECT v2.id FROM deliverable_versions v2 WHERE v2.deliverable_id=d.id AND v2.deleted_at IS NULL ORDER BY v2.revision DESC LIMIT 1) WHERE p.company_id=? AND d.id=?`).bind(context.companyId,sourceDeliverableId).first() as any;
  if(!source)return Response.json({error:"연결할 기존 문서·도면의 등록 파일을 찾을 수 없습니다."},{status:404});
  let targetId=targetDeliverableId;
  const now=Math.floor(Date.now()/1000);
  if(targetId){
    const target=await db.prepare("SELECT id,task_id AS taskId,status FROM deliverables WHERE id=? AND project_id=?").bind(targetId,projectId).first() as {id:string;taskId?:string;status:string}|null;
    if(!target)return Response.json({error:"연결 대상 산출물을 찾을 수 없습니다."},{status:404});
    if(target.taskId&&target.taskId!==taskId)return Response.json({error:"선택한 산출물과 Task가 일치하지 않습니다."},{status:409});
  }else{
    targetId=crypto.randomUUID();
    await db.prepare("INSERT INTO deliverables (id,project_id,task_id,name,category,required,status,source,created_by,created_at,updated_at,document_kind,drawing_code,drawing_company_id,drawing_type,internal_drawing_number,customer_drawing_number,owner_department,owner_user_id) VALUES (?,?,?,?,?,0,'planned','linked',?,?,?,?,?,?,?,?,?,?,?)").bind(targetId,projectId,taskId,source.name,source.category||null,context.userId,now,now,source.documentKind,source.drawingCode||null,null,source.drawingType||null,source.internalDrawingNumber||null,source.customerDrawingNumber||null,source.ownerDepartment||null,source.ownerUserId||context.userId).run();
  }
  const latest=await db.prepare("SELECT COALESCE(MAX(revision),0) AS revision FROM deliverable_versions WHERE deliverable_id=?").bind(targetId).first() as {revision:number}|null;
  const revision=Number(latest?.revision||0)+1,versionId=crypto.randomUUID();
  const cleanName=String(source.fileName||"linked-file").replace(/[\\/:*?\"<>|]/g,"_");
  const sourceObject=await FILES.get(source.versionFileKey);if(!sourceObject)return Response.json({error:"기존 자료의 원본 파일을 찾을 수 없습니다."},{status:404});
  const fileKey=`${projectId}/${targetId}/rev-${String(revision).padStart(2,"0")}-${versionId}-${cleanName}`;
  await FILES.put(fileKey,sourceObject.body,{httpMetadata:{contentType:source.contentType||sourceObject.httpMetadata?.contentType||"application/octet-stream"},customMetadata:{linkedFromDeliverableId:source.id,linkedFromVersionId:source.versionId,originalName:source.fileName}});
  let previewFileKey:string|null=null;
  if(source.previewFileKey){const preview=await FILES.get(source.previewFileKey);if(preview){previewFileKey=`${projectId}/${targetId}/rev-${String(revision).padStart(2,"0")}-${versionId}-preview${/pdf/i.test(preview.httpMetadata?.contentType||"")?".pdf":".txt"}`;await FILES.put(previewFileKey,preview.body,{httpMetadata:{contentType:preview.httpMetadata?.contentType||"application/octet-stream"},customMetadata:{linkedFromDeliverableId:source.id,linkedFromVersionId:source.versionId}})}}
  await db.batch([
    db.prepare("INSERT INTO deliverable_versions (id,project_id,deliverable_id,task_id,revision,file_key,file_name,file_size,content_type,note,created_by,created_at,preview_file_key,conversion_status,conversion_error,converted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(versionId,projectId,targetId,taskId,revision,fileKey,source.fileName,Number(source.fileSize||0),source.contentType||null,`기존 자료 연결 · ${source.name}`,context.userId,now,previewFileKey,source.conversionStatus||null,source.conversionError||null,source.convertedAt||null),
    db.prepare("UPDATE deliverables SET task_id=?,status='submitted',file_key=?,version=?,document_kind=?,drawing_code=?,drawing_company_id=NULL,drawing_type=?,internal_drawing_number=?,customer_drawing_number=?,owner_department=?,updated_at=? WHERE id=? AND project_id=?").bind(taskId,fileKey,`Rev.${String(revision).padStart(2,"0")}`,source.documentKind,source.drawingCode||null,source.drawingType||null,source.internalDrawingNumber||null,source.customerDrawingNumber||null,source.ownerDepartment||null,now,targetId,projectId),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,"DELIVERABLE_EXISTING_LINKED","DELIVERABLE",targetId,JSON.stringify({projectId,taskId,sourceDeliverableId,sourceVersionId:source.versionId,targetDeliverableId:targetId}),now)
  ]);
  return Response.json({ok:true,deliverableId:targetId,versionId,revision,version:`Rev.${String(revision).padStart(2,"0")}`,name:source.name,documentKind:source.documentKind,drawingCode:source.drawingCode||null});
}
