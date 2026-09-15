import {exportProjectPbom} from '../../../../../../services/pbom-export-service';
import {customerDataScope,customerDataError} from '../../customer-data/context';

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
 try{
  const scope=await customerDataScope(request,(await params).projectId);
  const {bytes,filename}=await exportProjectPbom(scope);
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="BOM.xlsx"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g,'%27')}`,'Cache-Control':'no-store'}});
 }catch(error){return customerDataError(error);}
}
