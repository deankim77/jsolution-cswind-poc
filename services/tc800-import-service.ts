import { createCustomerDataService } from './customer-data-service';
import { createCustomerDataRepository, type CustomerDataScope } from '../db/repositories/customer-data-repository';
import { readTc800InitialPackage } from './tc800-zip.mjs';
import { CustomerDataError } from '../lib/customer-data-contract';

export async function importTc800Package(scope: CustomerDataScope, file: File) {
  const repository = createCustomerDataRepository();
  const current = await repository.list(scope);
  if (!current.canReview) throw new CustomerDataError('PM 또는 PL이 시연 패키지를 등록해 주세요.',403);
  if (!file.size || file.size>50*1024*1024) throw new CustomerDataError('ZIP 파일은 50MB 이하로 선택하세요.',413);
  let files;
  try { files=readTc800InitialPackage(await file.arrayBuffer()); }
  catch {throw new CustomerDataError('TC800_POC_DATASET_V4.zip 원본을 선택하세요. 최초 접수 자료 30개가 모두 필요합니다.');}
  const service=createCustomerDataService(repository);
  let imported=0,skipped=0;
  for(const item of files) {
    if(current.records.some(row=>row.checksum===item.sha256&&row.fileName===item.name)) {skipped++;continue;}
    const form=new FormData();
    form.set('file',new File([new Uint8Array(item.content)],item.name));
    form.set('title',item.name);form.set('documentType',item.documentType);form.set('impactTarget','unclassified');
    form.set('note',`TC800 V4 최초 접수 시연 자료 · ${item.path}`);
    await service.upload(scope,form,true);imported++;
  }
  return {imported,skipped,total:files.length};
}
