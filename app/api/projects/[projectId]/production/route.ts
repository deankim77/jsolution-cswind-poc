import {customerDataScope,customerDataError} from '../customer-data/context';
import {createProductionDataService} from '../../../../../services/production-data-service';
type Params={params:Promise<{projectId:string}>};
export async function GET(request:Request,{params}:Params) {
  try{return Response.json(await createProductionDataService().list(await customerDataScope(request,(await params).projectId)),{headers:{'cache-control':'no-store'}});}catch(error){return customerDataError(error);}
}
export async function PATCH(request:Request,{params}:Params) {
  try{return Response.json(await createProductionDataService().assign(await customerDataScope(request,(await params).projectId),await request.json()));}catch(error){return customerDataError(error);}
}
