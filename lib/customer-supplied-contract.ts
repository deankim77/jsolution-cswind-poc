export type SuppliedChange='listed'|'added'|'removed'|'replaced'|'review';
export const SUPPLIED_CHANGE_LABELS={listed:'기재',added:'추가',removed:'삭제',replaced:'대체',review:'확인 필요'} as const;
export type SuppliedFact={id:string;section:string;itemNumber:string;description:string;quantity:number;change:SuppliedChange;changeText:string;replacementChain:string[];source:string};
export type SuppliedEntry={id:string;section:string;itemNumber:string;description:string;quantity:number;status:string;change:string;changeText:string;recordId:string;version:number;itemId:string;parentPartId:string|null;partId:string|null;bomApplied:boolean};
export type SuppliedChoice={itemId:string;parentPartId?:string;partId?:string;unit?:string};
export type SuppliedData={fingerprint:string;entries:SuppliedEntry[];canReview:boolean;assemblies:{id:string;partNumber:string;name:string;customerNumbers:string[]}[];parts:{id:string;partNumber:string;name:string;customerNumbers:string[];unit:string}[];edges:{id:string;parentPartId:string;childPartId:string;quantity:number|null;unit:string}[]};
export function suppliedKey(section:string,itemNumber:string){return JSON.stringify([section.trim(),itemNumber.trim()]);}
export function classifySuppliedChange(text:string,itemNumber:string):Pick<SuppliedFact,'change'|'replacementChain'>{
 const replacements=[...text.matchAll(/Item\s+(\S+)\s+is\s+replaced\s+by\s+(\S+)/gi)].map(m=>[m[1].replace(/[.,;]+$/,''),m[2].replace(/[.,;]+$/,'')]);
 if(replacements.length){
  if(/Item\s+(Added|Removed)/i.test(text))return {change:'review',replacementChain:[]};
  const chain=[itemNumber];const pending=[...replacements];
  while(pending.length){const options=pending.filter(pair=>pair[0]===chain.at(-1));if(options.length!==1||chain.includes(options[0][1]))return {change:'review',replacementChain:chain};const pair=options[0];chain.push(pair[1]);pending.splice(pending.indexOf(pair),1);}
  return {change:'replaced',replacementChain:chain};
 }
 const added=/Item\s+Added/i.test(text),removed=/Item\s+Removed/i.test(text);
 return {change:added&&removed?'review':removed?'removed':added?'added':text.trim()?'review':'listed',replacementChain:[]};
}
export function suppliedDecision(fact:SuppliedFact,entries:SuppliedEntry[]){
 if(fact.change!=='listed')return SUPPLIED_CHANGE_LABELS[fact.change];
 const old=entries.find(row=>suppliedKey(row.section,row.itemNumber)===suppliedKey(fact.section,fact.itemNumber));
 return !old||old.status==='removed'?'신규':old.quantity!==fact.quantity||old.description!==fact.description?'변경':'동일';
}
export function validateSuppliedFacts(value:unknown):SuppliedFact[]{
 if(!Array.isArray(value)||!value.length||value.length>1000)throw Error('사급품 항목은 1~1000건이어야 합니다.');
 const keys=new Set<string>(),ids=new Set<string>();
 for(const row of value){
  if(!row||['id','section','itemNumber','description','source'].some(k=>typeof row[k]!=='string'||!row[k].trim()||row[k].length>2000)||typeof row.changeText!=='string'||row.changeText.length>10000||!Number.isFinite(row.quantity)||row.quantity<0)throw Error('사급품 번호·품명·SECTION·수량·원본 근거를 확인하세요.');
  const expected=classifySuppliedChange(row.changeText,row.itemNumber);
  if(row.change!==expected.change||JSON.stringify(row.replacementChain)!==JSON.stringify(expected.replacementChain))throw Error('원본 변경 문구와 변경 구분이 일치하지 않습니다.');
  const key=suppliedKey(row.section,row.itemNumber);if(keys.has(key)||ids.has(row.id))throw Error('같은 SECTION의 고객 Item No.가 중복됩니다. 원본을 확인하세요.');keys.add(key);ids.add(row.id);
 }
 return value;
}
