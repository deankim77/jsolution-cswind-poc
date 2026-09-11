import {defaultDocumentRootQuantity,validateBomFacts,type BomFact} from './pbom-contract';
export const REVIEW_TYPES = {unclassified:'분류 확인 필요',drawing:'도면',bom:'부품 목록',specification:'사양서',requirement:'요구사항',report:'기술 보고서',work_instruction:'작업기준서',inspection:'검사기준서',other:'기타'} as const;
export const REVIEW_AREAS = {pbom:'3. PBOM',extract:'4. AI 추출사항'} as const;
export const REVIEW_USE_TARGETS=['TTR','조립기준','검사기준','작업방법','기타'] as const;
export type ReviewArea=keyof typeof REVIEW_AREAS;
export type ReviewUseTarget=typeof REVIEW_USE_TARGETS[number];
export type MissingReviewData={field:string;reason:string};
export type ReviewItem={id:string;area:ReviewArea;title:string;detail:string;source:string;recordId:string;useTargets?:ReviewUseTarget[];assy?:string;part?:string;itemNumber?:string;itemName?:string;bom?:BomFact;approval?:{status:'conditional'|'approved';issues:string[]}};
export type ReviewDraft={analysisMode?:'text';documentType:keyof typeof REVIEW_TYPES;documentTypeConfirmed?:boolean;drawingNumber:string;revisionLabel:string;summary:string;missingData?:MissingReviewData[];uncertainties:string[];items:ReviewItem[]};
export type ReviewMessage={role:'user'|'assistant';content:string};
export type ReviewState={recordId:string;version:number;draft:ReviewDraft;messages:ReviewMessage[];updatedBy:string;updatedAt:number};
export type ConfirmedReview={id:string;recordId:string;version:number;item:ReviewItem;confirmedBy:string;confirmedAt:number};

type StoredReviewItem=Omit<ReviewItem,'area'> & {area:string;useTargets?:unknown;assy?:unknown;part?:unknown;itemNumber?:unknown;itemName?:unknown};
const supportedStoredAreas=['pbom','extract','trr','readiness','work'] as const;
const legacyTarget=(area:string):ReviewUseTarget=>area==='trr'?'TTR':area==='work'?'작업방법':'기타';
export function normalizeReviewItem(value:StoredReviewItem):ReviewItem {
 if(!value||!supportedStoredAreas.includes(value.area as typeof supportedStoredAreas[number]))throw new Error('지원하지 않는 AI 분석 영역입니다.');
 const area:ReviewArea=value.area==='pbom'?'pbom':'extract';
 const targets=Array.isArray(value.useTargets)?value.useTargets.filter((target):target is ReviewUseTarget=>typeof target==='string'&&(REVIEW_USE_TARGETS as readonly string[]).includes(target)):[];
 return {...value,area,useTargets:area==='pbom'?undefined:(targets.length?[...new Set(targets)]:[legacyTarget(value.area)]),assy:typeof value.assy==='string'?value.assy.trim():'',part:typeof value.part==='string'?value.part.trim():'',itemNumber:typeof value.itemNumber==='string'?value.itemNumber.trim():'',itemName:typeof value.itemName==='string'?value.itemName.trim():''};
}
export function normalizeStoredReviewDraft(value:ReviewDraft):ReviewDraft {
 return {...value,items:(value.items as unknown as StoredReviewItem[]).map(normalizeReviewItem)};
}
export function validateReviewDraft(value:unknown,allowedIds:string[]):ReviewDraft {
  const d=value as ReviewDraft;
  if(!d||!Object.hasOwn(REVIEW_TYPES,d.documentType)||(d.documentTypeConfirmed!==undefined&&typeof d.documentTypeConfirmed!=='boolean')||typeof d.drawingNumber!=='string'||typeof d.revisionLabel!=='string'||typeof d.summary!=='string'||(d.missingData!==undefined&&(!Array.isArray(d.missingData)||d.missingData.length>50||d.missingData.some(x=>!x||typeof x.field!=='string'||!x.field.trim()||typeof x.reason!=='string'||!x.reason.trim())))||!Array.isArray(d.uncertainties)||d.uncertainties.some(x=>typeof x!=='string')||!Array.isArray(d.items)||d.items.length>300)throw new Error('분석 결과 형식을 확인하세요.');
  const items=(d.items as unknown as StoredReviewItem[]).map(normalizeReviewItem),ids=new Set<string>();
  for(const i of items){if(!i||!i.id||ids.has(i.id)||!Object.hasOwn(REVIEW_AREAS,i.area)||!allowedIds.includes(i.recordId)||(['title','detail','source'] as const).some(k=>typeof i[k]!=='string'||!i[k].trim()))throw new Error('분석 항목의 분류·근거를 확인하세요.');if(i.area==='extract'&&(!i.useTargets?.length||i.useTargets.some(target=>!(REVIEW_USE_TARGETS as readonly string[]).includes(target))))throw new Error('AI 추출사항의 활용 대상을 확인하세요.');ids.add(i.id);}
  if(items.some(i=>i.bom&&i.area!=='pbom'))throw new Error('BOM 구조는 PBOM 항목에만 저장할 수 있습니다.');
  validateBomFacts(items);
  const result={...d,missingData:d.missingData?.map(x=>({field:x.field.trim(),reason:x.reason.trim()})),items:items.map(defaultDocumentRootQuantity)};
  if(JSON.stringify(result).length>200000)throw new Error('분석 결과가 너무 큽니다.');
  return result;
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

/** Counts refer to the displayed draft version; previous approvals belong to history. */
export function reviewAreaCounts(review:ReviewState|undefined,confirmed:ConfirmedReview[],area:ReviewArea){
 if(!review)return {analyzed:null,approved:0,conditional:0};
 const items=review.draft.items.filter(item=>item.area===area),ids=new Set(items.map(item=>item.id));
 const approvals=new Map(confirmed.filter(row=>row.recordId===review.recordId&&row.version===review.version&&row.item.area===area&&ids.has(row.item.id)).map(row=>[row.item.id,row]));
 let approved=0,conditional=0;
 for(const row of approvals.values()){if(row.item.approval?.status==='conditional')conditional++;else approved++;}
 return {analyzed:items.length,approved,conditional};
}
