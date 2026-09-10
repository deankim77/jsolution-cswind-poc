import {bomIdentity,type BomFact} from './pbom-contract';
import type {ReviewDraft} from './customer-review-contract';
export type AnalysisHistory={id:string;version:number;draft:ReviewDraft;updatedBy:string;updatedAt:number};
export type RevisionEvidence={id:string;itemId:string;fact:BomFact};
export type RevisionChange={id:string;itemId:string;name:string;before:string;after:string;source:string;kind:'정보 보완'|'Revision 변경'};
export const knownRevision=(value:string)=>Boolean(value.trim()&&!/^(미확인|unknown|n\/a|—|-)$/i.test(value.trim()));
/** Customer identity is used across analyses because generated row IDs can change. Ambiguous matches are excluded. */
export function compRevChanges(draft:ReviewDraft,existing:RevisionEvidence[]):RevisionChange[]{
 const result:RevisionChange[]=[];
 for(const previous of existing){
  const key=bomIdentity(previous.fact);if(!key)continue;
  const candidates=draft.items.filter(i=>i.area==='pbom'&&i.bom&&bomIdentity(i.bom)===key);
  if(candidates.length!==1)continue;
  const next=candidates[0],after=next.bom!.componentRevision.trim(),before=previous.fact.componentRevision;
  if(!knownRevision(after)||after===before.trim())continue;
  result.push({id:previous.id,itemId:previous.itemId,name:next.bom!.itemDescription,before,after,source:next.source,kind:knownRevision(before)?'Revision 변경':'정보 보완'});
 }
 return result;
}
