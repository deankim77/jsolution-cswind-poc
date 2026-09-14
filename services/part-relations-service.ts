import {createPartRelationsRepository} from '../db/repositories/part-relations-repository';
import {CustomerDataError} from '../lib/customer-data-contract';
export function createPartRelationsService(repo=createPartRelationsRepository()){return {async list(s:{companyId:string;userId:string;systemRoles:string[]},partId:string|null){if(!partId||partId.length>100)throw new CustomerDataError('부품을 선택하세요.');return repo.list(s,partId);}};}
