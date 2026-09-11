import {createProductionBulkRepository} from '../db/repositories/production-bulk-repository';
import type {CustomerDataScope} from '../db/repositories/customer-data-repository';
import type {BulkReviewArea as ReviewArea} from '../lib/customer-review-contract';
import {CustomerDataError} from '../lib/customer-data-contract';
function area(value:unknown):ReviewArea{if(value!=='pbom'&&value!=='extract')throw new CustomerDataError('편집 영역을 확인하세요.',400);return value;}
export function createProductionBulkService(repository=createProductionBulkRepository()){return {
 read:(s:CustomerDataScope,value:unknown)=>repository.read(s,area(value)),
 mutate:(s:CustomerDataScope,input:any)=>{if(!input||!['checkout','checkin','cancel'].includes(input.action)||JSON.stringify(input).length>2000000)throw new CustomerDataError('전체수정 요청을 확인하세요.',400);return repository.mutate(s,area(input.area),input.action,typeof input.token==='string'?input.token:'',input.rows);}
};}
