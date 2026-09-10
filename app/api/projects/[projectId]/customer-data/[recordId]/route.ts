import {customerFileMime} from "../../../../../../services/customer-review-service";
import { createCustomerDataService } from "../../../../../../services/customer-data-service";
import { customerDataError, customerDataScope } from "../context";
type Params = { params: Promise<{ projectId: string; recordId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, recordId } = await params;
    const file = await createCustomerDataService().download(await customerDataScope(request, projectId), recordId);
    const name = encodeURIComponent(file.fileName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    const preview=new URL(request.url).searchParams.get("preview")==="1";
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
