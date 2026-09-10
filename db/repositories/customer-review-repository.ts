import {randomUUID} from 'node:crypto';
import {and,eq,desc} from 'drizzle-orm';
import {getDb} from '../index';
import {customerReviews,customerConfirmedData} from '../customer-review-schema';
import {auditLogs} from '../schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {CustomerDataError} from '../../lib/customer-data-contract';
import type {ReviewDraft,ReviewMessage} from '../../lib/customer-review-contract';
export function createCustomerReviewRepository(db=getDb()) {
 const where=(s:CustomerDataScope)=>and(eq(customerReviews.companyId,s.companyId),eq(customerReviews.projectId,s.projectId));
 return {
 async list(s:CustomerDataScope){await customerDataAccess(db,s);return {reviews:await db.select().from(customerReviews).where(where(s)),confirmed:await db.select().from(customerConfirmedData).where(and(eq(customerConfirmedData.companyId,s.companyId),eq(customerConfirmedData.projectId,s.projectId))).orderBy(desc(customerConfirmedData.confirmedAt))};},
 async save(s:CustomerDataScope,recordId:string,version:number,draft:ReviewDraft,messages:ReviewMessage[]){return db.transaction(async tx=>{
 const p=await customerDataAccess(tx,s,true);if(!p.canReview)throw new CustomerDataError('PM 또는 PL만 분석·수정할 수 있습니다.',403);
 const [old]=await tx.select().from(customerReviews).where(and(where(s),eq(customerReviews.recordId,recordId)));
 if((old?.version??0)!==version)throw new CustomerDataError('다른 담당자가 수정했습니다. 최신 결과를 다시 불러오세요.',409);
 const values={companyId:s.companyId,projectId:s.projectId,recordId,version:version+1,draft,messages,updatedBy:s.userId,updatedAt:Math.floor(Date.now()/1000)};
 const [result]=await tx.insert(customerReviews).values(values).onConflictDoUpdate({target:customerReviews.recordId,set:values}).returning();
 await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'CUSTOMER_REVIEW_DRAFT_SAVED',entityType:'CUSTOMER_RAW_DATA',entityId:recordId,detail:JSON.stringify({version:result.version,draft}),createdAt:values.updatedAt});return result;
 });},
 async confirm(s:CustomerDataScope,recordId:string,version:number,itemIds:string[]){return db.transaction(async tx=>{
 const p=await customerDataAccess(tx,s,true);if(!p.canReview)throw new CustomerDataError('PM 또는 PL만 확정할 수 있습니다.',403);
 const [review]=await tx.select().from(customerReviews).where(and(where(s),eq(customerReviews.recordId,recordId)));
 if(!review||review.version!==version)throw new CustomerDataError('검토 결과가 변경되었습니다. 다시 확인하세요.',409);
 const items=review.draft.items.filter(i=>itemIds.includes(i.id));if(!items.length||items.length!==new Set(itemIds).size)throw new CustomerDataError('확정할 항목을 선택하세요.');
 const now=Math.floor(Date.now()/1000);
 await tx.insert(customerConfirmedData).values(items.map(item=>({id:randomUUID(),companyId:s.companyId,projectId:s.projectId,recordId,version,itemId:item.id,item,confirmedBy:s.userId,confirmedAt:now}))).onConflictDoNothing();
 await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'CUSTOMER_DATA_CONFIRMED',entityType:'CUSTOMER_RAW_DATA',entityId:recordId,detail:JSON.stringify({version,itemIds}),createdAt:now});return {ok:true};
 });}
 };
}
