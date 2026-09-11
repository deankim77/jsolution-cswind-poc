import {createTrrService} from '../../../../../../services/trr-service';
import {customerDataScope,customerDataError} from '../../customer-data/context';
type Params={params:Promise<{projectId:string;versionId:string}>};
export async function GET(request:Request,{params}:Params){try{
 const {projectId,versionId}=await params,s=await customerDataScope(request,projectId),service=createTrrService();
 if(new URL(request.url).searchParams.get('preview')==='1')return new Response(await service.preview(s,versionId),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",'X-Content-Type-Options':'nosniff'}});
 const file=await service.download(s,versionId);return new Response(file.body,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="${file.name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return customerDataError(e);}}
