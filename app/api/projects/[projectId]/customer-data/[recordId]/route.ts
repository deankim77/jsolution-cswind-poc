import { createCustomerDataService } from "../../../../../../services/customer-data-service";
import { customerDataError, customerDataScope } from "../context";
type Params = { params: Promise<{ projectId: string; recordId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, recordId } = await params;
    const file = await createCustomerDataService().download(await customerDataScope(request, projectId), recordId);
    const name = encodeURIComponent(file.fileName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(file.body, { headers: {
      "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="customer-data"; filename*=UTF-8''${name}`,
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
