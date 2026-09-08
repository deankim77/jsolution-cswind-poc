import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
import { contextErrorResponse, resolveRequestContext } from "../../../../db/request-context";
import { listWorkflowDrawingOptions } from "../../../../services/workflow-drawing-service";

export async function GET(request: Request) {
  const contextDb = getLegacyDbCompat();
  let context;
  try {
    context = await resolveRequestContext(request, contextDb);
  } catch (reason) {
    return contextErrorResponse(reason) ?? Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  try {
    const drawings = await listWorkflowDrawingOptions(context.companyId, query);
    return Response.json({ drawings });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "도면을 불러오지 못했습니다." }, { status: 500 });
  }
}
