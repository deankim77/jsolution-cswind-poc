import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsDb, users } from "./schema";
import type { CustomerDocumentType, CustomerImpactTarget } from "../lib/customer-data-contract";

export const customerRawData = pgTable("customer_raw_data", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  projectId: text("project_id").notNull().references(() => projectsDb.id, { onDelete: "restrict" }),
  rawDataId: text("raw_data_id").notNull(),
  revision: integer("revision").notNull(),
  title: text("title").notNull(),
  documentType: text("document_type").$type<CustomerDocumentType>().notNull(),
  impactTarget: text("impact_target").$type<CustomerImpactTarget>().notNull(),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: text("checksum").notNull(),
  note: text("note"),
  analysisStatus: text("analysis_status").$type<"not_requested">().notNull().default("not_requested"),
  reviewStatus: text("review_status").$type<"pending" | "reviewed">().notNull().default("pending"),
  appliedStatus: text("applied_status").$type<"not_applied">().notNull().default("not_applied"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: integer("reviewed_at"),
}, table => [
  uniqueIndex("customer_raw_data_revision_uq").on(table.projectId, table.rawDataId, table.revision),
  uniqueIndex("customer_raw_data_scope_uq").on(table.companyId, table.projectId, table.id),
  index("customer_raw_data_project_idx").on(table.companyId, table.projectId, table.createdAt),
  check("customer_raw_data_revision_ck", sql`${table.revision} > 0`),
  check("customer_raw_data_size_ck", sql`${table.fileSize} > 0 AND ${table.fileSize} <= 52428800`),
  check("customer_raw_data_type_ck", sql`${table.documentType} IN ('drawing','specification','bom','requirement','report','other')`),
  check("customer_raw_data_impact_ck", sql`${table.impactTarget} IN ('unclassified','pbom','requirement','process','multiple')`),
  check("customer_raw_data_analysis_ck", sql`${table.analysisStatus} = 'not_requested'`),
  check("customer_raw_data_applied_ck", sql`${table.appliedStatus} = 'not_applied'`),
  check("customer_raw_data_review_ck", sql`(${table.reviewStatus} = 'pending' AND ${table.reviewedBy} IS NULL AND ${table.reviewedAt} IS NULL) OR (${table.reviewStatus} = 'reviewed' AND ${table.reviewedBy} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL)`),
]);

export const customerRawDataRelations = pgTable("customer_raw_data_relations", {
  id: text("id").primaryKey(), companyId: text("company_id").notNull(),
  projectId: text("project_id").notNull(),
  sourceId: text("source_id").notNull(), targetId: text("target_id").notNull(),
  relationType: text("relation_type").$type<"references" | "supersedes">().notNull(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
}, table => [
  foreignKey({ name: "customer_relation_source_fk", columns: [table.companyId, table.projectId, table.sourceId], foreignColumns: [customerRawData.companyId, customerRawData.projectId, customerRawData.id] }),
  foreignKey({ name: "customer_relation_target_fk", columns: [table.companyId, table.projectId, table.targetId], foreignColumns: [customerRawData.companyId, customerRawData.projectId, customerRawData.id] }),
  uniqueIndex("customer_relation_uq").on(table.sourceId, table.targetId, table.relationType),
  index("customer_relation_project_idx").on(table.companyId, table.projectId),
  check("customer_relation_self_ck", sql`${table.sourceId} <> ${table.targetId}`),
  check("customer_relation_type_ck", sql`${table.relationType} IN ('references','supersedes')`),
]);
