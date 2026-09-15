import {createPbomService} from './pbom-service';
import {createCustomerDataService} from './customer-data-service';
import {customerReceiptId} from '../lib/customer-data-contract';
import type {CustomerDataScope} from '../db/repositories/customer-data-repository';
import {buildPbomExcel} from './pbom-excel';

export async function exportProjectPbom(scope:CustomerDataScope){
 const [data,documents]=await Promise.all([createPbomService().list(scope),createCustomerDataService().list(scope)]);
 const sources=Object.fromEntries(documents.records.map(record=>[record.id,customerReceiptId(record)]));
 const name=(data.root?.name||'Project').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,100);
 return {bytes:buildPbomExcel(data,sources),filename:`${name}_BOM_${new Date().toISOString().slice(0,10)}.xlsx`};
}
