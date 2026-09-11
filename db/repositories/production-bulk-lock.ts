import {and,eq} from 'drizzle-orm';
import {productionBulkLocks} from '../customer-review-schema';
import {CustomerDataError} from '../../lib/customer-data-contract';
import type {CustomerDataScope} from './customer-data-repository';
import type {getDb} from '../index';
type Db=ReturnType<typeof getDb>;type Tx=Parameters<Parameters<Db['transaction']>[0]>[0];
export async function assertNoProductionBulkLock(db:Db|Tx,s:CustomerDataScope,area?:string){
 const locks=await db.select().from(productionBulkLocks).where(and(eq(productionBulkLocks.companyId,s.companyId),eq(productionBulkLocks.projectId,s.projectId),area?eq(productionBulkLocks.area,area):undefined));
 if(locks.length)throw new CustomerDataError('전체수정에서 체크아웃 중입니다. 체크인 또는 편집 취소 후 진행하세요.',409);
}
