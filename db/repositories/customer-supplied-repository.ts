import {createHash,randomUUID} from 'node:crypto';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {getDb} from '../index';
import {customerSuppliedItems} from '../customer-supplied-schema';
import {customerReviews} from '../customer-review-schema';
import {customerRawData} from '../customer-data-schema';
import {productionBomRoots,customerPartIdentities,customerBomOccurrences} from '../pbom-schema';
import {productParts,productBomItems,bomEditLocks,bomRevisions,auditLogs} from '../schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {lockPbomCompany,createNumberedPart} from './pbom-repository';
import {assertNoProductionBulkLock} from './production-bulk-lock';
import {CustomerDataError} from '../../lib/customer-data-contract';
import {validateSuppliedFacts,suppliedKey,type SuppliedChoice} from '../../lib/customer-supplied-contract';
type Db=ReturnType<typeof getDb>;type Tx=Parameters<Parameters<Db['transaction']>[0]>[0];
const scoped=(s:CustomerDataScope)=>and(eq(customerSuppliedItems.companyId,s.companyId),eq(customerSuppliedItems.projectId,s.projectId));
const now=()=>Math.floor(Date.now()/1000);
const hash=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function state(db:Db|Tx,s:CustomerDataScope){
 const entries=await db.select().from(customerSuppliedItems).where(scoped(s)).orderBy(customerSuppliedItems.section,customerSuppliedItems.itemNumber);
 const roots=await db.select().from(productionBomRoots).where(eq(productionBomRoots.companyId,s.companyId));
 const root=roots.find(r=>r.projectId===s.projectId);
 const parts=await db.select().from(productParts).where(eq(productParts.companyId,s.companyId));
 const allEdges=await db.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId)).orderBy(productBomItems.id);
 const identities=await db.select().from(customerPartIdentities).where(and(eq(customerPartIdentities.companyId,s.companyId),eq(customerPartIdentities.projectId,s.projectId)));
 const reachable=new Set<string>();const walk=(id:string)=>{if(reachable.has(id))return;reachable.add(id);allEdges.filter(e=>e.parentPartId===id).forEach(e=>walk(e.childPartId));};if(root)walk(root.rootPartId);
 const edges=allEdges.filter(e=>reachable.has(e.parentPartId));
 const options=parts.filter(p=>reachable.has(p.id)||identities.some(i=>i.partId===p.id)).map(p=>({id:p.id,partNumber:p.partNumber,name:p.name,unit:p.unit,customerNumbers:identities.filter(i=>i.partId===p.id&&i.customerKey.startsWith('ITEM:')).map(i=>i.customerKey.slice(5))}));
 const assemblies=options.filter(p=>reachable.has(p.id)&&parts.some(v=>v.id===p.id&&['ASSEMBLY','SUB_ASSEMBLY','TOP_ITEM','PRODUCT'].includes(v.partType)));
 return {entries,roots,root,parts,allEdges,identities,reachable,edges,options,assemblies,fingerprint:hash({entries,edges})};
}
export function createCustomerSuppliedRepository(db=getDb()){return {
 async list(s:CustomerDataScope){const access=await customerDataAccess(db,s),data=await state(db,s);return {entries:data.entries,canReview:access.canReview,assemblies:data.assemblies,parts:data.options,edges:data.edges,fingerprint:data.fingerprint};},
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
  if(selected.some(r=>r.fact!.change==='review'))throw new CustomerDataError('변경 문구가 불명확한 항목은 원본을 확인해 주세요.',422);
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
     const value={id:old?.id??randomUUID(),companyId:s.companyId,projectId:s.projectId,section:fact.section,itemNumber,description,quantity:described?.quantity??fact.quantity,status:removed?'removed':'active',change:fact.change,changeText:fact.changeText,recordId:record.id,version:input.version,itemId:fact.id,sourceOrder,bomRecordId:old?.bomRecordId??null,partId:old?.partId??null,parentPartId:old?.parentPartId??null,bomApplied:Boolean(old?.bomApplied&&old.status===(removed?'removed':'active')&&old.quantity===(described?.quantity??fact.quantity)&&old.description===description),confirmedBy:s.userId,confirmedAt:at};
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
   const affectedParents=new Set<string>();
   for(const {fact:f,choice} of selected){const fact=f!;
    const numbers=fact.change==='replaced'?fact.replacementChain:[fact.itemNumber];
    const entries=numbers.map(itemNumber=>data.entries.find(e=>e.section===fact.section&&e.itemNumber===itemNumber));
    if(entries.some(e=>!e||e.recordId!==record.id||e.version!==input.version||e.itemId!==fact.id))throw new CustomerDataError('현재 분석 항목을 사급품 탭에서 먼저 확정하세요.',422);
    if(entries.every(e=>e!.bomApplied))continue;
    const parentId=choice.parentPartId;
    if(!parentId||!data.assemblies.some(a=>a.id===parentId))throw new CustomerDataError(`${fact.section}: 연결할 SECTION ASSY를 선택하세요.`,422);
    if(affectedParents.has(`${parentId}:${fact.itemNumber}`))throw new CustomerDataError('같은 BOM 연결이 중복 선택되었습니다.');affectedParents.add(`${parentId}:${fact.itemNumber}`);
    // Editing a shared assembly would alter another project's BOM; require project-specific structure.
    for(const other of data.roots.filter(r=>r.projectId!==s.projectId)){
     const seen=new Set<string>(),visit=(id:string):boolean=>{if(id===parentId)return true;if(seen.has(id))return false;seen.add(id);return data.allEdges.filter(e=>e.parentPartId===id).some(e=>visit(e.childPartId));};
     if(visit(other.rootPartId))throw new CustomerDataError('다른 프로젝트와 공유하는 ASSY입니다. 프로젝트 전용 ASSY로 연결하세요.',409);
    }
    let paths=0;const multipliers:number[]=[];const countPaths=(id:string,m:number,seen:Set<string>)=>{if(id===parentId){paths++;multipliers.push(m);return;}if(seen.has(id))return;for(const edge of data.edges.filter(e=>e.parentPartId===id))countPaths(edge.childPartId,edge.quantity===null?NaN:m*edge.quantity,new Set(seen).add(id));};countPaths(data.root.rootPartId,1,new Set());
    if(paths!==1||multipliers[0]!==1)throw new CustomerDataError('SECTION 수량과 BOM 단위 수량을 확인해야 합니다. TOP에서 1개로 연결된 단일 SECTION ASSY를 선택하세요.',422);
    for(const [index,entry] of entries.entries()){
     const row=entry!,removed=row.status==='removed',last=index===entries.length-1;
     const matches=data.identities.filter(i=>i.customerKey===`ITEM:${row.itemNumber}`);
     const selectedPart=last&&!removed?choice.partId:row.partId;
     if(selectedPart&&!data.options.some(p=>p.id===selectedPart))throw new CustomerDataError('프로젝트에서 연결 가능한 PART를 선택하세요.',422);
     if(selectedPart&&matches.length&&matches.every(m=>m.partId!==selectedPart))throw new CustomerDataError('고객 Item No.의 기존 PART 연결과 다릅니다.',409);
     let partId=selectedPart||matches[0]?.partId;
     let part=partId?data.parts.find(p=>p.id===partId):undefined;
     if(!partId&&!removed){
      if(!row.description)throw new CustomerDataError(`${row.itemNumber}: 대체 품목의 품명이 원본에 없습니다. 해당 고객 품목을 등록하거나 원본을 보완하세요.`,422);
      if(!choice.unit?.trim())throw new CustomerDataError(`${row.itemNumber}: 원본에 없는 수량 단위는 확인하여 입력하세요.`,422);
      part=await createNumberedPart(tx,s,row.description,'PART',choice.unit.trim(),row.description);partId=part.id;data.parts.push(part);
     }
     if(partId&&!data.identities.some(i=>i.customerKey===`ITEM:${row.itemNumber}`)){
      const identity={id:randomUUID(),companyId:s.companyId,projectId:s.projectId,customerKey:`ITEM:${row.itemNumber}`,partId,revision:part?.revision??''};await tx.insert(customerPartIdentities).values(identity);data.identities.push(identity);
     }
     if(row.parentPartId&&row.parentPartId!==parentId)throw new CustomerDataError('기존 SECTION ASSY 연결과 다릅니다. BOM 편집기에서 이동을 검토하세요.',409);
     if(partId&&data.entries.some(e=>e.id!==row.id&&e.parentPartId===parentId&&e.partId===partId&&e.section!==row.section))throw new CustomerDataError('다른 SECTION 사급품이 같은 BOM 연결을 사용하고 있습니다.',409);
     const edge=partId?data.allEdges.find(e=>e.parentPartId===parentId&&e.childPartId===partId):undefined;
     if(partId===parentId||data.allEdges.some(e=>e.parentPartId===partId))throw new CustomerDataError('하위 구조가 있는 ASSY는 사급품 부품으로 자동 반영할 수 없습니다.',422);
     if(removed){
      if(edge){await tx.delete(productBomItems).where(and(eq(productBomItems.companyId,s.companyId),eq(productBomItems.id,edge.id)));data.allEdges=data.allEdges.filter(e=>e.id!==edge.id);}
     }else{
      const unit=edge?.unit||part?.unit||choice.unit?.trim();if(!unit)throw new CustomerDataError('BOM 수량 단위를 확인하세요.',422);
      if(edge){await tx.update(productBomItems).set({quantity:row.quantity,unit,updatedAt:at}).where(eq(productBomItems.id,edge.id));edge.quantity=row.quantity;edge.unit=unit;}
      else{const value={id:randomUUID(),companyId:s.companyId,parentPartId:parentId,childPartId:partId!,quantity:row.quantity,unit,sortOrder:data.allEdges.filter(e=>e.parentPartId===parentId).length,note:`사급품 ${row.itemNumber}`,createdAt:at,updatedAt:at};await tx.insert(productBomItems).values(value);data.allEdges.push(value);}
     }
     await tx.update(customerSuppliedItems).set({partId:partId??null,parentPartId:parentId,bomRecordId:record.id,bomApplied:true}).where(and(scoped(s),eq(customerSuppliedItems.id,row.id)));changed++;
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
  if(changed)await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'CUSTOMER_SUPPLIED_CONFIRMED',entityType:'CUSTOMER_RAW_DATA',entityId:record.id,detail:JSON.stringify({projectId:s.projectId,area:input.area,version:input.version,choices:input.choices,customerConfirmationRecordedBy:s.userId,before,changed}),createdAt:at});
  return {ok:true,changed};
 });}
};}
