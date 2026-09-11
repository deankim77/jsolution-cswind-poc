import {approvedPbomView} from '../../lib/production-pbom-view';
import {customerConfirmedData} from '../customer-review-schema';
import {normalizeReviewItem} from '../../lib/customer-review-contract';
import {assertNoProductionBulkLock} from './production-bulk-lock';
import {planPbomWithdrawal,type WithdrawalBaseline} from '../../lib/pbom-withdrawal';
import {randomUUID} from 'node:crypto';
import type {AnyPgColumn} from 'drizzle-orm/pg-core';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {getDb} from '../index';
import {auditLogs,bomEditLocks,bomRevisions,companies,partNumberHistory,partNumberSettings,productBomItems,productParts,projectsDb} from '../schema';
import {customerBomOccurrences,customerPartIdentities,productionBomRoots} from '../pbom-schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {CustomerDataError} from '../../lib/customer-data-contract';
import {bomIdentity,buildBomRows,pbomApprovalIssues,formatPartNumber,type BomFact,type BomRow,type ProjectPbom} from '../../lib/pbom-contract';
import type {ReviewItem} from '../../lib/customer-review-contract';
type Db=ReturnType<typeof getDb>;
type Tx=Parameters<Parameters<Db['transaction']>[0]>[0];
const now=()=>Math.floor(Date.now()/1000);
const scoped=(t:{companyId:AnyPgColumn;projectId:AnyPgColumn},s:CustomerDataScope)=>and(eq(t.companyId,s.companyId),eq(t.projectId,s.projectId));
export async function lockPbomCompany(tx:Tx,companyId:string){await tx.select({id:companies.id}).from(companies).where(eq(companies.id,companyId)).for('update');}
/** Uses the existing company setting and history; same namespace as manual PART creation. */
export async function createNumberedPart(tx:Tx,s:{companyId:string;userId:string},name:string,partType:string,unit='EA',spec=''){
 await tx.insert(partNumberSettings).values({companyId:s.companyId,updatedAt:now()}).onConflictDoNothing();
 for(let attempt=0;attempt<10000;attempt++){
  const [setting]=await tx.update(partNumberSettings).set({nextSequence:sql`${partNumberSettings.nextSequence}+1`,updatedAt:now()}).where(eq(partNumberSettings.companyId,s.companyId)).returning();
  const partNumber=formatPartNumber(setting,setting.nextSequence-1),t=now();
  const [duplicate]=await tx.select({id:productParts.id}).from(productParts).where(and(eq(productParts.companyId,s.companyId),sql`LOWER(${productParts.partNumber})=LOWER(${partNumber})`)).limit(1);if(duplicate)continue;
  const [part]=await tx.insert(productParts).values({id:randomUUID(),companyId:s.companyId,partNumber,name,partType,unit,spec,createdBy:s.userId,createdAt:t,updatedAt:t}).onConflictDoNothing().returning();
  if(!part)continue;
  await tx.insert(partNumberHistory).values({id:randomUUID(),companyId:s.companyId,partId:part.id,partNumber,ruleCode:`${setting.prefix}${setting.separator}SEQ${setting.digits}`,createdBy:s.userId,createdAt:t});return part;
 }
 throw new CustomerDataError('채번 설정의 다음 번호를 확인하세요.',409);
}
/** Caller holds company lock. Safe to call again for an existing production project. */
export async function ensureProductionBomRoot(tx:Tx,s:CustomerDataScope,name:string){
 const [old]=await tx.select().from(productionBomRoots).where(scoped(productionBomRoots,s));if(old)return old;
 const part=await createNumberedPart(tx,s,name,'TOP_ITEM');
 const [root]=await tx.insert(productionBomRoots).values({companyId:s.companyId,projectId:s.projectId,rootPartId:part.id,createdAt:now()}).returning();return root;
}
async function identityRows(db:Db|Tx,s:CustomerDataScope){return db.select({key:customerPartIdentities.customerKey,partId:productParts.id,partNumber:productParts.partNumber,revision:customerPartIdentities.revision}).from(customerPartIdentities).innerJoin(productParts,and(eq(productParts.id,customerPartIdentities.partId),eq(productParts.companyId,s.companyId))).where(scoped(customerPartIdentities,s));}
const emptyFact=(name:string):BomFact=>({parentId:null,section:'',itemDescription:name,position:'',customerItemNumber:'',drawingNumber:'',componentRevision:'',quantity:1,unit:'EA',weight:null,weightUnit:'',weightSource:'Not Available',drawingAvailability:'Need Review',partType:'PART',childrenComplete:false});
export function createPbomRepository(db=getDb()){return {
 async list(s:CustomerDataScope):Promise<ProjectPbom>{
  await customerDataAccess(db,s);
  const identities=await identityRows(db,s),[root]=await db.select({id:productParts.id,partNumber:productParts.partNumber,name:productParts.name}).from(productionBomRoots).innerJoin(productParts,and(eq(productParts.id,productionBomRoots.rootPartId),eq(productParts.companyId,s.companyId))).where(scoped(productionBomRoots,s));
  const confirmed=(await db.select().from(customerConfirmedData).where(scoped(customerConfirmedData,s))).map(r=>({...r,item:normalizeReviewItem(r.item)}));
  if(!root)return approvedPbomView({root:null,rows:[],identities},confirmed);
  const [parts,edges,occurrences]=await Promise.all([db.select().from(productParts).where(eq(productParts.companyId,s.companyId)),db.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId)),db.select().from(customerBomOccurrences).where(scoped(customerBomOccurrences,s))]);
  const rows:BomRow[]=[];
  const walk=(parent:string,parentRow:string|null,level:number,total:number|null,path:string,seen:Set<string>,parentSource?:typeof occurrences[number])=>{if(seen.has(parent))return;const next=new Set(seen).add(parent);
   for(const edge of edges.filter(e=>e.parentPartId===parent).sort((a,b)=>a.sortOrder-b.sortOrder)){
    const part=parts.find(p=>p.id===edge.childPartId);if(!part)continue;
    const sources=occurrences.filter(o=>o.bomItemId===edge.id).sort((a,b)=>b.confirmedAt-a.confirmedAt);
    let applicable=parentSource?sources.filter(o=>o.recordId===parentSource.recordId&&o.fact.parentId===parentSource.itemId):sources.filter(o=>o.fact.parentId===null);
    if(!applicable.length&&sources.length){const first=sources[0];applicable=sources.filter(o=>o.recordId===first.recordId&&o.fact.parentId===first.fact.parentId);}
    // Multiple documents may describe the same edge; they are evidence, not additional quantities.
    if(applicable.length){const record=applicable[0].recordId;applicable=applicable.filter(o=>o.recordId===record);}
    const sourceQuantity=applicable.reduce((n,o)=>n+(o.fact.quantity??0),0);
    const edited=applicable.length>0&&(Math.abs(sourceQuantity-edge.quantity)>1e-9||applicable.some(o=>o.fact.unit!==edge.unit));
    const variants:(typeof occurrences[number]|undefined)[]=applicable.length&&!edited?applicable:[applicable[0]];
    for(const primary of variants){const b:BomFact=primary?{...primary.fact,parentId:parentRow,quantity:edited?edge.quantity:primary.fact.quantity,unit:edge.unit}:{...emptyFact(part.name),parentId:parentRow,quantity:edge.quantity,unit:edge.unit,partType:['TOP_ITEM','PRODUCT','ASSEMBLY','SUB_ASSEMBLY'].includes(part.partType)?'ASSEMBLY':'PART'};
     const id=[parentRow,edge.id,primary?.id??'manual'].filter(Boolean).join('/'),qty=total===null||b.quantity===null?null:total*b.quantity;
     rows.push({id,sourceItemId:primary?.itemId,recordId:primary?.recordId??'',sourceRecordIds:[...new Set(sources.map(o=>o.recordId))],source:sources.map(o=>o.source).join('\n')+(edited?'\n수량·단위: BOM 편집기 변경':'' )||'BOM 편집기에서 추가',bom:b,level,path:`${path} / ${part.partNumber}`,totalQuantity:qty!==null&&Number.isFinite(qty)?qty:null,calculatedWeight:b.weight,calculatedWeightSource:b.weight!==null?b.weightSource:'Not Available',internalPartNumber:part.partNumber,partId:part.id,match:primary?'EXISTING':'MANUAL',changed:edited,changeLabel:edited?'수량·단위 변경':undefined});
     walk(part.id,id,level+1,qty,`${path} / ${part.partNumber}`,next,primary);
    }
   }
  };walk(root.id,null,1,1,root.partNumber,new Set());
  // Weight roll-up uses complete customer child lists only; manually added rows remain explicit unknowns.
  for(const row of [...rows].reverse()){const children=rows.filter(r=>r.bom.parentId===row.id);if(row.bom.weight===null&&row.bom.childrenComplete&&children.length&&row.bom.weightUnit&&children.every(c=>c.calculatedWeight!==null&&c.bom.weightUnit===row.bom.weightUnit&&c.bom.quantity!==null)){const sum=children.reduce((n,c)=>n+c.calculatedWeight!*c.bom.quantity!,0);if(Number.isFinite(sum)){row.calculatedWeight=sum;row.calculatedWeightSource='Calculated from Child BOM';}}}
  return approvedPbomView({root,rows,identities},confirmed);
 },
 async initialize(s:CustomerDataScope){return db.transaction(async tx=>{await lockPbomCompany(tx,s.companyId);const p=await customerDataAccess(tx,s,true);if(!p.canReview)throw new CustomerDataError('PM 또는 PL만 TOP을 생성할 수 있습니다.',403);const [project]=await tx.select().from(projectsDb).where(and(eq(projectsDb.id,s.projectId),eq(projectsDb.companyId,s.companyId)));return ensureProductionBomRoot(tx,s,project.name);});}
};}
/** Number approved items independently of whether quantities can yet form BOM edges. */
export async function numberApprovedPbom(tx:Tx,s:CustomerDataScope,items:ReviewItem[]){
 const known=new Map((await identityRows(tx,s)).map(i=>[i.key,i]));
 for(const item of items){if(!item.bom)continue;const b=item.bom,key=bomIdentity(b),alias=`APPROVED:${item.recordId}:${item.id}`;
  let match=known.get(key)||known.get(alias);
  if(!match){
   const part=await createNumberedPart(tx,s,b.itemDescription,b.partType,b.unit,b.material?.trim()||'');
   await tx.update(productParts).set({revision:'00'}).where(eq(productParts.id,part.id));
   match={key:key||alias,partId:part.id,partNumber:part.partNumber,revision:b.componentRevision};
  }
  for(const customerKey of new Set([key,alias].filter(Boolean)))if(!known.has(customerKey)){
   await tx.insert(customerPartIdentities).values({id:randomUUID(),companyId:s.companyId,projectId:s.projectId,customerKey,partId:match.partId,revision:b.componentRevision});
   known.set(customerKey,{...match,key:customerKey});
  }
 }
}
/** Called in the review confirmation transaction: confirmation and BOM changes commit together. */
export async function applyConfirmedPbom(tx:Tx,s:CustomerDataScope,recordId:string,version:number,items:ReviewItem[],force=false){
 await assertNoProductionBulkLock(tx,s,'pbom');
 if(items.some(i=>!i.bom||i.recordId!==recordId))throw new CustomerDataError('이 문서의 구조화된 BOM을 먼저 재분석하세요.',422);
 let rows=buildBomRows(items,await identityRows(tx,s));
 const issues=pbomApprovalIssues(rows);
 await numberApprovedPbom(tx,s,items);
 if(issues.length)return {conditional:true,issues};
 rows=buildBomRows(items,await identityRows(tx,s));
 const [project]=await tx.select().from(projectsDb).where(and(eq(projectsDb.id,s.projectId),eq(projectsDb.companyId,s.companyId)));
 const root=await ensureProductionBomRoot(tx,s,project.name);
 // Acquire the same root lock used by the existing editor, so neither writer can silently overwrite the other.
 const existingEdges=await tx.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId));
 const affected=new Set<string>([root.rootPartId,...rows.flatMap(r=>r.partId?[r.partId]:[])]);let added=true;while(added){added=false;for(const e of existingEdges)if(affected.has(e.parentPartId)&&!affected.has(e.childPartId)){affected.add(e.childPartId);added=true;}}
 const lockIds=[...affected].map(()=>randomUUID());
 const locks=await tx.insert(bomEditLocks).values([...affected].map((rootPartId,index)=>({id:lockIds[index],companyId:s.companyId,rootPartId,lockedBy:s.userId,lockedAt:now(),updatedAt:now()}))).onConflictDoNothing().returning();
 if(locks.length!==affected.size)throw new CustomerDataError('TOP 또는 하위 ASSY가 편집 중입니다. 체크인 후 확정하세요.',409);
 const occurrenceRows=await tx.select().from(customerBomOccurrences).where(scoped(customerBomOccurrences,s));
 const previous=occurrenceRows.filter(o=>o.recordId===recordId);
 if(!force&&previous.length&&previous.every(o=>o.version===version)&&previous.length===items.length){await tx.delete(bomEditLocks).where(inArray(bomEditLocks.id,lockIds));return;}
 const baselineLogs=previous.length?await tx.select().from(auditLogs).where(and(eq(auditLogs.companyId,s.companyId),eq(auditLogs.entityId,recordId),eq(auditLogs.action,'PBOM_CONFIRM_BASELINE'))):[];
 const priorBaseline=baselineLogs.map(log=>JSON.parse(log.detail||'{}')).filter(log=>log.projectId===s.projectId).sort((a,b)=>(b.sequence??0)-(a.sequence??0)||b.version-a.version)[0];
 const baseline:WithdrawalBaseline[]=[];
 const nodeParts=new Map<string,string>(),byKey=new Map((await identityRows(tx,s)).map(i=>[i.key,i]));
 for(const row of rows){const b=row.bom,key=bomIdentity(b);let match=byKey.get(key);
  if(!match){const part=await createNumberedPart(tx,s,b.itemDescription,b.partType,b.unit,b.material?.trim()||'');await tx.insert(customerPartIdentities).values({id:randomUUID(),companyId:s.companyId,projectId:s.projectId,customerKey:key,partId:part.id,revision:b.componentRevision});match={key,partId:part.id,partNumber:part.partNumber,revision:b.componentRevision};byKey.set(key,match);}
  else {
   const [part]=await tx.select().from(productParts).where(and(eq(productParts.id,match.partId),eq(productParts.companyId,s.companyId)));
   const role=['ASSEMBLY','SUB_ASSEMBLY'].includes(part.partType)?'ASSEMBLY':'PART';
   if(role!==b.partType)throw new CustomerDataError('기존 품목의 ASSY/부품 역할이 다릅니다. BOM 편집기에서 역할을 확인하세요.',409);
   await tx.update(customerPartIdentities).set({revision:b.componentRevision}).where(and(scoped(customerPartIdentities,s),eq(customerPartIdentities.customerKey,key)));
  }
  nodeParts.set(row.id,match.partId);
 }
 // Reused assemblies must describe the same child definition on every occurrence path.
 const definitions=new Map<string,string>();
 for(const parentRow of rows.filter(r=>r.bom.partType==='ASSEMBLY')){
  const children=rows.filter(r=>r.bom.parentId===parentRow.id);if(!children.length)continue;
  const counts=new Map<string,number>();for(const child of children){const key=`${nodeParts.get(child.id)}:${child.bom.unit}`;counts.set(key,(counts.get(key)??0)+child.bom.quantity!);}
  const signature=JSON.stringify([...counts].sort(([a],[b])=>a.localeCompare(b))),partId=nodeParts.get(parentRow.id)!;
  if(definitions.has(partId)&&definitions.get(partId)!==signature)throw new CustomerDataError('동일 ASSY의 하위 부품 구성이 서로 다릅니다. 문서 구조를 확인하세요.',422);definitions.set(partId,signature);
 }
 const groups=new Map<string,{parent:string;child:string;quantity:number;unit:string;rows:BomRow[]}>();
 for(const row of rows){const parent=row.bom.parentId?nodeParts.get(row.bom.parentId)!:root.rootPartId,child=nodeParts.get(row.id)!;
  if(parent===child)throw new CustomerDataError('같은 내부 품목을 자신의 하위에 연결할 수 없습니다.',422);
  const key=`${parent}:${child}`,old=groups.get(key);if(old&&old.unit!==row.bom.unit)throw new CustomerDataError('동일 품목 수량의 단위가 서로 다릅니다.',422);
  groups.set(key,{parent,child,quantity:0,unit:row.bom.unit,rows:[...(old?.rows??[]),row]});
 }
 for(const group of groups.values()){
  const perParent=new Map<string,number>();for(const row of group.rows){const parentOccurrence=row.bom.parentId??'TOP';perParent.set(parentOccurrence,(perParent.get(parentOccurrence)??0)+row.bom.quantity!);}
  const quantities=[...perParent.values()];if(quantities.some(q=>q!==quantities[0])||!Number.isFinite(quantities[0]))throw new CustomerDataError('동일 ASSY의 하위 수량 정의가 서로 다릅니다. 확인 후 확정하세요.',422);group.quantity=quantities[0];
 }
 const edges=await tx.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId));
 const reaches=(start:string,target:string,seen=new Set<string>()):boolean=>{if(start===target)return true;if(seen.has(start))return false;seen.add(start);return [...edges.map(e=>({parent:e.parentPartId,child:e.childPartId})),...groups.values()].some(e=>e.parent===start&&reaches(e.child,target,seen));};
 for(const group of groups.values())if(reaches(group.child,group.parent))throw new CustomerDataError('기존 BOM과 연결하면 순환 관계가 생깁니다.',422);
 // Do not silently remove a previous item: omitted rows require an explicit editor decision.
 const incomingEdges=new Set([...groups.values()].map(g=>`${g.parent}:${g.child}`));
 for(const old of previous){const edge=edges.find(e=>e.id===old.bomItemId);if(edge&&!incomingEdges.has(`${edge.parentPartId}:${edge.childPartId}`))throw new CustomerDataError('이전 확정 BOM에서 빠진 품목이 있습니다. BOM 편집기에서 변경 범위를 먼저 검토하세요.',409);}
 await tx.delete(customerBomOccurrences).where(and(scoped(customerBomOccurrences,s),eq(customerBomOccurrences.recordId,recordId)));
 for(const [index,group] of [...groups.values()].entries()){
  let edge=edges.find(e=>e.parentPartId===group.parent&&e.childPartId===group.child);
  const before=edge?{...edge}:null;
  const owners=edge?occurrenceRows.filter(o=>o.bomItemId===edge!.id):[];
  if(edge&&(edge.quantity!==group.quantity||edge.unit!==group.unit)&&(!owners.length||owners.some(o=>o.recordId!==recordId)))throw new CustomerDataError('기존 또는 다른 문서의 BOM 수량과 다릅니다. BOM 편집기에서 조정 후 재확인하세요.',409);
  if(edge){await tx.update(productBomItems).set({quantity:group.quantity,unit:group.unit,updatedAt:now()}).where(eq(productBomItems.id,edge.id));}
  else [edge]=await tx.insert(productBomItems).values({id:randomUUID(),companyId:s.companyId,parentPartId:group.parent,childPartId:group.child,quantity:group.quantity,unit:group.unit,sortOrder:index,createdAt:now(),updatedAt:now()}).returning();
  const original=priorBaseline?.edges?.find((b:WithdrawalBaseline)=>b.edgeId===edge!.id);
  baseline.push({edgeId:edge!.id,before:original?original.before:before,after:{...edge!,quantity:group.quantity,unit:group.unit}});
  await tx.insert(customerBomOccurrences).values(group.rows.map(row=>({id:randomUUID(),companyId:s.companyId,projectId:s.projectId,recordId,version,itemId:row.id,bomItemId:edge!.id,fact:row.bom,source:row.source,confirmedBy:s.userId,confirmedAt:now()})));
 }
 const allEdges=await tx.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId)),reachable=new Set<string>();const visit=(id:string)=>{if(reachable.has(id))return;reachable.add(id);allEdges.filter(e=>e.parentPartId===id).forEach(e=>visit(e.childPartId));};visit(root.rootPartId);
 const parts=await tx.select().from(productParts).where(and(eq(productParts.companyId,s.companyId),inArray(productParts.id,[...reachable])));
 const snapshot={rootPartId:root.rootPartId,parts:parts.map(({id,partNumber,name,partType,spec,unit,revision,status})=>({id,partNumber,name,partType,spec,unit,revision,status})).sort((a,b)=>a.partNumber.localeCompare(b.partNumber)),bom:allEdges.filter(e=>reachable.has(e.parentPartId)).map(({id,parentPartId,childPartId,quantity,unit,sortOrder,note})=>({id,parentPartId,childPartId,quantity,unit,sortOrder,note})),customerEvidence:await tx.select().from(customerBomOccurrences).where(scoped(customerBomOccurrences,s))};
 const [max]=await tx.select({n:sql<number>`COALESCE(MAX(${bomRevisions.revisionSeq}),0)`}).from(bomRevisions).where(and(eq(bomRevisions.companyId,s.companyId),eq(bomRevisions.rootPartId,root.rootPartId)));const seq=Number(max.n)+1;
 await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'PBOM_CONFIRM_BASELINE',entityType:'CUSTOMER_RAW_DATA',entityId:recordId,detail:JSON.stringify({projectId:s.projectId,version,sequence:seq,edges:baseline}),createdAt:now()});
 await tx.insert(bomRevisions).values({id:randomUUID(),companyId:s.companyId,rootPartId:root.rootPartId,revisionSeq:seq,revision:`PBOM-${seq}`,structureHash:`customer-${recordId}-${version}`,snapshotJson:JSON.stringify(snapshot),changeNote:`고객 문서 확정 v${version}`,createdBy:s.userId,createdAt:now()});
 await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'PBOM_CONFIRMED',entityType:'PROJECT',entityId:s.projectId,detail:JSON.stringify({recordId,version,rootPartId:root.rootPartId,items:items.length}),createdAt:now()});
 await tx.delete(bomEditLocks).where(inArray(bomEditLocks.id,lockIds));
}

/** The review repository owns the transaction and company/project locks. */
export async function withdrawConfirmedPbom(tx:Tx,s:CustomerDataScope,recordId:string){
 const allOccurrences=await tx.select().from(customerBomOccurrences).where(eq(customerBomOccurrences.companyId,s.companyId));
 const owned=allOccurrences.filter(o=>o.projectId===s.projectId&&o.recordId===recordId);if(!owned.length)return {retained:0};
 const edges=await tx.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId));
 const [root]=await tx.select().from(productionBomRoots).where(scoped(productionBomRoots,s));
 const affected=new Set(edges.filter(e=>owned.some(o=>o.bomItemId===e.id)).flatMap(e=>[e.parentPartId,e.childPartId]));if(root)affected.add(root.rootPartId);
 let added=true;while(added){added=false;for(const e of edges)if(affected.has(e.parentPartId)&&!affected.has(e.childPartId)){affected.add(e.childPartId);added=true;}}
 const lockIds=[...affected].map(()=>randomUUID());
 const locks=await tx.insert(bomEditLocks).values([...affected].map((rootPartId,i)=>({id:lockIds[i],companyId:s.companyId,rootPartId,lockedBy:s.userId,lockedAt:now(),updatedAt:now()}))).onConflictDoNothing().returning();
 if(locks.length!==affected.size)throw new CustomerDataError('BOM 편집을 마친 뒤 확정 취소를 다시 실행하세요.',409);
 const logs=await tx.select().from(auditLogs).where(and(eq(auditLogs.companyId,s.companyId),eq(auditLogs.entityId,recordId),eq(auditLogs.action,'PBOM_CONFIRM_BASELINE')));
 const baseline=logs.map(log=>JSON.parse(log.detail||'{}')).filter(log=>log.projectId===s.projectId&&owned.some(o=>o.version===log.version)).sort((a,b)=>(b.sequence??0)-(a.sequence??0)||b.version-a.version)[0];
 const plan=planPbomWithdrawal(edges,owned.map(o=>o.bomItemId),allOccurrences.filter(o=>o.recordId!==recordId||o.projectId!==s.projectId).map(o=>o.bomItemId),baseline?.edges??[]);
 // Audit captures the exact evidence and edge values before clearing active confirmation.
 await tx.insert(auditLogs).values({id:randomUUID(),companyId:s.companyId,actorUserId:s.userId,action:'PBOM_CONFIRMATION_CANCELLED',entityType:'CUSTOMER_RAW_DATA',entityId:recordId,detail:JSON.stringify({projectId:s.projectId,occurrences:owned,edges:edges.filter(e=>owned.some(o=>o.bomItemId===e.id)),plan}),createdAt:now()});
 await tx.delete(customerBomOccurrences).where(and(scoped(customerBomOccurrences,s),eq(customerBomOccurrences.recordId,recordId)));
 if(plan.remove.length)await tx.delete(productBomItems).where(and(eq(productBomItems.companyId,s.companyId),inArray(productBomItems.id,plan.remove)));
 for(const edge of plan.restore)await tx.update(productBomItems).set({quantity:edge.quantity,unit:edge.unit,sortOrder:edge.sortOrder,note:edge.note,updatedAt:now()}).where(and(eq(productBomItems.companyId,s.companyId),eq(productBomItems.id,edge.id)));
 if(root){
  const allEdges=await tx.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId));
  const reachable=new Set<string>();const visit=(id:string)=>{if(reachable.has(id))return;reachable.add(id);allEdges.filter(e=>e.parentPartId===id).forEach(e=>visit(e.childPartId))};visit(root.rootPartId);
  const parts=await tx.select().from(productParts).where(and(eq(productParts.companyId,s.companyId),inArray(productParts.id,[...reachable])));
  const evidence=await tx.select().from(customerBomOccurrences).where(scoped(customerBomOccurrences,s));
  const [max]=await tx.select({n:sql<number>`coalesce(max(${bomRevisions.revisionSeq}),0)`}).from(bomRevisions).where(and(eq(bomRevisions.companyId,s.companyId),eq(bomRevisions.rootPartId,root.rootPartId)));const seq=Number(max.n)+1;
  await tx.insert(bomRevisions).values({id:randomUUID(),companyId:s.companyId,rootPartId:root.rootPartId,revisionSeq:seq,revision:`PBOM-${seq}`,structureHash:`cancel-${recordId}-${seq}`,snapshotJson:JSON.stringify({rootPartId:root.rootPartId,parts,bom:allEdges.filter(e=>reachable.has(e.parentPartId)),customerEvidence:evidence}),changeNote:'고객 문서 확정 취소',createdBy:s.userId,createdAt:now()});
 }
 await tx.delete(bomEditLocks).where(inArray(bomEditLocks.id,lockIds));
 return {retained:plan.retained.length};
}
