/** Optional numeric facts must not discard otherwise readable source rows. */
export function prepareReviewNumbers(value:any){
 if(!value||!Array.isArray(value.items))return value;
 const notes:string[]=[],items=value.items.map((item:any,index:number)=>{
  if(!item?.bom)return item;
  const bom={...item.bom};
  for(const field of ['quantity','weight'] as const){
   const raw=bom[field],text=typeof raw==='string'?raw.trim():'';
   const missing=raw==null||(typeof raw==='string'&&/^(?:|[-—–]|n\/?a|null|unknown|미확인|미표기)$/i.test(text));
   let number:unknown=raw;
   if(missing)number=null;
   else if(typeof raw==='string'&&/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))number=Number(text.replaceAll(',',''));
   const valid=typeof number==='number'&&Number.isFinite(number)&&(field==='weight'?number>=0:number>0);
   if(number!==null&&!valid){
    notes.push(`${index+1}번 항목 ${field==='weight'?'중량':'수량'} 확인 필요: ${String(raw).slice(0,120)}`);
    number=null;
   }
   bom[field]=number;
  }
  if(bom.weight!==null&&(typeof bom.weightUnit!=='string'||!bom.weightUnit.trim()||!['Direct from Drawing','Parts List'].includes(bom.weightSource))){
   notes.push(`${index+1}번 항목 중량 원문 ${String(item.bom.weight).slice(0,120)}: 단위 또는 출처 확인 필요`);
   // Keep the readable value; missing metadata remains a review note.
  }
  {
   if(typeof bom.weightUnit!=='string')bom.weightUnit='';
   if(!['Direct from Drawing','Parts List','Not Available'].includes(bom.weightSource))bom.weightSource='Not Available';
  }
  if(typeof bom.unit!=='string')bom.unit='';
  return {...item,bom};
 });
 return {...value,items,uncertainties:[...(Array.isArray(value.uncertainties)?value.uncertainties:[]),...notes]};
}
