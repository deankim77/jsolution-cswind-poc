import {createHash,randomUUID} from 'node:crypto';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {getDb} from '../index';
import {customerSuppliedItems} from '../customer-supplied-schema';
import {customerReviews} from '../customer-review-schema';
import {customerRawData} from '../customer-data-schema';
import {productionBomRoots,customerPartIdentities,customerBomOccurrences} from '../pbom-schema';
import {productParts,productBomItems,bomEditLocks,bomRevisions,auditLogs} from '../schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {lockPbomCompany} from './pbom-repository';
import {assertNoProductionBulkLock} from './production-bulk-lock';
import {CustomerDataError} from '../../lib/customer-data-contract';
import {validateSuppliedFacts,suppliedKey,type SuppliedChoice} from '../../lib/customer-supplied-contract';
type Db=ReturnType<typeof getDb>;type Tx=Parameters<Parameters<Db['transaction']>[0]>[0];
const scoped=(s:CustomerDataScope)=>and(eq(customerSuppliedItems.companyId,s.companyId),eq(customerSuppliedItems.projectId,s.projectId));
const now=()=>Math.floor(Date.now()/1000);
const hash=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function auditOrder(tx:Tx,s:CustomerDataScope,recordId:string){const logs=await tx.select().from(auditLogs).where(and(eq(auditLogs.companyId,s.companyId),eq(auditLogs.entityId,recordId)));return Math.max(Date.now(),...logs.map(l=>{try{return Number(JSON.parse(l.detail||'{}').eventOrder||0)+1}catch{return 0}}));}
async function state(db:Db|Tx,s:CustomerDataScope){
 const entries=await db.select().from(customerSuppliedItems).where(scoped(s)).orderBy(customerSuppliedItems.section,customerSuppliedItems.itemNumber);
 const roots=await db.select().from(productionBomRoots).where(eq(productionBomRoots.companyId,s.companyId));
 const root=roots.find(r=>r.projectId===s.projectId);
 const parts=await db.select().from(productParts).where(eq(productParts.companyId,s.companyId));
 const allEdges=await db.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId)).orderBy(productBomItems.id);
 const identities=await db.select().from(customerPartIdentities).where(and(eq(customerPartIdentities.companyId,s.companyId),eq(customerPartIdentities.projectId,s.projectId)));
 const reachable=new Set<string>();const walk=(id:string)=>{if(reachable.has(id))return;reachable.add(id);allEdges.filter(e=>e.parentPartId===id).forEach(e=>walk(e.childPartId));};if(root)walk(root.rootPartId);
 const edges=allEdges.filter(e=>reachable.has(e.parentPartId));
 const evidence=await db.select().from(customerBomOccurrences).where(and(eq(customerBomOccurrences.companyId,s.companyId),eq(customerBomOccurrences.projectId,s.projectId)));
 const options=parts.filter(p=>reachable.has(p.id)||identities.some(i=>i.partId===p.id)).map(p=>({id:p.id,partNumber:p.partNumber,name:p.name,unit:p.unit,customerNumbers:identities.filter(i=>i.partId===p.id&&i.customerKey.startsWith('ITEM:')).map(i=>i.customerKey.slice(5)).concat(evidence.filter(e=>allEdges.some(edge=>edge.id===e.bomItemId&&edge.childPartId===p.id)).map(e=>e.fact.customerItemNumber).filter(Boolean))}));
 const assemblies=options.filter(p=>reachable.has(p.id)&&parts.some(v=>v.id===p.id&&['ASSEMBLY','SUB_ASSEMBLY','TOP_ITEM','PRODUCT'].includes(v.partType)));
 return {entries,roots,root,parts,allEdges,identities,reachable,edges,options,assemblies,fingerprint:hash({entries,edges})};
}
export function createCustomerSuppliedRepository(db=getDb()){return {
 async list(s:CustomerDataScope){const access=await customerDataAccess(db,s),data=await state(db,s);return {entries:data.entries.map(e=>{const matches=data.options.filter(p=>data.reachable.has(p.id)&&p.customerNumbers.includes(e.itemNumber)),part=data.options.find(p=>p.id===e.partId)||(matches.length===1?matches[0]:undefined);return {...e,internalPartNumber:part?.partNumber??'',internalPartName:part?.name??''};}),canReview:access.canReview,assemblies:data.assemblies,parts:data.options,edges:data.edges,fingerprint:data.fingerprint};},
 async cancel(s:CustomerDataScope,input:{recordId:string;area:'supplied'|'bom';fingerprint:string}){return db.transaction(async tx=>{
  await lockPbomCompany(tx,s.companyId);await assertNoProductionBulkLock(tx,s);
  const access=await customerDataAccess(tx,s,true);if(!access.canReview)throw new CustomerDataError('PM 또는 PL만 확정 취소할 수 있습니다.',403);
  const data=await state(tx,s);if(data.fingerprint!==input.fingerprint)throw new CustomerDataError('사급품 또는 BOM이 변경되었습니다. 다시 조회하세요.',409);
  const logs=await tx.select().from(auditLogs).where(and(eq(auditLogs.companyId,s.companyId),eq(auditLogs.entityId,input.recordId))).orderBy(auditLogs.createdAt,auditLogs.id);
  const events=logs.filter(l=>['CUSTOMER_SUPPLIED_CONFIRMED','CUSTOMER_SUPPLIED_CANCELLED'].includes(l.action)).map(l=>({log:l,detail:JSON.parse(l.detail||'{}')})).filter(e=>e.detail.projectId===s.projectId&&e.detail.area===input.area).sort((a,b)=>(a.detail.eventOrder??a.log.createdAt*1000)-(b.detail.eventOrder??b.log.createdAt*1000));
  const lastCancel=events.findLastIndex(e=>e.log.action==='CUSTOMER_SUPPLIED_CANCELLED');
  const applied=events.slice(lastCancel+1).filter(e=>e.log.action==='CUSTOMER_SUPPLIED_CONFIRMED');
  if(!applied.length)return {ok:true,changed:0};
  const first=applied[0].detail,last=applied.at(-1)!.detail;
  const current=data.entries.filter(e=>e.recordId===input.recordId);
  if(input.area==='supplied'&&current.some(e=>e.bomApplied))throw new CustomerDataError('BOM 확정을 취소한 후 사급품 확정을 취소해 주세요.',409);
  const before=first.before.entries as typeof data.entries;
  // Legacy structural changes must not be silently discarded by a quantity-only cancellation.
  if(input.area==='bom'&&!last.afterEntries&&hash(first.before.edges)!==hash(data.edges))throw new CustomerDataError('이전 반영에서 BOM 구조·수량이 변경되었습니다. BOM 변경 이력을 확인한 후 취소해 주세요.',409);
  const after=(last.afterEntries??current) as typeof data.entries;
  const touched=after.filter(e=>e.recordId===input.recordId&&JSON.stringify(before.find(b=>b.id===e.id))!==JSON.stringify(e));
  for(const row of touched){const live=data.entries.find(e=>e.id===row.id);if(!live||live.recordId!==input.recordId||live.version!==row.version)throw new CustomerDataError('다른 분석 결과가 반영된 항목입니다. 최신 반영부터 취소해 주세요.',409);}
  for(const row of touched){const previous=before.find(e=>e.id===row.id);
   if(input.area==='bom')await tx.update(customerSuppliedItems).set({bomApplied:previous?.bomApplied??false,bomRecordId:previous?.bomRecordId??null,parentPartId:previous?.parentPartId??null,partId:previous?.partId??null}).where(and(scoped(s),eq(customerSuppliedItems.id,row.id)));
   else if(previous)await tx.update(customerSuppliedItems).set(previous).where(and(scoped(s),eq(customerSuppliedItems.id,row.id)));
   else await tx.delete(customerSuppliedItems).where(and(scoped(s),eq(customerSuppliedItems.id,row.id)));
  }
  if(input.area==='bom'&&touched.length&&data.root){
   const next=await state(tx,s),customerEvidence=await tx.select().from(customerBomOccurrences).where(and(eq(customerBomOccurrences.companyId,s.companyId),eq(customerBomOccurrences.projectId,s.projectId)));
   const snapshot={rootPartId:data.root.rootPartId,parts:next.parts.filter(p=>next.reachable.has(p.id)),bom:next.edges,customerEvidence,suppliedEvidence:next.entries};
   const [max]=await tx.select({n:sql<number>`coalesce(max(${bomRevisions.revisionSeq}),0)`}).from(bomRevisions).where(and(eq(bomRevisions.companyId,s.companyId),eq(bomRevisions.rootPartId,data.root.rootPartId)));const seq=Number(max.n)+1;
   await tx.insert(bomRevisions).values({id:randomUUID(),companyId:s.companyId,rootPartId:data.root.rootPartId,revisionSeq:seq,revision:`PBOM-${seq}`,structureHash:hash(snapshot),snapshotJson:JSON.stringify(snapshot),changeNote:'사급수량 확정 취소',createdBy:s.userId,createdAt:now()});
  }
  await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'CUSTOMER_SUPPLIED_CANCELLED',entityType:'CUSTOMER_RAW_DATA',entityId:input.recordId,detail:JSON.stringify({eventOrder:await auditOrder(tx,s,input.recordId),projectId:s.projectId,area:input.area,before:data.entries,changed:touched.length}),createdAt:now()});
  return {ok:true,changed:touched.length};
 });},
 async apply(s:CustomerDataScope,input:{recordId:string;version:number;area:'supplied'|'bom';choices:SuppliedChoice[];customerConfirmed:boolean;fingerprint:string}){return db.transaction(async tx=>{
  await lockPbomCompany(tx,s.companyId);await assertNoProductionBulkLock(tx,s);
  const access=await customerDataAccess(tx,s,true);if(!access.canReview)throw new CustomerDataError('PM 또는 PL만 확정할 수 있습니다.',403);
  if(!input.customerConfirmed)throw new CustomerDataError('고객의 추가·삭제·대체 확인을 완료한 뒤 확정하세요.');
  const [record]=await tx.select().from(customerRawData).where(and(eq(customerRawData.id,input.recordId),eq(customerRawData.companyId,s.companyId),eq(customerRawData.projectId,s.projectId)));
  const [review]=await tx.select().from(customerReviews).where(and(eq(customerReviews.recordId,input.recordId),eq(customerReviews.companyId,s.companyId),eq(customerReviews.projectId,s.projectId)));
  if(!record||record.sourcePurpose!=='supplied'||!review||review.version!==input.version)throw new CustomerDataError('원본 또는 분석 버전이 변경되었습니다. 다시 조회하세요.',409);
  const facts=validateSuppliedFacts(review.draft.suppliedItems),data=await state(tx,s);
  if(data.fingerprint!==input.fingerprint)throw new CustomerDataError('사급품 또는 BOM이 변경되었습니다. 다시 조회 후 확인하세요.',409);
  const selected=input.choices.map(choice=>({choice,fact:facts.find(f=>f.id===choice.itemId)}));
  if(!selected.length||selected.length>1000||new Set(input.choices.map(c=>c.itemId)).size!==selected.length||selected.some(r=>!r.fact))throw new CustomerDataError('반영할 항목을 선택하세요.');
  if(selected.some(r=>!r.fact!.itemNumber.trim()||!r.fact!.description.trim()||r.fact!.quantity===null))throw new CustomerDataError('선택 항목의 고객품번·품명·사급 수량을 확인한 뒤 확정하세요.',422);
  const selectedKeys=selected.map(r=>suppliedKey(r.fact!.section,r.fact!.itemNumber));if(new Set(selectedKeys).size!==selectedKeys.length)throw new CustomerDataError('선택한 고객품번이 중복됩니다. 사용할 항목을 선택하세요.',422);
  const sourceOrder=record.receiptNumber??record.createdAt,at=now();let changed=0;
  const before={entries:data.entries,edges:data.edges,customerEvidence:await tx.select().from(customerBomOccurrences).where(and(eq(customerBomOccurrences.companyId,s.companyId),eq(customerBomOccurrences.projectId,s.projectId)))};
  if(input.area==='supplied'){
   const updates=new Map<string,typeof customerSuppliedItems.$inferInsert>();
   for(const {fact:f} of selected){const fact=f!;
    const numbers=fact.change==='replaced'?fact.replacementChain:[fact.itemNumber];
    for(const [index,itemNumber] of numbers.entries()){
     const key=suppliedKey(fact.section,itemNumber),old=data.entries.find(e=>suppliedKey(e.section,e.itemNumber)===key);
     if(old&&(old.sourceOrder>sourceOrder||(old.recordId===record.id&&old.version>input.version)))throw new CustomerDataError('더 최근 원본이 반영된 항목입니다. 이전 문서로 덮어쓸 수 없습니다.',409);
     const removed=fact.change==='removed'||(fact.change==='replaced'&&index<numbers.length-1);
     const described=facts.find(r=>r.section===fact.section&&r.itemNumber===itemNumber);
     const description=described?.description??old?.description??'';
     const value={id:old?.id??randomUUID(),companyId:s.companyId,projectId:s.projectId,section:fact.section,itemNumber,description,quantity:described?.quantity??fact.quantity!,status:removed?'removed':'active',change:fact.change,changeText:fact.changeText,recordId:record.id,version:input.version,itemId:fact.id,sourceOrder,bomRecordId:old?.bomRecordId??null,partId:old?.partId??null,parentPartId:old?.parentPartId??null,bomApplied:Boolean(old?.bomApplied&&old.status===(removed?'removed':'active')&&old.quantity===(described?.quantity??fact.quantity)&&old.description===description),confirmedBy:s.userId,confirmedAt:at};
     if(updates.has(key))throw new CustomerDataError('대체 대상과 별도 행이 겹칩니다. 관련 항목을 나누어 검토하세요.',422);
     // Reconfirming the same snapshot preserves BOM application and produces no duplicate row.
     if(old&&old.recordId===record.id&&old.version===input.version&&old.itemId===fact.id)continue;
     updates.set(key,value);
    }
   }
   for(const value of updates.values())await tx.insert(customerSuppliedItems).values(value).onConflictDoUpdate({target:[customerSuppliedItems.companyId,customerSuppliedItems.projectId,customerSuppliedItems.section,customerSuppliedItems.itemNumber],set:value});
   changed=updates.size;
  }else{
   if(!data.root)throw new CustomerDataError('프로젝트 BOM TOP을 먼저 생성하세요.',422);
   const lockParts=new Set(data.reachable);
   const locks=await tx.insert(bomEditLocks).values([...lockParts].map(rootPartId=>({id:randomUUID(),companyId:s.companyId,rootPartId,lockedBy:s.userId,lockedAt:at,updatedAt:at}))).onConflictDoNothing().returning();
   if(locks.length!==lockParts.size)throw new CustomerDataError('BOM 편집을 마친 뒤 반영하세요.',409);
   for(const {fact:f,choice} of selected){const fact=f!;
    const numbers=fact.change==='replaced'?fact.replacementChain:[fact.itemNumber];
    const entries=numbers.map(itemNumber=>data.entries.find(e=>e.section===fact.section&&e.itemNumber===itemNumber));
    if(entries.some(e=>!e||e.recordId!==record.id||e.version!==input.version||e.itemId!==fact.id))throw new CustomerDataError('현재 분석 항목을 사급품 탭에서 먼저 확정하세요.',422);
    for(const row of entries){
     if(row!.bomApplied)continue;
     const matches=data.options.filter(p=>data.reachable.has(p.id)&&p.customerNumbers.includes(row!.itemNumber)&&data.edges.some(e=>e.childPartId===p.id));
     if(matches.length!==1)throw new CustomerDataError(`${row!.itemNumber}: 기존 BOM의 고객품번 연결을 확인하세요.`,422);
     const partId=matches[0].id;
     if(choice.partId&&row!.itemNumber===numbers.at(-1)&&choice.partId!==partId)throw new CustomerDataError('기존 BOM의 고객품번 연결이 변경되었습니다.',409);
     await tx.update(customerSuppliedItems).set({partId,parentPartId:null,bomRecordId:record.id,bomApplied:true}).where(and(scoped(s),eq(customerSuppliedItems.id,row!.id)));changed++;
    }
   }
   if(changed){
    const snapshotState=await state(tx,s),reachable=snapshotState.reachable;
    const evidence=await tx.select().from(customerBomOccurrences).where(and(eq(customerBomOccurrences.companyId,s.companyId),eq(customerBomOccurrences.projectId,s.projectId)));
    const snapshot={rootPartId:data.root.rootPartId,parts:snapshotState.parts.filter(p=>reachable.has(p.id)),bom:snapshotState.edges,customerEvidence:evidence,suppliedEvidence:snapshotState.entries};
    const [max]=await tx.select({n:sql<number>`coalesce(max(${bomRevisions.revisionSeq}),0)`}).from(bomRevisions).where(and(eq(bomRevisions.companyId,s.companyId),eq(bomRevisions.rootPartId,data.root.rootPartId)));const seq=Number(max.n)+1;
    await tx.insert(bomRevisions).values({id:randomUUID(),companyId:s.companyId,rootPartId:data.root.rootPartId,revisionSeq:seq,revision:`PBOM-${seq}`,structureHash:hash(snapshot),snapshotJson:JSON.stringify(snapshot),changeNote:`사급품 고객 확인 반영 v${input.version}`,createdBy:s.userId,createdAt:at});
   }
   await tx.delete(bomEditLocks).where(inArray(bomEditLocks.id,locks.map(l=>l.id)));
  }
  if(changed)await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'CUSTOMER_SUPPLIED_CONFIRMED',entityType:'CUSTOMER_RAW_DATA',entityId:record.id,detail:JSON.stringify({eventOrder:await auditOrder(tx,s,input.recordId),projectId:s.projectId,area:input.area,version:input.version,choices:input.choices,customerConfirmationRecordedBy:s.userId,before,afterEntries:(await state(tx,s)).entries,changed}),createdAt:at});
  return {ok:true,changed};
 });}
};}
