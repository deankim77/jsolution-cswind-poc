import {createCustomerDocumentRepository} from '../db/repositories/customer-document-repository';
import type {CustomerDataScope} from '../db/repositories/customer-data-repository';
import {createCustomerDataService} from './customer-data-service';
import {createCustomerDataDeleteService} from './customer-data-delete-service';
import {CustomerDataError} from '../lib/customer-data-contract';
/** Existing document endpoints delegate customer lifecycle to the same intake service. */
export async function handleCustomerDocumentRequest(request:Request,scope:CustomerDataScope):Promise<Response|null>{
 try{
  const repo=createCustomerDocumentRepository();
  const form=request.method==='POST'?await request.clone().formData():null;
  const body=form?null:await request.clone().json();
  const id=String(form?.get('deliverableId')||body?.deliverableId||''),versionId=String(body?.versionId||'');
  const target=await repo.find(scope,id,versionId);
  if(!target)return null;
  if(request.method==='POST'){
   const previous=target.records[0];if(!previous)throw new CustomerDataError('연결된 고객 원본을 찾을 수 없습니다.',409);
   form!.set('previousId',previous.id);form!.set('sourcePurpose',previous.sourcePurpose);form!.set('intakeGroup',previous.intakeGroup);
   const record=await createCustomerDataService().upload(scope,form!,false);
   return Response.json({ok:true,id:record.deliverableVersionId,deliverableId:record.deliverableId,revision:record.revision,record});
  }
  if(request.method==='DELETE'){
   const ids=versionId?target.records.filter(r=>r.deliverableVersionId===versionId).map(r=>r.id):target.records.map(r=>r.id);
   if(!ids.length)throw new CustomerDataError('연결된 고객 원본을 찾을 수 없습니다.',409);
   return Response.json(await createCustomerDataDeleteService().remove(scope,ids));
  }
  if(body?.action==='update-info'){
   const name=String(body.name||'').trim();if(!name||name.length>200)throw new CustomerDataError('문서명을 200자 이내로 입력하세요.');
   return Response.json(await repo.update(scope,target.doc.id,{name,taskId:String(body.taskId||''),category:String(body.category||''),required:body.required!==false}));
  }
  return null;
 }catch(error){if(error instanceof CustomerDataError)return Response.json({error:error.message},{status:error.status});throw error;}
}

export const customerDocumentLinks=(companyId:string,projectId:string)=>createCustomerDocumentRepository().links(companyId,projectId);
