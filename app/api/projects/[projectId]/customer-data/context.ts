import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
import { contextErrorResponse, resolveRequestContext } from "../../../../../db/request-context";
import { CustomerDataError } from "../../../../../lib/customer-data-contract";

export async function customerDataScope(request: Request, projectId: string) {
  // Reuse the application identity boundary; new business queries live in the Drizzle repository.
  return { ...await resolveRequestContext(request, getLegacyDbCompat()), projectId };
}
export function customerDataError(reason: unknown) {
  if (reason instanceof CustomerDataError) return Response.json({ error: reason.message }, { status: reason.status });
  if (reason instanceof SyntaxError || reason instanceof TypeError) return Response.json({ error: "요청 형식을 확인하세요." }, { status: 400 });
  const response = contextErrorResponse(reason);
  if (response) return response;
  console.error("Customer Data request failed", reason);
  return Response.json({ error: "고객 Data 처리에 실패했습니다. 잠시 후 다시 시도하세요." }, { status: 500 });
}
