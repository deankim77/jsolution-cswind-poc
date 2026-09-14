import type {ReviewDraft,ReviewItem} from './customer-review-contract';
import type {TrrDocument} from './trr-contract';
export type AiMetrics={registered:number;analyzed:number;pending:number;bom:number;technical:number;technicalApplied:number;technicalPending:number;trr:number;trrApplied:number;trrPending:number;reports:number;supplied:number;suppliedApplied:number;suppliedPending:number;newParts:string[];parts:string[]};
export type AiProjectMetrics={id:string;name:string;code:string;metrics:AiMetrics};
export function emptyAiMetrics():AiMetrics{return {registered:0,analyzed:0,pending:0,bom:0,technical:0,technicalApplied:0,technicalPending:0,trr:0,trrApplied:0,trrPending:0,reports:0,supplied:0,suppliedApplied:0,suppliedPending:0,newParts:[],parts:[]};}
export function sumAiMetrics(rows:AiMetrics[]):AiMetrics{const out=emptyAiMetrics();for(const row of rows){for(const key of Object.keys(out) as (keyof AiMetrics)[]){if(key==='parts'||key==='newParts')out[key]=[...new Set([...out[key],...row[key]])];else out[key]+=row[key];}}return out;}
export function calculateAiMetrics(input:{records:{id:string;rawDataId:string;revision:number;sourcePurpose:string}[];reviews:{recordId:string;version:number;draft:ReviewDraft}[];confirmed:{recordId:string;version:number;item:ReviewItem}[];supplied:{recordId:string;version:number;itemId:string}[];report?:TrrDocument;reports:number;newParts:string[];parts:string[]}):AiMetrics{
 const out=emptyAiMetrics(),latest=new Map<string,typeof input.records[number]>();
 for(const r of input.records){const old=latest.get(r.rawDataId);if(!old||old.revision<r.revision)latest.set(r.rawDataId,r);}
 out.registered=latest.size;out.reports=input.reports;out.newParts=[...new Set(input.newParts)];out.parts=[...new Set(input.parts)];
 for(const record of latest.values()){
  const review=input.reviews.find(r=>r.recordId===record.id);if(!review)continue;out.analyzed++;
  for(const item of review.draft.items){
   if(item.area==='pbom')out.bom++;
   if(item.area==='extract'){out.technical++;if(input.confirmed.some(c=>c.recordId===record.id&&c.version===review.version&&c.item.id===item.id))out.technicalApplied++;}
   if(item.area==='trr'){out.trr++;if(input.report?.sources.some(s=>s.id===record.id&&s.facts.some(f=>f.section===item.trrSection&&f.title===item.title&&f.detail===item.detail&&f.reference===item.source)))out.trrApplied++;}
  }
  for(const item of review.draft.suppliedItems??[]){out.supplied++;if(input.supplied.some(e=>e.recordId===record.id&&e.version===review.version&&e.itemId===item.id))out.suppliedApplied++;}
 }
 out.pending=out.registered-out.analyzed;out.technicalPending=out.technical-out.technicalApplied;out.trrPending=out.trr-out.trrApplied;out.suppliedPending=out.supplied-out.suppliedApplied;return out;
}
