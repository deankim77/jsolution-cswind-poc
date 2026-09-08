import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "db", "schema.ts");
if (!fs.existsSync(schemaPath)) throw new Error(`Missing schema: ${schemaPath}`);

let schema = fs.readFileSync(schemaPath, "utf8");
if (!schema.includes('from "drizzle-orm/pg-core"')) throw new Error("Expected PostgreSQL Drizzle schema");

// Keep the transitional PostgreSQL representation compatible with the legacy D1 runtime:
// INTEGER timestamps/flags and DOUBLE PRECISION for SQLite REAL values.
for (const name of ["doublePrecision", "primaryKey"]) {
  if (!schema.includes(name)) {
    schema = schema.replace(/import\s*\{([^}]*)\}\s*from\s*["']drizzle-orm\/pg-core["'];?/, (_m, body) => {
      const names = body.split(",").map(v => v.trim()).filter(Boolean);
      if (!names.includes(name)) names.push(name);
      names.sort();
      return `import { ${names.join(", ")} } from "drizzle-orm/pg-core";`;
    });
  }
}

const block = `

// Legacy D1 tables promoted into migration-owned PostgreSQL schema.
// These definitions intentionally preserve D1-compatible physical types during migration.
export const bomRevisions = pgTable("bom_revisions", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), rootPartId:text("root_part_id").notNull(), revisionSeq:integer("revision_seq").notNull(), revision:text("revision").notNull(), structureHash:text("structure_hash").notNull(), snapshotJson:text("snapshot_json").notNull(), changeNote:text("change_note"), createdBy:text("created_by"), createdAt:integer("created_at").notNull(),
});

export const deliverableReviews = pgTable("deliverable_reviews", {
  id:text("id").primaryKey(), projectId:text("project_id").notNull(), deliverableId:text("deliverable_id").notNull(), versionId:text("version_id"), action:text("action").notNull(), note:text("note"), reviewedBy:text("reviewed_by"), reviewedAt:integer("reviewed_at").notNull(),
});

export const deliverableVersions = pgTable("deliverable_versions", {
  id:text("id").primaryKey(), projectId:text("project_id").notNull(), deliverableId:text("deliverable_id").notNull(), taskId:text("task_id"), revision:integer("revision").notNull(), fileKey:text("file_key").notNull(), fileName:text("file_name").notNull(), fileSize:integer("file_size").notNull().default(0), contentType:text("content_type"), note:text("note"), createdBy:text("created_by"), createdAt:integer("created_at").notNull(), deletedAt:integer("deleted_at"), deletedBy:text("deleted_by"), previewFileKey:text("preview_file_key"), conversionStatus:text("conversion_status"), conversionError:text("conversion_error"), convertedAt:integer("converted_at"),
});

export const drawingCodeSequences = pgTable("drawing_code_sequences", {
  companyId:text("company_id").notNull(), issueYear:integer("issue_year").notNull(), nextValue:integer("next_value").notNull().default(1),
}, t => [primaryKey({columns:[t.companyId,t.issueYear]})]);

export const issueAttachments = pgTable("issue_attachments", {
  id:text("id").primaryKey(), projectId:text("project_id").notNull(), issueId:text("issue_id").notNull(), fileKey:text("file_key").notNull(), fileName:text("file_name").notNull(), fileSize:integer("file_size").notNull().default(0), contentType:text("content_type"), createdBy:text("created_by"), createdAt:integer("created_at").notNull(),
});

export const partCategories = pgTable("part_categories", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), code:text("code").notNull(), name:text("name").notNull(), isActive:integer("is_active").notNull().default(1), sortOrder:integer("sort_order").notNull().default(0), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});

export const partCategoryLinks = pgTable("part_category_links", {
  companyId:text("company_id").notNull(), partId:text("part_id").primaryKey(), categoryId:text("category_id").notNull(), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});

export const partCostHistory = pgTable("part_cost_history", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), projectId:text("project_id").notNull(), partId:text("part_id").notNull(), targetCost:doublePrecision("target_cost").notNull().default(0), actualCost:doublePrecision("actual_cost").notNull().default(0), createdBy:text("created_by"), createdAt:integer("created_at").notNull(),
});

export const partNumberSettings = pgTable("part_number_settings", {
  companyId:text("company_id").primaryKey(), prefix:text("prefix").notNull().default("P"), separator:text("separator").notNull().default("-"), digits:integer("digits").notNull().default(6), nextSequence:integer("next_sequence").notNull().default(1), allowManual:integer("allow_manual").notNull().default(1), updatedAt:integer("updated_at").notNull(),
});

export const projectCostBomRoots = pgTable("project_cost_bom_roots", {
  companyId:text("company_id").notNull(), projectId:text("project_id").notNull(), rootPartId:text("root_part_id").notNull(), ownerUserId:text("owner_user_id"), sortOrder:integer("sort_order").notNull().default(0), enabled:integer("enabled").notNull().default(1), createdBy:text("created_by"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
}, t => [primaryKey({columns:[t.projectId,t.rootPartId]})]);

export const projectCostBudgets = pgTable("project_cost_budgets", {
  companyId:text("company_id").notNull(), projectId:text("project_id").notNull(), categoryCode:text("category_code").notNull(), amount:doublePrecision("amount").notNull().default(0), updatedBy:text("updated_by"), updatedAt:integer("updated_at").notNull(),
}, t => [primaryKey({columns:[t.projectId,t.categoryCode]})]);

export const projectCostCategories = pgTable("project_cost_categories", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), code:text("code").notNull(), groupCode:text("group_code").notNull(), name:text("name").notNull(), sourceType:text("source_type").notNull().default("MANUAL"), enabled:integer("enabled").notNull().default(1), sortOrder:integer("sort_order").notNull().default(0), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});

export const projectCostEntries = pgTable("project_cost_entries", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), projectId:text("project_id").notNull(), taskId:text("task_id"), categoryCode:text("category_code").notNull(), amount:doublePrecision("amount").notNull().default(0), occurredOn:text("occurred_on").notNull(), vendor:text("vendor"), note:text("note"), createdBy:text("created_by"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});

export const projectCostProfiles = pgTable("project_cost_profiles", {
  companyId:text("company_id").notNull(), projectId:text("project_id").primaryKey(), bomRootPartId:text("bom_root_part_id"), updatedBy:text("updated_by"), updatedAt:integer("updated_at").notNull(),
});

export const projectIssueActions = pgTable("project_issue_actions", {
  id:text("id").primaryKey(), projectId:text("project_id").notNull(), issueId:text("issue_id").notNull(), action:text("action").notNull(), note:text("note"), actorUserId:text("actor_user_id"), createdAt:integer("created_at").notNull(),
});

export const projectPartCosts = pgTable("project_part_costs", {
  companyId:text("company_id").notNull(), projectId:text("project_id").notNull(), partId:text("part_id").notNull(), targetCost:doublePrecision("target_cost").notNull().default(0), actualCost:doublePrecision("actual_cost").notNull().default(0), updatedBy:text("updated_by"), updatedAt:integer("updated_at").notNull(), costMode:text("cost_mode").notNull().default("AUTO"),
}, t => [primaryKey({columns:[t.projectId,t.partId]})]);

export const systemSeedMarkers = pgTable("system_seed_markers", {
  companyId:text("company_id").notNull(), seedKey:text("seed_key").notNull(), createdAt:integer("created_at").notNull(),
}, t => [primaryKey({columns:[t.companyId,t.seedKey]})]);

export const systemSettings = pgTable("system_settings", {
  companyId:text("company_id").notNull(), settingKey:text("setting_key").notNull(), value:text("value").notNull(), updatedBy:text("updated_by"), updatedAt:integer("updated_at").notNull(),
}, t => [primaryKey({columns:[t.companyId,t.settingKey]})]);

export const taskActuals = pgTable("task_actuals", {
  id:text("id").primaryKey(), projectId:text("project_id").notNull(), taskId:text("task_id").notNull(), userId:text("user_id").notNull(), actualDate:text("actual_date").notNull(), actualHours:doublePrecision("actual_hours").notNull().default(0), progress:integer("progress").notNull().default(0), workNote:text("work_note"), completed:integer("completed").notNull().default(0), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});

export const userNotifications = pgTable("user_notifications", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), userId:text("user_id").notNull(), kind:text("kind").notNull(), entityType:text("entity_type").notNull(), entityId:text("entity_id").notNull(), projectId:text("project_id"), taskId:text("task_id"), eventKey:text("event_key").notNull(), title:text("title").notNull(), message:text("message").notNull(), dueDate:text("due_date"), readAt:integer("read_at"), resolvedAt:integer("resolved_at"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});

export const workflowInstanceDeliverables = pgTable("workflow_instance_deliverables", {
  workflowId:text("workflow_id").notNull(), deliverableId:text("deliverable_id").notNull(), sortOrder:integer("sort_order").notNull().default(0), createdAt:integer("created_at").notNull(),
}, t => [primaryKey({columns:[t.workflowId,t.deliverableId]})]);

export const workflowSourceAttachments = pgTable("workflow_source_attachments", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), projectId:text("project_id").notNull(), sourceType:text("source_type").notNull(), sourceId:text("source_id").notNull(), fileKey:text("file_key").notNull(), fileName:text("file_name").notNull(), fileSize:integer("file_size").notNull().default(0), contentType:text("content_type"), createdBy:text("created_by").notNull(), createdAt:integer("created_at").notNull(),
});

export const workflowStepDocumentRules = pgTable("workflow_step_document_rules", {
  stepId:text("step_id").primaryKey(), workflowId:text("workflow_id").notNull(), documentAction:text("document_action").notNull().default("NONE"), documentRequired:integer("document_required").notNull().default(0), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});

export const workflowStepDocuments = pgTable("workflow_step_documents", {
  id:text("id").primaryKey(), workflowId:text("workflow_id").notNull(), stepId:text("step_id").notNull(), deliverableId:text("deliverable_id").notNull(), versionId:text("version_id").notNull(), documentAction:text("document_action").notNull(), changeReason:text("change_reason"), createdBy:text("created_by").notNull(), createdAt:integer("created_at").notNull(),
});
`;

if (!schema.includes('pgTable("bom_revisions"')) {
  schema += block;
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log("Added 24 legacy D1 tables to db/schema.ts");
} else {
  console.log("Legacy D1 tables already present in db/schema.ts");
}

console.log("Legacy D1 schema promotion complete. Next: npm.cmd run db:generate");
