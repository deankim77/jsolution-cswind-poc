import {createCustomerSuppliedService} from '../../../../../services/customer-supplied-service';
import {customerDataScope,customerDataError} from '../customer-data/context';
type Params={params:Promise<{projectId:string}>};
export async function GET(request:Request,{params}:Params){try{return Response.json(await createCustomerSuppliedService().list(await customerDataScope(request,(await params).projectId)),{headers:{'Cache-Control':'no-store'}});}catch(e){return customerDataError(e);}}
export async function POST(request:Request,{params}:Params){try{return Response.json(await createCustomerSuppliedService().apply(await customerDataScope(request,(await params).projectId),await request.json()));}catch(e){return customerDataError(e);}}
