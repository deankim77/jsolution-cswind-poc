import {createPbomService} from '../../../../../services/pbom-service';
import {customerDataScope,customerDataError} from '../customer-data/context';
type Params={params:Promise<{projectId:string}>};
export async function GET(request:Request,{params}:Params){try{return Response.json(await createPbomService().list(await customerDataScope(request,(await params).projectId)),{headers:{'Cache-Control':'no-store'}});}catch(e){return customerDataError(e);}}
export async function POST(request:Request,{params}:Params){try{
 const scope=await customerDataScope(request,(await params).projectId),service=createPbomService();
 const input=await request.text();const action=input?JSON.parse(input).action:undefined;
 return Response.json(action==='reconcile'?await service.reconcile(scope):await service.initialize(scope));
}catch(e){return customerDataError(e);}}
