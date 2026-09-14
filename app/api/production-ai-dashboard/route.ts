import {createProductionAiDashboardService} from '../../../services/production-ai-dashboard-service';
import {customerDataScope,customerDataError} from '../projects/[projectId]/customer-data/context';
export async function GET(request:Request){try{const scope=await customerDataScope(request,new URL(request.url).searchParams.get('projectId')??'');return Response.json(await createProductionAiDashboardService().list(scope),{headers:{'Cache-Control':'no-store'}});}catch(e){return customerDataError(e);}}
