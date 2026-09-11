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
 // AI recommendations are never human confirmation.
 result.documentTypeConfirmed=false;
 return result;
}
