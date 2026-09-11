import {activeBulkRows} from './production-bulk-edit';
import {bomIdentity,buildBomRows,type ProjectPbom,type BomRow} from './pbom-contract';
import type {ConfirmedReview} from './customer-review-contract';

/** Approval, including conditional approval, is the source of the project review list. */
export function approvedPbomView(applied:ProjectPbom,confirmed:ConfirmedReview[]):ProjectPbom{
 const active=activeBulkRows(confirmed,'pbom'),documents=new Set(active.map(r=>r.recordId));
 const rows:BomRow[]=[],replacements=new Map<string,string>();
 for(const recordId of documents){
  const approved=active.filter(r=>r.recordId===recordId&&r.item.bom);
  const ids=new Map(approved.map(r=>[r.item.id,`confirmed:${r.id}`]));
  const inputs=approved.map(r=>({...r.item,id:ids.get(r.item.id)!,bom:{...r.item.bom!,parentId:r.item.bom!.parentId?ids.get(r.item.bom!.parentId)??null:null}}));
  const projected=buildBomRows(inputs,applied.identities);
  for(const row of projected){
   const approval=approved.find(r=>ids.get(r.item.id)===row.id)!;
   const identity=applied.identities.find(i=>i.key===`APPROVED:${recordId}:${approval.item.id}`);
   if(identity&&!row.partId){row.partId=identity.partId;row.internalPartNumber=identity.partNumber;row.match='EXISTING';}
   row.confirmationId=approval.id;row.sourceItemId=approval.item.id;row.sourceRecordIds=[recordId];
   // Match legacy occurrence IDs only within the document and only when unambiguous.
   const exact=applied.rows.filter(r=>r.recordId===recordId&&r.sourceItemId===approval.item.id);
   const key=bomIdentity(row.bom);
   const candidates=exact.length?exact:applied.rows.filter(r=>r.recordId===recordId&&key&&bomIdentity(r.bom)===key&&r.bom.position===row.bom.position);
   if(candidates.length===1){const old=candidates[0];replacements.set(old.id,row.id);
    if(old.changed&&old.changeLabel==='수량·단위 변경')Object.assign(row,{bom:{...row.bom,quantity:old.bom.quantity,unit:old.bom.unit},changed:true,changeLabel:old.changeLabel,totalQuantity:old.totalQuantity});
   }
   rows.push(row);
  }
 }
 // Internally added rows remain visible alongside the approved document trees.
 for(const row of applied.rows)if(!documents.has(row.recordId))rows.push({...row,bom:{...row.bom,parentId:row.bom.parentId?replacements.get(row.bom.parentId)??row.bom.parentId:null}});
 const visible=new Set(rows.map(r=>r.id));
 for(const row of rows)if(row.bom.parentId&&!visible.has(row.bom.parentId)){row.bom={...row.bom,parentId:null};row.level=1;}
 return {...applied,rows};
}
