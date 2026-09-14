import {bomSectionName,type BomRow} from './pbom-contract';
import type {SuppliedFact,SuppliedData} from './customer-supplied-contract';
/** One review row per source item; existing project BOM values remain read-only. */
export function suppliedBomRows(facts:SuppliedFact[],rows:BomRow[],parts:SuppliedData['parts']):BomRow[]{
 return facts.map(f=>{
  const number=f.replacementChain.at(-1)||f.itemNumber;
  const candidates=parts.filter(p=>p.customerNumbers.includes(number));
  const matches=rows.filter(r=>r.bom.customerItemNumber===number||(candidates.length===1&&r.partId===candidates[0].id));
  const ids=new Set(matches.map(r=>r.partId??r.internalPartNumber??r.id));
  const row=ids.size===1?matches[0]:undefined;
  if(row)return {...row,id:f.id,level:1,bom:{...row.bom,parentId:null,section:bomSectionName(row,rows)}};
  return {id:f.id,recordId:'',source:'',level:1,path:'',totalQuantity:null,calculatedWeight:null,calculatedWeightSource:'Not Available',match:'NEED_REVIEW',bom:{parentId:null,section:'',itemDescription:f.description,position:'',customerItemNumber:f.itemNumber,drawingNumber:'',componentRevision:'',quantity:null,unit:'',weight:null,weightUnit:'',weightSource:'Not Available',drawingAvailability:'Need Review',partType:'PART',childrenComplete:true}};
 });
}
