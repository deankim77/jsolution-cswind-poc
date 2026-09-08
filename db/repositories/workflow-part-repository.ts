import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb } from "../index";
import { productParts } from "../schema";
import { workflowSourcePartLinks } from "../workflow-part-schema";

export type WorkflowSourceType = "ECR" | "QUALITY";

export type WorkflowPart = {
  id: string;
  partNumber: string;
  name: string;
  partType: string;
  spec: string | null;
  unit: string;
  revision: string;
  status: string;
};

const partSelect = {
  id: productParts.id,
  partNumber: productParts.partNumber,
  name: productParts.name,
  partType: productParts.partType,
  spec: productParts.spec,
  unit: productParts.unit,
  revision: productParts.revision,
  status: productParts.status,
};

export async function searchActiveWorkflowParts(companyId: string, query = "", limit = 80): Promise<WorkflowPart[]> {
  const db = getDb();
  const normalized = query.trim();
  const conditions = [eq(productParts.companyId, companyId), eq(productParts.status, "active")];
  if (normalized) {
    conditions.push(or(
      ilike(productParts.partNumber, `%${normalized}%`),
      ilike(productParts.name, `%${normalized}%`),
      ilike(productParts.spec, `%${normalized}%`),
    )!);
  }
  return db.select(partSelect)
    .from(productParts)
    .where(and(...conditions))
    .orderBy(asc(productParts.partNumber))
    .limit(Math.max(1, Math.min(200, limit)));
}

export async function findActiveWorkflowPart(companyId: string, partId: string): Promise<WorkflowPart | null> {
  const db = getDb();
  const [part] = await db.select(partSelect)
    .from(productParts)
    .where(and(eq(productParts.companyId, companyId), eq(productParts.id, partId), eq(productParts.status, "active")))
    .limit(1);
  return part ?? null;
}

export async function replaceWorkflowSourcePartLinks(companyId: string, sourceType: WorkflowSourceType, sourceId: string, partIds: string[]) {
  const db = getDb();
  const uniquePartIds = Array.from(new Set(partIds.filter(Boolean)));
  const now = Math.floor(Date.now() / 1000);
  await db.transaction(async tx => {
    await tx.delete(workflowSourcePartLinks).where(and(
      eq(workflowSourcePartLinks.companyId, companyId),
      eq(workflowSourcePartLinks.sourceType, sourceType),
      eq(workflowSourcePartLinks.sourceId, sourceId),
    ));
    if (uniquePartIds.length) {
      await tx.insert(workflowSourcePartLinks).values(uniquePartIds.map((partId, index) => ({
        companyId,
        sourceType,
        sourceId,
        partId,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      })));
    }
  });
}

export async function deleteWorkflowSourcePartLinks(companyId: string, sourceType: WorkflowSourceType, sourceId: string) {
  const db = getDb();
  await db.delete(workflowSourcePartLinks).where(and(
    eq(workflowSourcePartLinks.companyId, companyId),
    eq(workflowSourcePartLinks.sourceType, sourceType),
    eq(workflowSourcePartLinks.sourceId, sourceId),
  ));
}

export async function listWorkflowSourceParts(companyId: string, sourceType: WorkflowSourceType, sourceIds: string[]) {
  if (!sourceIds.length) return [] as Array<WorkflowPart & { sourceId: string; sortOrder: number }>;
  const db = getDb();
  return db.select({
    sourceId: workflowSourcePartLinks.sourceId,
    sortOrder: workflowSourcePartLinks.sortOrder,
    ...partSelect,
  })
    .from(workflowSourcePartLinks)
    .innerJoin(productParts, and(
      eq(productParts.id, workflowSourcePartLinks.partId),
      eq(productParts.companyId, workflowSourcePartLinks.companyId),
    ))
    .where(and(
      eq(workflowSourcePartLinks.companyId, companyId),
      eq(workflowSourcePartLinks.sourceType, sourceType),
      inArray(workflowSourcePartLinks.sourceId, sourceIds),
    ))
    .orderBy(asc(workflowSourcePartLinks.sourceId), asc(workflowSourcePartLinks.sortOrder));
}
