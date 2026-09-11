import {createCustomerAnalysisJobs} from '../../../../../../services/customer-analysis-jobs';
import {customerDataScope,customerDataError} from '../context';
type Params={params:Promise<{projectId:string}>};
export async function GET(request:Request,{params}:Params){
 try{
  const scope=await customerDataScope(request,(await params).projectId);
  return Response.json({jobs:await createCustomerAnalysisJobs().list(scope)},{headers:{'Cache-Control':'no-store'}});
 }catch(reason){return customerDataError(reason);}
}
export async function POST(request:Request,{params}:Params){
 try{
  const scope=await customerDataScope(request,(await params).projectId),input=await request.json();
  return Response.json({job:await createCustomerAnalysisJobs().start(scope,input.recordId,input.message)},{status:202,headers:{'Cache-Control':'no-store'}});
 }catch(reason){return customerDataError(reason);}
}
