import {
  deleteWorkflowSourceDrawingLinks,
  findWorkflowDrawing,
  listWorkflowSourceDrawings,
  replaceWorkflowSourceDrawingLinks,
  searchWorkflowDrawings,
  type WorkflowDrawing,
  type WorkflowDrawingSourceType,
} from "../db/repositories/workflow-drawing-repository";

function normalizeSourceType(value: string): WorkflowDrawingSourceType {
  if (value === "ECR" || value === "QUALITY") return value;
  throw new Error("지원하지 않는 도면 연결 업무 유형입니다.");
}

function isMissingDrawingLinkTable(reason: unknown) {
  const code = typeof reason === "object" && reason !== null && "code" in reason
    ? String((reason as { code?: unknown }).code ?? "")
    : "";
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  return code === "42P01" || /relation ["']workflow_source_drawing_links["'] does not exist/i.test(message);
}

export async function listWorkflowDrawingOptions(companyId: string, query = "") {
  return searchWorkflowDrawings(companyId, query, 80);
}

export async function requireWorkflowDrawing(companyId: string, drawingId: string): Promise<WorkflowDrawing> {
  const normalized = drawingId.trim();
  if (!normalized) throw new Error("관련 도면을 선택해 주세요.");
  const drawing = await findWorkflowDrawing(companyId, normalized);
  if (!drawing) throw new Error("선택한 도면을 찾을 수 없습니다.");
  return drawing;
}

export async function setSourcePrimaryDrawing(companyId: string, sourceType: string, sourceId: string, drawing: WorkflowDrawing) {
  await replaceWorkflowSourceDrawingLinks(companyId, normalizeSourceType(sourceType), sourceId, [drawing.id]);
  return drawing;
}

export async function getSourcePrimaryDrawing(companyId: string, sourceType: string, sourceId: string) {
  try {
    const rows = await listWorkflowSourceDrawings(companyId, normalizeSourceType(sourceType), [sourceId]);
    return rows.sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
  } catch (reason) {
    if (isMissingDrawingLinkTable(reason)) return null;
    throw reason;
  }
}

export async function getSourceDrawingsMap(companyId: string, sourceType: string, sourceIds: string[]) {
  try {
    const rows = await listWorkflowSourceDrawings(companyId, normalizeSourceType(sourceType), sourceIds);
    const map = new Map<string, typeof rows>();
    rows.forEach(row => map.set(row.sourceId, [...(map.get(row.sourceId) ?? []), row]));
    return map;
  } catch (reason) {
    if (isMissingDrawingLinkTable(reason)) return new Map();
    throw reason;
  }
}

export async function clearSourceDrawings(companyId: string, sourceType: string, sourceId: string) {
  try {
    await deleteWorkflowSourceDrawingLinks(companyId, normalizeSourceType(sourceType), sourceId);
  } catch (reason) {
    if (isMissingDrawingLinkTable(reason)) return;
    throw reason;
  }
}
