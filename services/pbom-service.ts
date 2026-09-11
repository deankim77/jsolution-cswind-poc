import {createPbomRepository} from '../db/repositories/pbom-repository';
import type {CustomerDataScope} from '../db/repositories/customer-data-repository';
export function createPbomService(repository=createPbomRepository()){return {
 list:(scope:CustomerDataScope)=>repository.list(scope),
 reconcile:(scope:CustomerDataScope)=>repository.reconcile(scope),
 initialize:(scope:CustomerDataScope)=>repository.initialize(scope),
};}
