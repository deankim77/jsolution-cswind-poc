import {createCustomerSuppliedRepository} from '../db/repositories/customer-supplied-repository';
import type {CustomerDataScope} from '../db/repositories/customer-data-repository';
import type {SuppliedChoice} from '../lib/customer-supplied-contract';
import {CustomerDataError} from '../lib/customer-data-contract';
export function createCustomerSuppliedService(repository=createCustomerSuppliedRepository()){return {
 list:(s:CustomerDataScope)=>repository.list(s),
 async apply(s:CustomerDataScope,input:unknown){
  const cancel=input as {action?:string;recordId:string;area:'supplied'|'bom';fingerprint:string};
  if(cancel?.action==='cancel'){if(typeof cancel.recordId!=='string'||!cancel.recordId||!['supplied','bom'].includes(cancel.area)||typeof cancel.fingerprint!=='string')throw new CustomerDataError('취소할 문서를 확인하세요.');return repository.cancel(s,cancel);}
  const v=input as {recordId:string;version:number;area:'supplied'|'bom';choices:SuppliedChoice[];customerConfirmed:boolean;fingerprint:string};
  if(!v||typeof v.recordId!=='string'||!v.recordId||!Number.isInteger(v.version)||v.version<1||!['supplied','bom'].includes(v.area)||!Array.isArray(v.choices)||!v.choices.length||v.choices.length>1000||v.customerConfirmed!==true||typeof v.fingerprint!=='string'||v.choices.some(c=>!c||typeof c.itemId!=='string'||c.itemId.length>200||[c.parentPartId,c.partId,c.unit].some(x=>x!==undefined&&(typeof x!=='string'||x.length>100))))throw new CustomerDataError('확정할 항목과 고객 확인 여부를 확인하세요.');
  return repository.apply(s,v);
 }
};}
