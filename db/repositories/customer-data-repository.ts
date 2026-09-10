import { randomUUID } from "node:crypto";
import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { getDb } from "../index";
import { auditLogs, projectMembers, projectsDb, projectTypes, users } from "../schema";
import { customerRawData, customerRawDataRelations } from "../customer-data-schema";
import { CustomerDataError, PRODUCTION_PROJECT_CODE } from "../../lib/customer-data-contract";

export type CustomerDataScope = { companyId: string; userId: string; systemRoles: string[]; projectId: string };
type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Connection = Database | Transaction;
type NewRawData = Pick<typeof customerRawData.$inferInsert, "id" | "title" | "documentType" | "impactTarget" | "fileKey" | "fileName" | "fileSize" | "checksum" | "note">;
const scopeWhere = (scope: CustomerDataScope) => and(eq(customerRawData.companyId, scope.companyId), eq(customerRawData.projectId, scope.projectId));

// A project row lock serializes writes, including revision allocation and lifecycle checks.
export async function customerDataAccess(db: Connection, scope: CustomerDataScope, write = false) {
  const query = db.select({ id: projectsDb.id, status: projectsDb.status, projectTypeId: projectsDb.projectTypeId })
    .from(projectsDb).where(and(eq(projectsDb.id, scope.projectId), eq(projectsDb.companyId, scope.companyId)));
  const [project] = await (write ? query.for("update") : query);
  if (!project) throw new CustomerDataError("프로젝트를 찾을 수 없습니다.", 404);
  const [member] = await db.select({ role: projectMembers.projectRole }).from(projectMembers)
    .where(and(eq(projectMembers.projectId, scope.projectId), eq(projectMembers.userId, scope.userId)));
  const admin = scope.systemRoles.some(role => ["SUPER_ADMIN", "ADMIN", "SYSTEM_ADMIN"].includes(role));
  if (!admin && !member) throw new CustomerDataError("프로젝트 참여자만 접근할 수 있습니다.", 403);
  const [type] = project.projectTypeId ? await db.select({ code: projectTypes.code }).from(projectTypes)
    .where(and(eq(projectTypes.id, project.projectTypeId), eq(projectTypes.companyId, scope.companyId))) : [];
  if (type?.code !== PRODUCTION_PROJECT_CODE) throw new CustomerDataError("Production 프로젝트에서만 고객 Data를 사용할 수 있습니다.", 409);
  const canUpload = project.status !== "completed";
  if (write && !canUpload) throw new CustomerDataError("완료된 프로젝트는 수정할 수 없습니다.", 409);
  return { canUpload, canReview: canUpload && (admin || ["PM", "PL"].includes(member?.role ?? "")) };
}

async function find(db: Connection, scope: CustomerDataScope, id: string) {
  const [record] = await db.select().from(customerRawData).where(and(scopeWhere(scope), eq(customerRawData.id, id)));
  if (!record) throw new CustomerDataError("이 프로젝트의 원본 데이터를 찾을 수 없습니다.", 404);
  return record;
}

async function audit(tx: Transaction, scope: CustomerDataScope, id: string, action: string, detail: unknown) {
  await tx.insert(auditLogs).values({ id: randomUUID(), companyId: scope.companyId, actorUserId: scope.userId,
    action, entityType: "CUSTOMER_RAW_DATA", entityId: id, detail: JSON.stringify({ projectId: scope.projectId, detail }), createdAt: Math.floor(Date.now() / 1000) });
}

export function createCustomerDataRepository(db: Database = getDb()) {
  return {
    access: (scope: CustomerDataScope) => customerDataAccess(db, scope),
    async list(scope: CustomerDataScope) {
      const permissions = await customerDataAccess(db, scope);
      const records = await db.select({...getTableColumns(customerRawData),createdByName:users.name}).from(customerRawData).leftJoin(users,and(eq(users.id,customerRawData.createdBy),eq(users.companyId,scope.companyId))).where(scopeWhere(scope)).orderBy(desc(customerRawData.createdAt), desc(customerRawData.revision), desc(customerRawData.id));
      const relations = await db.select().from(customerRawDataRelations).where(and(eq(customerRawDataRelations.companyId, scope.companyId), eq(customerRawDataRelations.projectId, scope.projectId)));
      return { ...permissions, records, relations };
    },
    async get(scope: CustomerDataScope, id: string) { await customerDataAccess(db, scope); return find(db, scope, id); },
    async create(scope: CustomerDataScope, data: NewRawData, previousId?: string, relatedId?: string, importOnce = false) {
      return db.transaction(async tx => {
        await customerDataAccess(tx, scope, true);
        if (importOnce) {
          const [existing] = await tx.select().from(customerRawData).where(and(scopeWhere(scope),eq(customerRawData.checksum,data.checksum)));
          if (existing) return existing;
        }
        const previous = previousId ? await find(tx, scope, previousId) : null;
        if (relatedId) await find(tx, scope, relatedId);
        if (previous) {
          const [latest] = await tx.select({ id: customerRawData.id }).from(customerRawData)
            .where(and(scopeWhere(scope), eq(customerRawData.rawDataId, previous.rawDataId)))
            .orderBy(desc(customerRawData.revision)).limit(1);
          if (latest.id !== previous.id) throw new CustomerDataError("최신 버전에 새 Revision을 등록해 주세요. 목록을 새로고침하세요.", 409);
        }
        const now = Math.floor(Date.now() / 1000);
        const [record] = await tx.insert(customerRawData).values({ ...data, companyId: scope.companyId, projectId: scope.projectId,
          rawDataId: previous?.rawDataId ?? `RAW-${randomUUID()}`, revision: previous ? previous.revision + 1 : 1,
          createdBy: scope.userId, createdAt: now }).returning();
        for (const [targetId, relationType] of [[previousId, "supersedes"], [relatedId, "references"]] as const) {
          if (targetId) await tx.insert(customerRawDataRelations).values({ id: randomUUID(), companyId: scope.companyId,
            projectId: scope.projectId, sourceId: record.id, targetId, relationType, createdBy: scope.userId, createdAt: now });
        }
        await audit(tx, scope, record.id, "CUSTOMER_DATA_UPLOADED", { rawDataId: record.rawDataId, revision: record.revision, checksum: record.checksum, previousId, relatedId });
        return record;
      });
    },
    async review(scope: CustomerDataScope, id: string, reviewed: boolean) {
      return db.transaction(async tx => {
        const permission = await customerDataAccess(tx, scope, true);
        if (!permission.canReview) throw new CustomerDataError("PM 또는 PL만 원본 검토 상태를 변경할 수 있습니다.", 403);
        await find(tx, scope, id);
        const now = Math.floor(Date.now() / 1000);
        const [record] = await tx.update(customerRawData).set({ reviewStatus: reviewed ? "reviewed" : "pending",
          reviewedBy: reviewed ? scope.userId : null, reviewedAt: reviewed ? now : null })
          .where(and(scopeWhere(scope), eq(customerRawData.id, id))).returning();
        await audit(tx, scope, id, "CUSTOMER_DATA_REVIEWED", { reviewed });
        return record;
      });
    },
    async link(scope: CustomerDataScope, sourceId: string, targetId: string) {
      return db.transaction(async tx => {
        await customerDataAccess(tx, scope, true);
        if (sourceId === targetId) throw new CustomerDataError("자기 자신은 참조할 수 없습니다.");
        await find(tx, scope, sourceId); await find(tx, scope, targetId);
        const [relation] = await tx.insert(customerRawDataRelations).values({ id: randomUUID(), companyId: scope.companyId,
          projectId: scope.projectId, sourceId, targetId, relationType: "references", createdBy: scope.userId,
          createdAt: Math.floor(Date.now() / 1000) }).onConflictDoNothing().returning();
        if (relation) await audit(tx, scope, sourceId, "CUSTOMER_DATA_LINKED", { targetId });
        return relation ?? null;
      });
    },
  };
}
