import {createTrrService} from '../../../../../services/trr-service';
import {customerDataScope,customerDataError} from '../customer-data/context';
type Params={params:Promise<{projectId:string}>};
export async function GET(request:Request,{params}:Params){try{const s=await customerDataScope(request,(await params).projectId);return Response.json(await createTrrService().list(s),{headers:{'Cache-Control':'no-store'}});}catch(e){return customerDataError(e);}}
export async function POST(request:Request,{params}:Params){try{const s=await customerDataScope(request,(await params).projectId);return Response.json(await createTrrService().generate(s,await request.json()));}catch(e){return customerDataError(e);}}
