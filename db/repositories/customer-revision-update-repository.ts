import {randomUUID} from 'node:crypto';
import {and,eq,inArray} from 'drizzle-orm';
import {getDb} from '../index';
import {auditLogs,bomEditLocks,productBomItems} from '../schema';
import {customerReviews,customerConfirmedData} from '../customer-review-schema';
import {customerBomOccurrences,customerPartIdentities,productionBomRoots} from '../pbom-schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {lockPbomCompany} from './pbom-repository';
import {compRevChanges} from '../../lib/customer-review-updates';
import {bomIdentity} from '../../lib/pbom-contract';
import {CustomerDataError} from '../../lib/customer-data-contract';
export function createCustomerRevisionUpdateRepository(db=getDb()){
 const scope=(table:typeof customerReviews|typeof customerBomOccurrences|typeof customerConfirmedData,s:CustomerDataScope,recordId:string)=>and(eq(table.companyId,s.companyId),eq(table.projectId,s.projectId),eq(table.recordId,recordId));
 return {
 async changes(s:CustomerDataScope,recordId:string){
 await customerDataAccess(db,s);
 const [review]=await db.select().from(customerReviews).where(scope(customerReviews,s,recordId));
 const existing=await db.select().from(customerBomOccurrences).where(scope(customerBomOccurrences,s,recordId));
 return {version:review?.version??0,changes:review?compRevChanges(review.draft,existing):[]};
 },
 async apply(s:CustomerDataScope,recordId:string,version:number,selected:{id:string;before:string;after:string}[]){return db.transaction(async tx=>{
 await lockPbomCompany(tx,s.companyId);
 const permission=await customerDataAccess(tx,s,true);if(!permission.canReview)throw new CustomerDataError('PM 또는 PL만 변경을 반영할 수 있습니다.',403);
 const [review]=await tx.select().from(customerReviews).where(scope(customerReviews,s,recordId));
 if(!review||review.version!==version)throw new CustomerDataError('분석 결과가 변경되었습니다. 다시 확인하세요.',409);
 const existing=await tx.select().from(customerBomOccurrences).where(scope(customerBomOccurrences,s,recordId));
 const available=compRevChanges(review.draft,existing),changes=available.filter(c=>selected.some(x=>x.id===c.id));
 if(!changes.length||changes.length!==selected.length||changes.some(c=>!selected.some(x=>x.id===c.id&&x.before===c.before&&x.after===c.after)))throw new CustomerDataError('기존 값 또는 변경 결과가 달라졌습니다. 새로고침 후 확인하세요.',409);
 const edges=await tx.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId));
 const affectedEdges=edges.filter(edge=>existing.some(o=>changes.some(c=>c.id===o.id)&&o.bomItemId===edge.id));
 const roots=await tx.select().from(productionBomRoots).where(and(eq(productionBomRoots.companyId,s.companyId),eq(productionBomRoots.projectId,s.projectId)));
 const affected=[...new Set([...affectedEdges.flatMap(e=>[e.parentPartId,e.childPartId]),...roots.map(r=>r.rootPartId)])];
 const timestamp=Math.floor(Date.now()/1000),lockIds=affected.map(()=>randomUUID());
 if(affected.length){const locks=await tx.insert(bomEditLocks).values(affected.map((rootPartId,i)=>({id:lockIds[i],companyId:s.companyId,rootPartId,lockedBy:s.userId,lockedAt:timestamp,updatedAt:timestamp}))).onConflictDoNothing().returning();if(locks.length!==affected.length)throw new CustomerDataError('BOM 편집 중입니다. 체크인 후 반영하세요.',409);}
 const confirmed=await tx.select().from(customerConfirmedData).where(scope(customerConfirmedData,s,recordId));
 const evidence=await tx.select().from(customerBomOccurrences).where(and(eq(customerBomOccurrences.companyId,s.companyId),eq(customerBomOccurrences.projectId,s.projectId)));
 const appliedKeys=new Map<string,string>();
 for(const change of changes){
 const old=existing.find(o=>o.id===change.id)!,key=bomIdentity(old.fact);
 const [identity]=await tx.select().from(customerPartIdentities).where(and(eq(customerPartIdentities.companyId,s.companyId),eq(customerPartIdentities.projectId,s.projectId),eq(customerPartIdentities.customerKey,key)));
 if(!identity||(!appliedKeys.has(key)&&identity.revision!==change.before))throw new CustomerDataError('품목 Revision이 별도로 변경되었습니다. 확인 후 다시 반영하세요.',409);
 if(evidence.some(o=>bomIdentity(o.fact)===key&&!changes.some(c=>c.id===o.id)&&o.fact.componentRevision!==change.after))throw new CustomerDataError('같은 품목의 다른 사용처와 Revision이 다릅니다. 함께 확인하세요.',409);
 await tx.update(customerBomOccurrences).set({fact:{...old.fact,componentRevision:change.after},source:`${old.source}\nCompRev 재검증 v${version}: ${change.source}`}).where(and(scope(customerBomOccurrences,s,recordId),eq(customerBomOccurrences.id,old.id)));
 await tx.update(customerPartIdentities).set({revision:change.after}).where(eq(customerPartIdentities.id,identity.id));appliedKeys.set(key,change.after);
 const matching=confirmed.filter(c=>c.item.bom&&bomIdentity(c.item.bom)===key);
 const latestVersion=Math.max(...matching.map(c=>c.version));
 for(const row of matching.filter(c=>c.version===latestVersion)){
 if(row.item.bom!.componentRevision!==change.before&&row.item.bom!.componentRevision!==change.after)throw new CustomerDataError('확정 정보가 별도로 수정되었습니다. 확인하세요.',409);
 await tx.update(customerConfirmedData).set({item:{...row.item,bom:{...row.item.bom!,componentRevision:change.after}}}).where(and(scope(customerConfirmedData,s,recordId),eq(customerConfirmedData.id,row.id)));
 }
 }
 await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'CUSTOMER_COMPREV_UPDATED',entityType:'CUSTOMER_RAW_DATA',entityId:recordId,detail:JSON.stringify({projectId:s.projectId,version,changes}),createdAt:timestamp});
 if(lockIds.length)await tx.delete(bomEditLocks).where(inArray(bomEditLocks.id,lockIds));
 return {ok:true,count:changes.length};
 });}
 };
}
