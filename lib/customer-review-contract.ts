export const REVIEW_TYPES = {unclassified:'분류 확인 필요',drawing:'도면',bom:'부품 목록',specification:'사양서',requirement:'요구사항',report:'기술 보고서',work_instruction:'작업기준서',inspection:'검사기준서',other:'기타'} as const;
export const REVIEW_AREAS = {pbom:'3. PBOM',trr:'4. TRR / 요구사항',readiness:'5. Process Readiness',work:'6. 공정별 작업관리'} as const;
export type ReviewArea=keyof typeof REVIEW_AREAS;
export type ReviewItem={id:string;area:ReviewArea;title:string;detail:string;source:string;recordId:string};
export type ReviewDraft={documentType:keyof typeof REVIEW_TYPES;drawingNumber:string;revisionLabel:string;summary:string;uncertainties:string[];items:ReviewItem[]};
export type ReviewMessage={role:'user'|'assistant';content:string};
export type ReviewState={recordId:string;version:number;draft:ReviewDraft;messages:ReviewMessage[];updatedBy:string;updatedAt:number};
export type ConfirmedReview={id:string;recordId:string;version:number;item:ReviewItem;confirmedBy:string;confirmedAt:number};
export function validateReviewDraft(value:unknown,allowedIds:string[]):ReviewDraft {
  const d=value as ReviewDraft;
  if(!d||!Object.hasOwn(REVIEW_TYPES,d.documentType)||typeof d.drawingNumber!=='string'||typeof d.revisionLabel!=='string'||typeof d.summary!=='string'||!Array.isArray(d.uncertainties)||d.uncertainties.some(x=>typeof x!=='string')||!Array.isArray(d.items)||d.items.length>300)throw new Error('분석 결과 형식을 확인하세요.');
  const ids=new Set<string>();
  for(const i of d.items){if(!i||!i.id||ids.has(i.id)||!Object.hasOwn(REVIEW_AREAS,i.area)||!allowedIds.includes(i.recordId)||['title','detail','source'].some(k=>typeof i[k as keyof ReviewItem]!=='string'||!i[k as keyof ReviewItem].trim()))throw new Error('분석 항목의 분류·근거를 확인하세요.');ids.add(i.id);}
  if(JSON.stringify(d).length>200000)throw new Error('분석 결과가 너무 큽니다.');
  return d;
}
