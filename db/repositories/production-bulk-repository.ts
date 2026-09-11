import {createHash,randomUUID} from 'node:crypto';
import {and,eq,inArray} from 'drizzle-orm';
import {getDb} from '../index';
import {customerConfirmedData,productionBulkLocks} from '../customer-review-schema';
import {auditLogs,bomEditLocks,productBomItems,productParts} from '../schema';
import {customerPartIdentities,productionBomRoots,customerBomOccurrences} from '../pbom-schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {applyConfirmedPbom,lockPbomCompany,numberApprovedPbom} from './pbom-repository';
import {normalizeReviewItem,validateReviewDraft,type BulkReviewArea as ReviewArea,type ConfirmedReview} from '../../lib/customer-review-contract';
import {activeBulkRows,mergeBulkEdits,type BulkRow} from '../../lib/production-bulk-edit';
import {bomIdentity} from '../../lib/pbom-contract';
import {CustomerDataError} from '../../lib/customer-data-contract';
type Db=ReturnType<typeof getDb>;type Tx=Parameters<Parameters<Db['transaction']>[0]>[0];
const now=()=>Math.floor(Date.now()/1000);
const scoped=(table:{companyId:any;projectId:any},s:CustomerDataScope)=>and(eq(table.companyId,s.companyId),eq(table.projectId,s.projectId));
async function readRows(db:Db|Tx,s:CustomerDataScope,area:ReviewArea){
 const all=await db.select().from(customerConfirmedData).where(scoped(customerConfirmedData,s));
 const rows=activeBulkRows(all.map(r=>({...r,item:normalizeReviewItem(r.item)})) as ConfirmedReview[],area);
 if(area!=='pbom')return rows;
 const identities=await db.select().from(customerPartIdentities).where(scoped(customerPartIdentities,s));
 const parts=await db.select().from(productParts).where(eq(productParts.companyId,s.companyId));
 return rows.map(row=>({...row,partNumber:parts.find(p=>p.id===identities.find(i=>row.item.bom&&i.customerKey===bomIdentity(row.item.bom))?.partId)?.partNumber||'신규'}));
}
async function fingerprint(db:Db|Tx,s:CustomerDataScope,area:ReviewArea,rows:BulkRow[]){
 const edges=area==='pbom'?await db.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId)):[];
 return createHash('sha256').update(JSON.stringify([rows,edges.sort((a,b)=>a.id.localeCompare(b.id))])).digest('hex');
}
export function createProductionBulkRepository(db=getDb()){return {
 async read(s:CustomerDataScope,area:ReviewArea){
 const permission=await customerDataAccess(db,s),rows=await readRows(db,s,area);
 const [lock]=await db.select().from(productionBulkLocks).where(and(scoped(productionBulkLocks,s),eq(productionBulkLocks.area,area)));
 return {rows,canEdit:permission.canReview,lock:lock?{mine:lock.owner===s.userId,owner:lock.owner,token:lock.owner===s.userId?lock.token:undefined}:null};
 },
 async mutate(s:CustomerDataScope,area:ReviewArea,action:string,token:string,input:unknown){return db.transaction(async tx=>{
 await lockPbomCompany(tx,s.companyId);
 const permission=await customerDataAccess(tx,s,action!=='cancel');if(action!=='cancel'&&!permission.canReview)throw new CustomerDataError('PM 또는 PL만 전체수정할 수 있습니다.',403);
 const [lock]=await tx.select().from(productionBulkLocks).where(and(scoped(productionBulkLocks,s),eq(productionBulkLocks.area,area)));
 let rows=await readRows(tx,s,area);
 if(action==='checkout'){
  if(lock)throw new CustomerDataError('이미 체크아웃 중입니다. 창을 다시 열어 편집 상태를 확인하세요.',409);
  if(!rows.length)throw new CustomerDataError('편집할 승인 항목이 없습니다.',422);
  const bomLockIds:string[]=[];
  if(area==='pbom'){
   await numberApprovedPbom(tx,s,rows.map(r=>r.item));
   rows=await readRows(tx,s,area);
   const identities=await tx.select().from(customerPartIdentities).where(scoped(customerPartIdentities,s));
   const roots=await tx.select().from(productionBomRoots).where(scoped(productionBomRoots,s));
   const parts=new Set([...identities.map(i=>i.partId),...roots.map(r=>r.rootPartId)]);
   const edges=await tx.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId));
   let more=true;while(more){more=false;for(const e of edges)if(parts.has(e.parentPartId)&&!parts.has(e.childPartId)){parts.add(e.childPartId);more=true;}}
   if(parts.size){const values=[...parts].sort().map(rootPartId=>({id:randomUUID(),companyId:s.companyId,rootPartId,lockedBy:s.userId,lockedAt:now(),updatedAt:now()}));
    const saved=await tx.insert(bomEditLocks).values(values).onConflictDoNothing().returning();if(saved.length!==values.length)throw new CustomerDataError('관련 BOM이 다른 편집창에서 체크아웃 중입니다.',409);bomLockIds.push(...saved.map(r=>r.id));}
  }
  const next={token:randomUUID(),companyId:s.companyId,projectId:s.projectId,area,owner:s.userId,createdAt:now(),fingerprint:await fingerprint(tx,s,area,rows),bomLockIds};
  await tx.insert(productionBulkLocks).values(next);
  return {rows,canEdit:true,lock:{mine:true,owner:s.userId,token:next.token}};
 }
 if(!lock||lock.owner!==s.userId||lock.token!==token)throw new CustomerDataError('본인이 체크아웃한 창에서만 처리할 수 있습니다.',409);
 if(action==='checkin'){
  if(await fingerprint(tx,s,area,rows)!==lock.fingerprint)throw new CustomerDataError('체크아웃 이후 데이터가 변경되었습니다. 입력을 복사해 보관한 뒤 편집 취소하고 다시 여세요.',409);
  if(lock.bomLockIds.length){const held=await tx.select().from(bomEditLocks).where(and(eq(bomEditLocks.companyId,s.companyId),eq(bomEditLocks.lockedBy,s.userId),inArray(bomEditLocks.id,lock.bomLockIds)));if(held.length!==lock.bomLockIds.length)throw new CustomerDataError('BOM 잠금이 변경되었습니다. 다시 체크아웃하세요.',409);}
 }
 // Release inside the same transaction, so validation/application failure restores the locks.
 await tx.delete(productionBulkLocks).where(eq(productionBulkLocks.token,lock.token));
 if(lock.bomLockIds.length)await tx.delete(bomEditLocks).where(and(eq(bomEditLocks.companyId,s.companyId),inArray(bomEditLocks.id,lock.bomLockIds)));
 if(action==='cancel')return {ok:true};
 let edited:BulkRow[];try{edited=mergeBulkEdits(rows,input,area);}catch(e){throw new CustomerDataError((e as Error).message,422);}
 const changed=edited.filter((row,index)=>JSON.stringify(row.item)!==JSON.stringify(rows[index].item));
 const changedDocs=new Set(changed.map(r=>r.recordId));
 for(const recordId of changedDocs){
  const group=edited.filter(r=>r.recordId===recordId);
  try{validateReviewDraft({documentType:'other',drawingNumber:'',revisionLabel:'',summary:'',uncertainties:[],items:group.map(r=>r.item)},[recordId]);}catch(e){throw new CustomerDataError((e as Error).message,422);}
  let issues:string[]=[];
  if(area==='pbom'){
   const occurrences=await tx.select().from(customerBomOccurrences).where(and(scoped(customerBomOccurrences,s),eq(customerBomOccurrences.recordId,recordId)));
   const edges=await tx.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId));
   for(const edgeId of new Set(occurrences.map(o=>o.bomItemId))){const sources=occurrences.filter(o=>o.bomItemId===edgeId),edge=edges.find(e=>e.id===edgeId);const parent=sources[0].fact.parentId;const quantity=sources.filter(o=>o.fact.parentId===parent).reduce((sum,o)=>sum+(o.fact.quantity??0),0);
    if(edge&&(Math.abs(edge.quantity-quantity)>1e-9||sources.some(o=>o.fact.unit!==edge.unit)))throw new CustomerDataError('기존 BOM 편집기에서 수량·단위가 변경된 항목입니다. 기존 편집기에서 해당 변경을 먼저 확인하세요.',409);
   }
   const result=await applyConfirmedPbom(tx,s,recordId,group[0].version,group.map(r=>r.item),true);issues=result?.issues??[];}
  for(const row of group){const item={...row.item,approval:{status:issues.length?'conditional' as const:'approved' as const,issues}};
   await tx.update(customerConfirmedData).set({item,confirmedBy:s.userId,confirmedAt:now()}).where(and(scoped(customerConfirmedData,s),eq(customerConfirmedData.id,row.id)));
  }
 }
 await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'PRODUCTION_BULK_CHECKIN',entityType:'PROJECT',entityId:s.projectId,detail:JSON.stringify({area,before:rows,after:edited,changed:changed.length}),createdAt:now()});
 return {ok:true,changed:changed.length};
 });}
};}
