import {randomUUID} from 'node:crypto';
import {and,desc,eq,sql,isNull} from 'drizzle-orm';
import {deliverableReviews,deliverables,deliverableVersions,drawingCodeSequences} from '../schema';
import {customerRawData} from '../customer-data-schema';
import type {getDb} from '../index';
import type {CustomerDataScope} from './customer-data-repository';
import type {ReviewDraft} from '../../lib/customer-review-contract';
import {CustomerDataError} from '../../lib/customer-data-contract';
type Tx=Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
export function customerContentType(name:string){
 const ext=name.split('.').pop()?.toLowerCase();
 return ({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'} as Record<string,string>)[ext||'']||'application/octet-stream';
}
export async function registerCustomerDocument(tx:Tx,s:CustomerDataScope,data:{title:string;fileKey:string;fileName:string;fileSize:number;note?:string|null},previous:typeof customerRawData.$inferSelect|null,now:number){
 const deliverableId=previous?.deliverableId||randomUUID(),versionId=randomUUID();
 let revision=1;
 if(previous){
  const [doc]=await tx.select().from(deliverables).where(and(eq(deliverables.id,deliverableId),eq(deliverables.projectId,s.projectId))).for('update');
  if(!doc||doc.origin!=='customer')throw new CustomerDataError('연결된 고객 산출물을 찾을 수 없습니다.',409);
  const [last]=await tx.select().from(deliverableVersions).where(eq(deliverableVersions.deliverableId,deliverableId)).orderBy(desc(deliverableVersions.revision)).limit(1);
  revision=(last?.revision||0)+1;
 }else await tx.insert(deliverables).values({id:deliverableId,projectId:s.projectId,name:data.title,required:0,source:'ad_hoc',origin:'customer',status:'submitted',createdBy:s.userId,createdAt:now,updatedAt:now});
 await tx.insert(deliverableVersions).values({id:versionId,projectId:s.projectId,deliverableId,revision,fileKey:data.fileKey,fileName:data.fileName,fileSize:data.fileSize,contentType:customerContentType(data.fileName),note:data.note,createdBy:s.userId,createdAt:now});
 await tx.update(deliverables).set({fileKey:data.fileKey,version:`Rev.${String(revision).padStart(2,'0')}`,status:'submitted',updatedAt:now}).where(eq(deliverables.id,deliverableId));
 return {deliverableId,deliverableVersionId:versionId};
}
export async function syncCustomerDocumentType(tx:Tx,s:CustomerDataScope,recordId:string,draft:ReviewDraft){
 const [raw]=await tx.select().from(customerRawData).where(and(eq(customerRawData.id,recordId),eq(customerRawData.projectId,s.projectId),eq(customerRawData.companyId,s.companyId)));
 if(!raw)throw new CustomerDataError('원본 문서를 찾을 수 없습니다.',404);
 await tx.update(deliverableVersions).set({documentType:draft.documentType,sourceDocumentNumber:draft.drawingNumber.trim()||null,sourceRevision:draft.revisionLabel.trim()||null}).where(eq(deliverableVersions.id,raw.deliverableVersionId));
 const [latest]=await tx.select().from(deliverableVersions).where(and(eq(deliverableVersions.deliverableId,raw.deliverableId),isNull(deliverableVersions.deletedAt))).orderBy(desc(deliverableVersions.revision)).limit(1);
 if(latest?.id!==raw.deliverableVersionId)return;
 const [doc]=await tx.select().from(deliverables).where(eq(deliverables.id,raw.deliverableId));
 if(!doc)return;
 let code=doc.drawingCode;
 if(draft.documentType==='drawing'&&!code){
  const year=new Date().getUTCFullYear();
  await tx.insert(drawingCodeSequences).values({companyId:s.companyId,issueYear:year,nextValue:1}).onConflictDoNothing();
  const [sequence]=await tx.update(drawingCodeSequences).set({nextValue:sql`${drawingCodeSequences.nextValue}+1`}).where(and(eq(drawingCodeSequences.companyId,s.companyId),eq(drawingCodeSequences.issueYear,year))).returning();
  code=`DWG-${year}-${String(sequence.nextValue-1).padStart(6,'0')}`;
 }
 const drawing=draft.documentType==='drawing';
 await tx.update(deliverables).set({documentKind:drawing?'drawing':'document',drawingCode:code,drawingCompanyId:drawing?s.companyId:doc.drawingCompanyId,customerDrawingNumber:drawing?(draft.drawingNumber.trim()||doc.customerDrawingNumber):doc.customerDrawingNumber,category:drawing?'DESIGN_DRAWING':doc.category==='DESIGN_DRAWING'?null:doc.category,updatedAt:Math.floor(Date.now()/1000)}).where(eq(deliverables.id,raw.deliverableId));
}
export async function assertCustomerDocumentDeletable(tx:Tx,s:CustomerDataScope,records:typeof customerRawData.$inferSelect[]){
 for(const id of new Set(records.map(r=>r.deliverableId).filter(Boolean))){
  const [doc]=await tx.select().from(deliverables).where(and(eq(deliverables.id,id),eq(deliverables.projectId,s.projectId)));
  if(doc?.status==='approved')throw new CustomerDataError('승인 완료된 문서는 삭제할 수 없습니다.',409);
  const result=await tx.execute(sql`SELECT 1 FROM workflow_instances WHERE main_deliverable_id=${id} UNION ALL SELECT 1 FROM workflow_instance_deliverables WHERE deliverable_id=${id} UNION ALL SELECT 1 FROM workflow_step_documents WHERE deliverable_id=${id} LIMIT 1`);
  if(result.rows.length)throw new CustomerDataError('Workflow에 연결된 문서입니다. 연결을 해제한 후 삭제해 주세요.',409);
 }
}
export async function removeCustomerDocumentVersions(tx:Tx,s:CustomerDataScope,records:typeof customerRawData.$inferSelect[]){
 const now=Math.floor(Date.now()/1000);
 for(const r of records){if(r.deliverableVersionId){await tx.delete(deliverableReviews).where(eq(deliverableReviews.versionId,r.deliverableVersionId));await tx.update(deliverableVersions).set({deletedAt:now,deletedBy:s.userId}).where(eq(deliverableVersions.id,r.deliverableVersionId));}}
 for(const id of new Set(records.map(r=>r.deliverableId).filter(Boolean))){
  const [latest]=await tx.select().from(deliverableVersions).where(and(eq(deliverableVersions.deliverableId,id),isNull(deliverableVersions.deletedAt))).orderBy(desc(deliverableVersions.revision)).limit(1);
  if(latest){
   await tx.update(deliverables).set({fileKey:latest.fileKey,version:`Rev.${String(latest.revision).padStart(2,'0')}`,status:'submitted',updatedAt:now}).where(eq(deliverables.id,id));
   const [raw]=await tx.select().from(customerRawData).where(eq(customerRawData.deliverableVersionId,latest.id));
   if(raw)await syncCustomerDocumentType(tx,s,raw.id,{documentType:(latest.documentType||'other') as ReviewDraft['documentType'],revisionLabel:latest.sourceRevision||'',drawingNumber:latest.sourceDocumentNumber||'',summary:'',uncertainties:[],items:[]});
  }else{
   // No customer source remains; remove the empty document from the formal library.
   await tx.delete(deliverableReviews).where(eq(deliverableReviews.deliverableId,id));
   await tx.delete(deliverableVersions).where(eq(deliverableVersions.deliverableId,id));
   await tx.delete(deliverables).where(eq(deliverables.id,id));
  }
 }
}
