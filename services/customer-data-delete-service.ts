import {assertCustomerAnalysisNotRunning} from './customer-analysis-jobs';
import {createCustomerDataDeleteRepository} from '../db/repositories/customer-data-delete-repository';
import type {CustomerDataScope} from '../db/repositories/customer-data-repository';
import {getStorageAdapter} from '../lib/storage-adapter';
import {CustomerDataError} from '../lib/customer-data-contract';
export function createCustomerDataDeleteService(repo=createCustomerDataDeleteRepository(),storage=getStorageAdapter()){
 return {async remove(s:CustomerDataScope,input:unknown,preview=false){
  if(!Array.isArray(input)||!input.length||input.length>100||input.some(id=>typeof id!=='string'||!id||id.length>100)||new Set(input).size!==input.length)throw new CustomerDataError('삭제할 문서를 선택하세요.');
  assertCustomerAnalysisNotRunning(s,input);
  const result=await repo.remove(s,input,preview);let cleanupPending=false;
  for(const key of result.files)try{await storage.delete(key);}catch(e){cleanupPending=true;console.error('Deleted customer source storage cleanup failed',{key,error:e});}
  return {ok:true,cleanupPending};
 }};
}
