/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
import {getStorageAdapter} from "../../../../../lib/storage-adapter";
import {nowSeconds,workflowDb,workflowDetail} from "../../shared";

export async function POST(request:Request,{params}:{params:Promise<{workflowId:string}>}){
  const {workflowId}=await params,db=await workflowDb();let context;
  try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const detail=await workflowDetail(db,context,workflowId);if(!detail)return Response.json({error:"Workflow를 찾을 수 없습니다."},{status:404});
  try{await requireProjectAccess(db,context,detail.workflow.project_id,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"Workflow 처리 권한이 없습니다."},{status:403})}
  const w=detail.workflow,steps=detail.steps as any[],current=steps.find(step=>Number(step.step_order)===Number(w.current_step_order)),isAdmin=context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));
  const canAdd=isAdmin||(w.status==="in_progress"&&current?.assignee_user_id===context.userId)||(["draft","supplement","recalled"].includes(w.status)&&w.requester_user_id===context.userId);
  if(!canAdd||!current)return Response.json({error:"현재 단계 담당자만 산출물을 추가할 수 있습니다."},{status:403});
  const input=await request.json() as {deliverableId?:string;versionId?:string};const deliverableId=String(input.deliverableId||""),versionId=String(input.versionId||"");
  if(!deliverableId||!versionId)return Response.json({error:"등록할 산출물 정보가 없습니다."},{status:400});
  const document=await db.prepare("SELECT d.id,d.name,v.id AS versionId,v.file_name AS fileName FROM deliverables d JOIN deliverable_versions v ON v.deliverable_id=d.id WHERE d.id=? AND d.project_id=? AND v.id=? AND v.project_id=? AND v.deleted_at IS NULL").bind(deliverableId,w.project_id,versionId,w.project_id).first<any>();
  if(!document)return Response.json({error:"프로젝트에 등록된 산출물을 찾을 수 없습니다."},{status:404});
  const exists=await db.prepare("SELECT id FROM workflow_step_documents WHERE workflow_id=? AND step_id=? AND deliverable_id=? AND version_id=?").bind(workflowId,current.id,deliverableId,versionId).first<any>();
  if(exists)return Response.json({ok:true,deliverableId,versionId,alreadyLinked:true});
  const now=nowSeconds();
  await db.batch([
    db.prepare("INSERT INTO workflow_step_documents (id,workflow_id,step_id,deliverable_id,version_id,document_action,change_reason,created_by,created_at) VALUES (?,?,?,?,?,'OUTPUT',NULL,?,?)").bind(crypto.randomUUID(),workflowId,current.id,deliverableId,versionId,context.userId,now),
    db.prepare("INSERT INTO workflow_instance_deliverables (workflow_id,deliverable_id,sort_order,created_at) SELECT ?,?,COALESCE(MAX(sort_order),-1)+1,? FROM workflow_instance_deliverables WHERE workflow_id=? AND NOT EXISTS(SELECT 1 FROM workflow_instance_deliverables WHERE workflow_id=? AND deliverable_id=?)").bind(workflowId,deliverableId,now,workflowId,workflowId,deliverableId),
    db.prepare("INSERT INTO workflow_history (id,workflow_id,step_id,actor_user_id,action,previous_status,next_status,comment,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),workflowId,current.id,context.userId,"STEP_OUTPUT_ADDED",w.status,w.status,`${document.name} · ${document.fileName}`,now)
  ]);
  return Response.json({ok:true,deliverableId,versionId,stepId:current.id,stepOrder:Number(current.step_order),stepName:current.name,fileName:document.fileName});
}

export async function DELETE(request:Request,{params}:{params:Promise<{workflowId:string}>}){
  const {workflowId}=await params,db=await workflowDb();let context;
  try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const detail=await workflowDetail(db,context,workflowId);if(!detail)return Response.json({error:"Workflow를 찾을 수 없습니다."},{status:404});
  try{await requireProjectAccess(db,context,detail.workflow.project_id,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"Workflow 처리 권한이 없습니다."},{status:403})}
  const w=detail.workflow,steps=detail.steps as any[],current=steps.find(step=>Number(step.step_order)===Number(w.current_step_order)),isAdmin=context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));
  const canRemove=isAdmin||(w.status==="in_progress"&&current?.assignee_user_id===context.userId)||(["draft","supplement","recalled"].includes(w.status)&&w.requester_user_id===context.userId);
  if(!canRemove||!current)return Response.json({error:"현재 단계 담당자만 단계 산출물을 삭제할 수 있습니다."},{status:403});
  const input=await request.json() as {deliverableId?:string;versionId?:string};const deliverableId=String(input.deliverableId||""),versionId=String(input.versionId||"");
  if(!deliverableId||!versionId)return Response.json({error:"삭제할 산출물 정보가 없습니다."},{status:400});
  const output=await db.prepare("SELECT sd.id,sd.step_id AS stepId,d.name,COALESCE(d.source,'planned') AS source,d.created_by AS createdBy,v.file_name AS fileName,v.file_key AS fileKey,v.preview_file_key AS previewFileKey FROM workflow_step_documents sd JOIN deliverables d ON d.id=sd.deliverable_id JOIN deliverable_versions v ON v.id=sd.version_id WHERE sd.workflow_id=? AND sd.step_id=? AND sd.deliverable_id=? AND sd.version_id=? AND sd.document_action='OUTPUT'").bind(workflowId,current.id,deliverableId,versionId).first<any>();
  if(!output)return Response.json({error:"현재 단계에 등록된 산출물을 찾을 수 없습니다."},{status:404});
  const now=nowSeconds();
  await db.prepare("DELETE FROM workflow_step_documents WHERE id=?").bind(output.id).run();
  const otherStepLinks=await db.prepare("SELECT COUNT(*) AS count FROM workflow_step_documents WHERE deliverable_id=?").bind(deliverableId).first<{count:number}>();
  const otherWorkflowLinks=await db.prepare("SELECT COUNT(*) AS count FROM workflow_instance_deliverables WHERE deliverable_id=? AND workflow_id<>?").bind(deliverableId,workflowId).first<{count:number}>();
  if(Number(otherStepLinks?.count||0)===0){
    await db.prepare("DELETE FROM workflow_instance_deliverables WHERE workflow_id=? AND deliverable_id=?").bind(workflowId,deliverableId).run();
  }
  const canDeleteAdHoc=String(output.source)==="ad_hoc"&&String(output.createdBy||"")===String(context.userId)&&Number(otherStepLinks?.count||0)===0&&Number(otherWorkflowLinks?.count||0)===0;
  if(canDeleteAdHoc){
    const versions=await db.prepare("SELECT id,file_key AS fileKey,preview_file_key AS previewFileKey FROM deliverable_versions WHERE deliverable_id=? AND project_id=?").bind(deliverableId,w.project_id).all();
    const storage=getStorageAdapter();
    for(const version of versions.results as Array<{fileKey?:string;previewFileKey?:string}>){if(version.fileKey)try{await storage.delete(version.fileKey)}catch{}if(version.previewFileKey)try{await storage.delete(version.previewFileKey)}catch{}}
    await db.batch([
      db.prepare("DELETE FROM deliverable_versions WHERE deliverable_id=? AND project_id=?").bind(deliverableId,w.project_id),
      db.prepare("DELETE FROM deliverables WHERE id=? AND project_id=?").bind(deliverableId,w.project_id)
    ]);
  }
  await db.prepare("INSERT INTO workflow_history (id,workflow_id,step_id,actor_user_id,action,previous_status,next_status,comment,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),workflowId,current.id,context.userId,"STEP_OUTPUT_REMOVED",w.status,w.status,`${output.name} · ${output.fileName}`,now).run();
  return Response.json({ok:true,deliverableId,versionId,deletedDocument:canDeleteAdHoc});
}
