import {and,desc,eq,isNull,sql} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import {getDb} from '../index';
import {deliverables,deliverableVersions,projectsDb,wbsTasks,auditLogs} from '../schema';
import {customerRawData} from '../customer-data-schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {CustomerDataError} from '../../lib/customer-data-contract';
export function createCustomerDocumentRepository(db=getDb()){
 return {
 async links(companyId:string,projectId:string){return db.select({id:deliverables.id,taskId:deliverables.taskId}).from(deliverables).innerJoin(projectsDb,eq(projectsDb.id,deliverables.projectId)).where(and(eq(projectsDb.companyId,companyId),eq(deliverables.projectId,projectId),eq(deliverables.origin,'customer')));},
 async find(s:CustomerDataScope,deliverableId?:string,versionId?:string){
  if(!deliverableId&&!versionId)return null;
  const [doc]=await db.select({id:deliverables.id,origin:deliverables.origin}).from(deliverables).innerJoin(projectsDb,eq(projectsDb.id,deliverables.projectId)).where(and(eq(projectsDb.companyId,s.companyId),eq(deliverables.projectId,s.projectId),deliverableId?eq(deliverables.id,deliverableId):sql`${deliverables.id} IN (SELECT deliverable_id FROM deliverable_versions WHERE id=${versionId})`));
  if(!doc||doc.origin!=='customer')return null;
  await customerDataAccess(db,s);
  const records=await db.select().from(customerRawData).where(and(eq(customerRawData.companyId,s.companyId),eq(customerRawData.projectId,s.projectId),eq(customerRawData.deliverableId,doc.id))).orderBy(desc(customerRawData.revision));
  return {doc,records};
 },
 async update(s:CustomerDataScope,id:string,input:{name:string;taskId:string;category:string;required:boolean}){
  return db.transaction(async tx=>{
   const access=await customerDataAccess(tx,s,true);if(!access.canReview)throw new CustomerDataError('PM 또는 PL만 문서 정보를 수정할 수 있습니다.',403);
   const [doc]=await tx.select().from(deliverables).where(and(eq(deliverables.id,id),eq(deliverables.projectId,s.projectId),eq(deliverables.origin,'customer'))).for('update');
   if(!doc)throw new CustomerDataError('문서를 찾을 수 없습니다.',404);
   if(doc.status==='approved')throw new CustomerDataError('승인 완료된 문서는 정보를 수정할 수 없습니다.',409);
   if(input.taskId){const [task]=await tx.select().from(wbsTasks).where(and(eq(wbsTasks.id,input.taskId),eq(wbsTasks.projectId,s.projectId)));if(!task||task.kind==='summary')throw new CustomerDataError('실행 Task만 연결할 수 있습니다.');}
   const now=Math.floor(Date.now()/1000);
   await tx.update(deliverables).set({name:input.name,taskId:input.taskId||null,category:doc.documentKind==='drawing'?'DESIGN_DRAWING':input.category||null,required:input.required?1:0,updatedAt:now}).where(eq(deliverables.id,id));
   await tx.update(deliverableVersions).set({taskId:input.taskId||null}).where(and(eq(deliverableVersions.deliverableId,id),isNull(deliverableVersions.deletedAt)));
   await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'DELIVERABLE_INFO_UPDATED',entityType:'DELIVERABLE',entityId:id,detail:JSON.stringify({projectId:s.projectId,...input}),createdAt:now});
   return {ok:true,deliverableId:id};
  });
 }
 };
}
