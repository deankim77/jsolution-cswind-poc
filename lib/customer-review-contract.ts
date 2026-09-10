import {defaultDocumentRootQuantity,validateBomFacts,type BomFact} from './pbom-contract';
export const REVIEW_TYPES = {unclassified:'분류 확인 필요',drawing:'도면',bom:'부품 목록',specification:'사양서',requirement:'요구사항',report:'기술 보고서',work_instruction:'작업기준서',inspection:'검사기준서',other:'기타'} as const;
export const REVIEW_AREAS = {pbom:'3. PBOM',trr:'4. TRR / 요구사항',readiness:'5. Process Readiness',work:'6. 공정별 작업관리'} as const;
export type ReviewArea=keyof typeof REVIEW_AREAS;
export type MissingReviewData={field:string;reason:string};
export type ReviewItem={id:string;area:ReviewArea;title:string;detail:string;source:string;recordId:string;bom?:BomFact};
export type ReviewDraft={documentType:keyof typeof REVIEW_TYPES;documentTypeConfirmed?:boolean;drawingNumber:string;revisionLabel:string;summary:string;missingData?:MissingReviewData[];uncertainties:string[];items:ReviewItem[]};
export type ReviewMessage={role:'user'|'assistant';content:string};
export type ReviewState={recordId:string;version:number;draft:ReviewDraft;messages:ReviewMessage[];updatedBy:string;updatedAt:number};
export type ConfirmedReview={id:string;recordId:string;version:number;item:ReviewItem;confirmedBy:string;confirmedAt:number};
export function validateReviewDraft(value:unknown,allowedIds:string[]):ReviewDraft {
  const d=value as ReviewDraft;
  if(!d||!Object.hasOwn(REVIEW_TYPES,d.documentType)||(d.documentTypeConfirmed!==undefined&&typeof d.documentTypeConfirmed!=='boolean')||typeof d.drawingNumber!=='string'||typeof d.revisionLabel!=='string'||typeof d.summary!=='string'||(d.missingData!==undefined&&(!Array.isArray(d.missingData)||d.missingData.length>50||d.missingData.some(x=>!x||typeof x.field!=='string'||!x.field.trim()||typeof x.reason!=='string'||!x.reason.trim())))||!Array.isArray(d.uncertainties)||d.uncertainties.some(x=>typeof x!=='string')||!Array.isArray(d.items)||d.items.length>300)throw new Error('분석 결과 형식을 확인하세요.');
  const ids=new Set<string>();
  for(const i of d.items){if(!i||!i.id||ids.has(i.id)||!Object.hasOwn(REVIEW_AREAS,i.area)||!allowedIds.includes(i.recordId)||(['title','detail','source'] as const).some(k=>typeof i[k]!=='string'||!i[k].trim()))throw new Error('분석 항목의 분류·근거를 확인하세요.');ids.add(i.id);}
  if(d.items.some(i=>i.bom&&i.area!=='pbom'))throw new Error('BOM 구조는 PBOM 항목에만 저장할 수 있습니다.');
  validateBomFacts(d.items);
  if(JSON.stringify(d).length>200000)throw new Error('분석 결과가 너무 큽니다.');
  return {...d,missingData:d.missingData?.map(x=>({field:x.field.trim(),reason:x.reason.trim()})),items:d.items.map(defaultDocumentRootQuantity)};
}

/** Map an extracted drawing revision only to its unambiguous document root. */
export function applyDrawingRootRevision(draft:ReviewDraft,recordId:string):ReviewDraft {
 const revision=draft.revisionLabel.trim(),drawing=draft.drawingNumber.trim();
 if(draft.documentType!=='drawing'||!drawing||!revision||/^(미확인|unknown|n\/a|—|-)$/i.test(revision))return draft;
 const candidates=draft.items.filter(item=>item.recordId===recordId&&item.area==='pbom'&&item.bom?.parentId===null&&item.bom.partType==='ASSEMBLY'&&item.bom.drawingNumber.trim()===drawing);
 if(candidates.length!==1)return draft;
 const root=candidates[0];
 if(root.bom!.componentRevision.trim()&&!/^(미확인|unknown|n\/a|—|-)$/i.test(root.bom!.componentRevision.trim()))return draft;
 return {...draft,items:draft.items.map(item=>item.id===root.id?{...item,source:`${item.source} · 도면 표제란 Revision: ${revision}`,bom:{...item.bom!,componentRevision:revision}}:item)};
}
