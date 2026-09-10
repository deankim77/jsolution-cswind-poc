/** Customer occurrence data. Internal identity and quantities calculated by the system are not AI fields. */
export const DRAWING_AVAILABILITY=['Drawing Found','Missing Drawing','Standard Item','Purchased Item','Need Review'] as const;
export const DRAWING_AVAILABILITY_LABELS:Record<typeof DRAWING_AVAILABILITY[number],string>={
 'Drawing Found':'도면 확인',
 'Missing Drawing':'도면 누락',
 'Standard Item':'표준품 · 도면 미확인',
 'Purchased Item':'구매품 · 도면 미확인',
 'Need Review':'도면 미확인',
};
export const WEIGHT_SOURCES=['Direct from Drawing','Parts List','Calculated from Child BOM','Not Available'] as const;
export type BomFact={parentId:string|null;section:string;itemDescription:string;position:string;customerItemNumber:string;drawingNumber:string;componentRevision:string;quantity:number|null;unit:string;weight:number|null;weightUnit:string;weightSource:typeof WEIGHT_SOURCES[number];drawingAvailability:typeof DRAWING_AVAILABILITY[number];partType:'ASSEMBLY'|'PART';childrenComplete:boolean};
export type BomInput={id:string;recordId:string;source:string;bom?:BomFact};
export type BomRow=BomInput & {sourceRecordIds?:string[];bom:BomFact;level:number;path:string;totalQuantity:number|null;calculatedWeight:number|null;calculatedWeightSource:typeof WEIGHT_SOURCES[number];internalPartNumber?:string;partId?:string;match?:'NEW'|'EXISTING'|'NEED_REVIEW'|'MANUAL';changed?:boolean;changeLabel?:string};
export type BomIdentity={key:string;partId:string;partNumber:string;revision:string};
export type ProjectPbom={root:{id:string;partNumber:string;name:string}|null;rows:BomRow[];identities:BomIdentity[]};
export function bomIdentity(b:BomFact){return b.customerItemNumber.trim()?`ITEM:${b.customerItemNumber.trim()}`:b.drawingNumber.trim()?`DRAWING:${b.drawingNumber.trim()}`:'';}
/** Default only an unspecified document-root assembly quantity; preserve all explicit quantities. */
export function defaultDocumentRootQuantity<T extends BomInput>(item:T):T {
 const b=item.bom;
 return b?.parentId===null&&b.partType==='ASSEMBLY'&&b.quantity===null?{...item,bom:{...b,quantity:1}}:item;
}
export function validateBomFacts(items:BomInput[]){
 const entries=items.filter((i):i is BomInput&{bom:BomFact}=>Boolean(i.bom)),byId=new Map(entries.map(i=>[i.id,i]));
 const identities=new Map<string,BomFact>();
 for(const i of entries){const b=i.bom;
  if(!b||!['ASSEMBLY','PART'].includes(b.partType)||typeof b.childrenComplete!=='boolean'||!DRAWING_AVAILABILITY.includes(b.drawingAvailability)||!WEIGHT_SOURCES.includes(b.weightSource)||['section','itemDescription','position','customerItemNumber','drawingNumber','componentRevision','unit','weightUnit'].some(k=>typeof b[k as keyof BomFact]!=='string')||!b.itemDescription.trim())throw Error('BOM 필수 필드 형식을 확인하세요.');
  if(b.quantity!==null&&(typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<=0))throw Error('수량은 양수 또는 미확인(null)이어야 합니다.');
  if(b.weight!==null&&(typeof b.weight!=='number'||!Number.isFinite(b.weight)||b.weight<0))throw Error('중량은 0 이상 또는 미확인(null)이어야 합니다.');
  if(b.weight!==null&&(!b.weightUnit.trim()||!['Direct from Drawing','Parts List'].includes(b.weightSource)))throw Error('직접 추출 중량에는 단위와 원본 출처가 필요합니다.');
  if(b.parentId!==null&&(typeof b.parentId!=='string'||!byId.has(b.parentId)))throw Error('상위 ASSY 행을 확인하세요.');
  if(b.parentId){const parent=byId.get(b.parentId)!;if(parent.recordId!==i.recordId||parent.bom.partType!=='ASSEMBLY')throw Error('동일 문서의 ASSY 아래에 부품을 배치하세요.');}
  else if(b.partType!=='ASSEMBLY')throw Error('문서의 최상위 행은 ASSY여야 합니다.');
  const key=bomIdentity(b),previous=identities.get(key);if(key&&previous&&(previous.componentRevision!==b.componentRevision||previous.partType!==b.partType||previous.unit!==b.unit))throw Error('동일 고객 품목의 Revision·역할·단위가 서로 다릅니다.');if(key)identities.set(key,b);
  const seen=new Set<string>();let node:typeof i|undefined=i;
  while(node){if(seen.has(node.id))throw Error('BOM에 순환 관계가 있습니다.');seen.add(node.id);node=node.bom.parentId?byId.get(node.bom.parentId):undefined;}
 }
}
export function buildBomRows(items:BomInput[],identities:BomIdentity[]=[]):BomRow[]{
 validateBomFacts(items);const all=items.map(defaultDocumentRootQuantity).filter((i):i is BomInput&{bom:BomFact}=>Boolean(i.bom));const result:BomRow[]=[];
 const weight=(i:typeof all[number]):{value:number|null;source:typeof WEIGHT_SOURCES[number]}=>{
  if(i.bom.weight!==null)return {value:i.bom.weight,source:i.bom.weightSource};
  const children=all.filter(x=>x.bom.parentId===i.id);
  if(!i.bom.childrenComplete||!children.length)return {value:null,source:'Not Available'};
  let sum=0;for(const c of children){const w=weight(c);if(w.value===null||c.bom.quantity===null||!i.bom.weightUnit||c.bom.weightUnit!==i.bom.weightUnit)return {value:null,source:'Not Available'};sum+=w.value*c.bom.quantity;}
  return Number.isFinite(sum)?{value:sum,source:'Calculated from Child BOM'}:{value:null,source:'Not Available'};
 };
 const walk=(parentId:string|null,level:number,total:number|null,path:string)=>{for(const i of all.filter(x=>x.bom.parentId===parentId)){const b=i.bom,key=bomIdentity(b),matches=identities.filter(x=>x.key===key),match=matches.length===1?matches[0]:undefined,w=weight(i),qty=total===null||b.quantity===null?null:total*b.quantity;const row:BomRow={...i,level,path:[path,b.customerItemNumber||b.drawingNumber||b.itemDescription].filter(Boolean).join(' / '),totalQuantity:qty!==null&&Number.isFinite(qty)?qty:null,calculatedWeight:w.value,calculatedWeightSource:w.source,internalPartNumber:match?.partNumber,partId:match?.partId,match:!key||matches.length>1?'NEED_REVIEW':match?'EXISTING':'NEW',changed:Boolean(match&&match.revision!==b.componentRevision)};result.push(row);walk(i.id,level+1,row.totalQuantity,row.path);}};
 walk(null,1,1,'');return result;
}
export function formatPartNumber(setting:{prefix:string;separator:string;digits:number},sequence:number){
 if(!Number.isSafeInteger(sequence)||sequence<1||!Number.isInteger(setting.digits)||setting.digits<3||setting.digits>12||String(sequence).length>setting.digits)throw Error('품번 채번 범위가 초과되었거나 설정이 올바르지 않습니다.');
 return `${setting.prefix}${setting.separator}${String(sequence).padStart(setting.digits,'0')}`;
}

/** Depth presets affect only the current tree view, never stored BOM hierarchy. */
export function collapsedBomIdsAtDepth(rows:Pick<BomRow,'id'|'bom'|'level'>[],depth:number):string[]{
 const parents=new Set(rows.map(row=>row.bom.parentId).filter(Boolean));
 return rows.filter(row=>parents.has(row.id)&&row.level>=depth).map(row=>row.id);
}

/** Display the level-one assembly containing this occurrence, independently of source Section text. */
export function bomSectionName(row:BomRow,rows:BomRow[]):string {
 const byId=new Map(rows.map(item=>[item.id,item]));
 const seen=new Set<string>();
 let current:BomRow|undefined=row;
 while(current&&!seen.has(current.id)){
  seen.add(current.id);
  if(current.level===1)return current.bom.partType==='ASSEMBLY'?current.bom.itemDescription:'';
  current=current.bom.parentId?byId.get(current.bom.parentId):undefined;
 }
 return '';
}
