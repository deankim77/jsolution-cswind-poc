import { customerDataScope, customerDataError } from '../context';
import { CustomerDataError } from '../../../../../../lib/customer-data-contract';
import { importTc800Package } from '../../../../../../services/tc800-import-service';

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}) {
  try {
    const scope=await customerDataScope(request,(await params).projectId);
    if(Number(request.headers.get('content-length')||0)>51*1024*1024)throw new CustomerDataError('ZIP 파일은 50MB 이하로 선택하세요.',413);
    const form=await request.formData(),file=form.get('file');
    if(!(file instanceof File))throw new CustomerDataError('TC800 V4 ZIP을 선택하세요.');
    return Response.json(await importTc800Package(scope,file));
  }catch(reason){return customerDataError(reason);}
}
