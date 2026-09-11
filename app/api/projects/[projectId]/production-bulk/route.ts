import {createProductionBulkService} from '../../../../../services/production-bulk-service';
import {customerDataScope,customerDataError} from '../customer-data/context';
type Params={params:Promise<{projectId:string}>};
export async function GET(request:Request,{params}:Params){try{return Response.json(await createProductionBulkService().read(await customerDataScope(request,(await params).projectId),new URL(request.url).searchParams.get('area')),{headers:{'Cache-Control':'no-store'}});}catch(e){return customerDataError(e);}}
export async function POST(request:Request,{params}:Params){try{return Response.json(await createProductionBulkService().mutate(await customerDataScope(request,(await params).projectId),await request.json()));}catch(e){return customerDataError(e);}}
