import {REVIEW_TYPES} from '../lib/customer-review-contract';

/** Normalize optional model metadata only; never synthesize technical facts or evidence. */
export function prepareReviewResponse(value:any){
 if(!value||typeof value!=='object'||Array.isArray(value))return value;
 const result={...value};
 for(const key of ['drawingNumber','revisionLabel'])if(result[key]==null)result[key]='';
 for(const key of ['missingData','uncertainties'])if(result[key]==null)result[key]=[];
 if(typeof result.documentType==='string'){
  const name=result.documentType.trim();
  result.documentType=Object.keys(REVIEW_TYPES).find(key=>key===name.toLowerCase()||REVIEW_TYPES[key as keyof typeof REVIEW_TYPES]===name)??name;
 }
 // The title-block root is supplied as a separate, evidenced item, never guessed from a child.
 if(result.documentType==='drawing'&&result.drawingRoot!=null){
  const root=result.drawingRoot;
  if(!root||root.area!=='pbom'||!root.bom||root.bom.parentId!==null||root.bom.partType!=='ASSEMBLY'||typeof root.id!=='string'||!root.id.trim()||typeof root.bom.customerItemNumber!=='string'||!root.bom.customerItemNumber.trim()||typeof root.source!=='string'||!root.source.trim())throw Error('표제란 ASSY의 고객 Item No와 근거를 확인하세요.');
  if(!Array.isArray(result.items))throw Error('분석 항목 배열을 확인하세요.');
  const matches=result.items.filter((i:any)=>i.area==='pbom'&&i.recordId===root.recordId&&i.bom?.customerItemNumber?.trim()===root.bom.customerItemNumber.trim());
  if(matches.length>1||matches.some((i:any)=>i.bom.partType!=='ASSEMBLY'||i.bom.parentId!==null))throw Error('표제란 ASSY와 부품표의 품목 식별이 충돌합니다.');
  const parent=matches[0]??root;
  result.items=result.items.map((i:any)=>i.area==='pbom'&&i.recordId===root.recordId&&i!==parent&&i.bom?.parentId===null&&i.bom.partType==='PART'?{...i,bom:{...i.bom,parentId:parent.id}}:i);
  if(!matches.length)result.items=[root,...result.items];
  delete result.drawingRoot;
 }
 // AI recommendations are never human confirmation.
 result.documentTypeConfirmed=false;
 return result;
}
