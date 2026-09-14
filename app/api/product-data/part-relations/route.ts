import {createPartRelationsService} from '../../../../services/part-relations-service';
import {resolveRequestContext} from '../../../../db/request-context';
import {getLegacyDbCompat} from '../../../../db/postgres-d1-compat';
import {customerDataError} from '../../projects/[projectId]/customer-data/context';
export async function GET(request:Request){try{const scope=await resolveRequestContext(request,getLegacyDbCompat());return Response.json(await createPartRelationsService().list(scope,new URL(request.url).searchParams.get('partId')),{headers:{'Cache-Control':'no-store'}});}catch(e){return customerDataError(e);}}
