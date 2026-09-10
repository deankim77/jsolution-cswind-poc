import { createCustomerDataService } from "../../../../../services/customer-data-service";
import { MAX_CUSTOMER_FILE_BYTES, CustomerDataError } from "../../../../../lib/customer-data-contract";
import { customerDataError, customerDataScope } from "./context";
type Params = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const scope = await customerDataScope(request, (await params).projectId);
    return Response.json(await createCustomerDataService().list(scope), { headers: { "Cache-Control": "no-store" } });
  } catch (reason) { return customerDataError(reason); }
}
export async function POST(request: Request, { params }: Params) {
  try {
    const scope = await customerDataScope(request, (await params).projectId);
    const service = createCustomerDataService();
    if (request.headers.get("content-type")?.includes("application/json")) {
      const input = await request.json();
      if (!input || input.action !== "link") throw new CustomerDataError("지원하지 않는 요청입니다.");
      return Response.json({ relation: await service.link(scope, input.sourceId, input.targetId) });
    }
    if (Number(request.headers.get("content-length")) > MAX_CUSTOMER_FILE_BYTES + 1024 * 1024) throw new CustomerDataError("파일은 50MB 이하로 등록하세요.", 413);
    return Response.json({ record: await service.upload(scope, await request.formData(), true) }, { status: 201 });
  } catch (reason) { return customerDataError(reason); }
}
