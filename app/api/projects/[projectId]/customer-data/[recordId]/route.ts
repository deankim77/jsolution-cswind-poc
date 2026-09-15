import {customerFileMime} from "../../../../../../services/customer-review-service";
import {customerXlsxPreview} from "../../../../../../services/customer-xlsx-preview";
import { createCustomerDataService } from "../../../../../../services/customer-data-service";
import { customerDataError, customerDataScope } from "../context";
type Params = { params: Promise<{ projectId: string; recordId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, recordId } = await params;
    const file = await createCustomerDataService().download(await customerDataScope(request, projectId), recordId);
    const name = encodeURIComponent(file.fileName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    const preview=new URL(request.url).searchParams.get("preview")==="1";
    if(preview&&/\.xlsx$/i.test(file.fileName)){
      try {
        const result=customerXlsxPreview(new Uint8Array(await new Response(file.body).arrayBuffer()),file.fileName);
        if(new URL(request.url).searchParams.get("popup")!=="1")return Response.json({text:result.text},{headers:{"Cache-Control":"private, no-store"}});
        return new Response(result.html,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
      } catch(reason) {return Response.json({error:reason instanceof Error?reason.message:"엑셀 미리보기를 읽지 못했습니다.",downloadAvailable:true},{status:422});}
    }
    const mime=customerFileMime(file.fileName);
    if(preview&&mime==="text/plain"&&new URL(request.url).searchParams.get("popup")!=="1")return Response.json({text:await new Response(file.body).text()},{headers:{"Cache-Control":"private, no-store"}});
    if(preview&&mime==="application/octet-stream")return Response.json({error:"이 형식은 원본 미리보기를 지원하지 않습니다. 다운로드하여 확인하세요.",downloadAvailable:true},{status:422});
    return new Response(file.body, { headers: {
      "Content-Type": preview?mime:"application/octet-stream", "Content-Security-Policy":"sandbox", "Content-Disposition": `${preview?"inline":"attachment"}; filename="customer-data"; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (reason) { return customerDataError(reason); }
}
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, recordId } = await params;
    const input = await request.json();
    const record = await createCustomerDataService().review(await customerDataScope(request, projectId), recordId, input?.reviewed);
    return Response.json({ record });
  } catch (reason) { return customerDataError(reason); }
}
