import { doublePrecision, integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

const audit = {
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
};

export const companies = pgTable("companies", {
  id: text("id").primaryKey(), name: text("name").notNull(), code: text("code").notNull(), status: text("status").notNull().default("active"), ...audit,
}, table => [uniqueIndex("companies_code_uq").on(table.code)]);

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(), companyId: text("company_id").notNull().references(() => companies.id), parentId: text("parent_id"), name: text("name").notNull(), code: text("code").notNull(), sortOrder: integer("sort_order").notNull().default(0), ...audit,
}, table => [uniqueIndex("organizations_company_code_uq").on(table.companyId, table.code)]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), companyId: text("company_id").notNull().references(() => companies.id), organizationId: text("organization_id").references(() => organizations.id), email: text("email").notNull(), name: text("name").notNull(), status: text("status").notNull().default("invited"), avatarKey: text("avatar_key").notNull().default("avatar-01"), ...audit,
}, table => [uniqueIndex("users_company_email_uq").on(table.companyId, table.email)]);

export const roles = pgTable("roles", { id:text("id").primaryKey(), companyId:text("company_id").notNull().references(() => companies.id), code:text("code").notNull(), name:text("name").notNull(), scope:text("scope").notNull(), permissions:text("permissions").notNull(), ...audit }, table => [uniqueIndex("roles_company_code_uq").on(table.companyId, table.code)]);
export const userRoles = pgTable("user_roles", { userId:text("user_id").notNull().references(() => users.id), roleId:text("role_id").notNull().references(() => roles.id), projectId:text("project_id") }, table => [primaryKey({columns:[table.userId,table.roleId]})]);

export const commonCodes = pgTable("common_codes", { id:text("id").primaryKey(), companyId:text("company_id").notNull().references(() => companies.id), groupCode:text("group_code").notNull(), code:text("code").notNull(), label:text("label").notNull(), version:integer("version").notNull().default(1), sortOrder:integer("sort_order").notNull().default(0), enabled:integer("enabled").notNull().default(1), ...audit }, table => [uniqueIndex("common_codes_version_uq").on(table.companyId, table.groupCode, table.code, table.version)]);
export const templates = pgTable("templates", { id:text("id").primaryKey(), companyId:text("company_id").notNull().references(() => companies.id), code:text("code").notNull(), name:text("name").notNull(), status:text("status").notNull().default("draft"), ...audit }, table => [uniqueIndex("templates_company_code_uq").on(table.companyId, table.code)]);
export const templateVersions = pgTable("template_versions", { id:text("id").primaryKey(), templateId:text("template_id").notNull().references(() => templates.id), version:text("version").notNull(), definition:text("definition").notNull(), publishedAt:integer("published_at"), createdBy:text("created_by").notNull().references(() => users.id), ...audit }, table => [uniqueIndex("template_versions_template_version_uq").on(table.templateId, table.version)]);

export const projectsDb = pgTable("projects", { id:text("id").primaryKey(), companyId:text("company_id").notNull().references(() => companies.id), templateVersionId:text("template_version_id").notNull().references(() => templateVersions.id), code:text("code").notNull(), name:text("name").notNull(), customerName:text("customer_name"), partnerId:text("partner_id"), projectTypeId:text("project_type_id"), startDate:text("start_date").notNull(), endDate:text("end_date").notNull(), status:text("status").notNull().default("preparing"), templateSnapshot:text("template_snapshot").notNull(), ...audit }, table => [uniqueIndex("projects_company_code_uq").on(table.companyId, table.code)]);
export const projectMembers = pgTable("project_members", { projectId:text("project_id").notNull().references(() => projectsDb.id), userId:text("user_id").notNull().references(() => users.id), projectRole:text("project_role").notNull(), ...audit }, table => [primaryKey({columns:[table.projectId,table.userId]})]);
export const projectRoles = pgTable("project_roles", { id:text("id").primaryKey(), projectId:text("project_id").notNull().references(() => projectsDb.id), code:text("code").notNull(), name:text("name").notNull(), sortOrder:integer("sort_order").notNull().default(0), ...audit }, table => [uniqueIndex("project_roles_project_code_uq").on(table.projectId,table.code)]);
export const wbsTasks = pgTable("wbs_tasks", { id:text("id").primaryKey(), projectId:text("project_id").notNull().references(() => projectsDb.id), wbsCode:text("wbs_code").notNull(), parentId:text("parent_id"), level:integer("level").notNull(), sortOrder:integer("sort_order").notNull(), kind:text("kind").notNull().default("task"), name:text("name").notNull(), taskType:text("task_type").notNull().default("normal"), durationDays:integer("duration_days").notNull().default(1), plannedStart:text("planned_start"), plannedEnd:text("planned_end"), predecessorId:text("predecessor_id"), roleCode:text("role_code"), assigneeUserId:text("assignee_user_id"), progress:integer("progress").notNull().default(0), status:text("status").notNull().default("planned"), completionActor:text("completion_actor").notNull().default("assignee"), completionCriteria:text("completion_criteria"), ...audit }, table => [uniqueIndex("wbs_tasks_project_code_uq").on(table.projectId,table.wbsCode)]);
export const projectBaselines = pgTable("project_baselines", { id:text("id").primaryKey(), projectId:text("project_id").notNull().references(()=>projectsDb.id,{onDelete:"cascade"}), version:integer("version").notNull(), name:text("name").notNull(), capturedAt:integer("captured_at").notNull(), capturedBy:text("captured_by"), isActive:integer("is_active").notNull().default(1) }, table=>[uniqueIndex("project_baselines_project_version_uq").on(table.projectId,table.version)]);
export const projectBaselineTasks = pgTable("project_baseline_tasks", { baselineId:text("baseline_id").notNull().references(()=>projectBaselines.id,{onDelete:"cascade"}), taskId:text("task_id").notNull(), wbsCode:text("wbs_code").notNull(), name:text("name").notNull(), plannedStart:text("planned_start"), plannedEnd:text("planned_end"), durationDays:integer("duration_days").notNull(), sortOrder:integer("sort_order").notNull() }, table=>[primaryKey({columns:[table.baselineId,table.taskId]})]);
export const deliverables = pgTable("deliverables", {
  drawingCode:text("drawing_code"),
  drawingCompanyId:text("drawing_company_id"),
  drawingType:text("drawing_type"),
  internalDrawingNumber:text("internal_drawing_number"),
  customerDrawingNumber:text("customer_drawing_number"),
  ownerDepartment:text("owner_department"),
  ownerUserId:text("owner_user_id"), id:text("id").primaryKey(), projectId:text("project_id").notNull().references(() => projectsDb.id), taskId:text("task_id").references(() => wbsTasks.id), name:text("name").notNull(), category:text("category"), required:integer("required").notNull().default(1), status:text("status").notNull().default("planned"), fileKey:text("file_key"), version:text("version"), ...audit });
export const projectIssues = pgTable("project_issues", {
  createdBy:text("created_by"), id:text("id").primaryKey(), projectId:text("project_id").notNull().references(() => projectsDb.id), taskId:text("task_id").references(() => wbsTasks.id), issueType:text("issue_type").notNull().default("issue"), title:text("title").notNull(), description:text("description"), severity:text("severity").notNull().default("medium"), status:text("status").notNull().default("open"), ownerUserId:text("owner_user_id"), dueDate:text("due_date"), ...audit });
export const projectMeetings = pgTable("project_meetings", { id:text("id").primaryKey(), projectId:text("project_id").notNull().references(() => projectsDb.id), title:text("title").notNull(), meetingAt:integer("meeting_at").notNull(), minutes:text("minutes"), createdBy:text("created_by").references(() => users.id), ...audit });
export const projectDocuments = pgTable("project_documents", { id:text("id").primaryKey(), projectId:text("project_id").notNull().references(() => projectsDb.id), taskId:text("task_id").references(() => wbsTasks.id), title:text("title").notNull(), category:text("category"), fileKey:text("file_key"), version:text("version"), status:text("status").notNull().default("draft"), createdBy:text("created_by").references(() => users.id), ...audit });
export const auditLogs = pgTable("audit_logs", { id:text("id").primaryKey(), companyId:text("company_id").notNull(), actorUserId:text("actor_user_id"), action:text("action").notNull(), entityType:text("entity_type").notNull(), entityId:text("entity_id").notNull(), detail:text("detail"), createdAt:integer("created_at").notNull() });

export const aiConversations = pgTable("ai_conversations", {
  groupName:text("group_name"),
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), userId:text("user_id").notNull(),
  title:text("title").notNull(), source:text("source").notNull(), contextType:text("context_type").notNull(),
  contextTitle:text("context_title").notNull(), contextItems:text("context_items").notNull(),
  createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});
export const aiMessages = pgTable("ai_messages", {
  id:text("id").primaryKey(), conversationId:text("conversation_id").notNull().references(()=>aiConversations.id),
  role:text("role").notNull(), content:text("content").notNull(), citations:text("citations"),
  createdAt:integer("created_at").notNull(),
});
export const userWorkState = pgTable("user_work_state", {
  userId:text("user_id").notNull(), stateKey:text("state_key").notNull(), value:text("value").notNull(),
  updatedAt:integer("updated_at").notNull(),
}, table=>[primaryKey({columns:[table.userId,table.stateKey]})]);

export const workCalendars = pgTable("work_calendars", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull().references(()=>companies.id),
  name:text("name").notNull(), timezone:text("timezone").notNull().default("Asia/Seoul"),
  workingDays:text("working_days").notNull(), isDefault:integer("is_default").notNull().default(0),
  ...audit,
});
export const calendarHolidays = pgTable("calendar_holidays", {
  id:text("id").primaryKey(), calendarId:text("calendar_id").notNull().references(()=>workCalendars.id,{onDelete:"cascade"}),
  holidayDate:text("holiday_date").notNull(), name:text("name").notNull(), ...audit,
}, table=>[uniqueIndex("calendar_holidays_calendar_date_uq").on(table.calendarId,table.holidayDate)]);

export const partners = pgTable("partners", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull().references(()=>companies.id),
  code:text("code").notNull(), name:text("name").notNull(), category:text("category"), contactName:text("contact_name"),
  email:text("email"), phone:text("phone"), status:text("status").notNull().default("active"), ...audit,
}, table=>[uniqueIndex("partners_company_code_uq").on(table.companyId,table.code)]);
export const projectTypes = pgTable("project_types", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull().references(()=>companies.id),
  code:text("code").notNull(), name:text("name").notNull(), description:text("description"), status:text("status").notNull().default("active"), ...audit,
}, table=>[uniqueIndex("project_types_company_code_uq").on(table.companyId,table.code)]);

export const partnerProfiles = pgTable("partner_profiles", {
  partnerId:text("partner_id").primaryKey().references(()=>partners.id,{onDelete:"cascade"}),englishName:text("english_name"),country:text("country"),industry:text("industry"),representativeName:text("representative_name"),businessRegistrationNumber:text("business_registration_number"),address:text("address"),mainPhone:text("main_phone"),extra:text("extra"),note:text("note"),updatedAt:integer("updated_at").notNull(),
});
export const projectRoleCatalog = pgTable("project_role_catalog", {
  id:text("id").primaryKey(),companyId:text("company_id").notNull().references(()=>companies.id),code:text("code").notNull(),name:text("name").notNull(),groupName:text("group_name").notNull(),required:integer("required").notNull().default(0),enabled:integer("enabled").notNull().default(1),sortOrder:integer("sort_order").notNull().default(0),...audit,
},table=>[uniqueIndex("project_role_catalog_company_code_uq").on(table.companyId,table.code)]);
export const projectProfiles = pgTable("project_profiles", {projectId:text("project_id").primaryKey().references(()=>projectsDb.id,{onDelete:"cascade"}),description:text("description"),referenceCode:text("reference_code"),visibility:text("visibility").notNull().default("company"),updatedAt:integer("updated_at").notNull()});
export const projectShares = pgTable("project_shares", {projectId:text("project_id").notNull().references(()=>projectsDb.id,{onDelete:"cascade"}),organizationId:text("organization_id").notNull().references(()=>organizations.id),createdAt:integer("created_at").notNull()},table=>[primaryKey({columns:[table.projectId,table.organizationId]})]);
export const savedFilters = pgTable("saved_filters", {id:text("id").primaryKey(),companyId:text("company_id").notNull(),userId:text("user_id").notNull(),workspace:text("workspace").notNull(),name:text("name").notNull(),definition:text("definition").notNull(),isDefault:integer("is_default").notNull().default(0),...audit});
export const workspaceTabs = pgTable("workspace_tabs", {userId:text("user_id").notNull(),tabId:text("tab_id").notNull(),workspace:text("workspace").notNull(),title:text("title").notNull(),context:text("context").notNull(),sortOrder:integer("sort_order").notNull().default(0),isActive:integer("is_active").notNull().default(0),updatedAt:integer("updated_at").notNull()},table=>[primaryKey({columns:[table.userId,table.tabId]})]);
export const projectGateDecisions = pgTable("project_gate_decisions", {
  id:text("id").primaryKey(),projectId:text("project_id").notNull().references(()=>projectsDb.id),gateTaskId:text("gate_task_id").notNull().references(()=>wbsTasks.id),gateCode:text("gate_code").notNull(),decision:text("decision").notNull(),note:text("note"),decidedBy:text("decided_by").notNull().references(()=>users.id),decidedAt:integer("decided_at").notNull(),
});

export const workflowTemplates = pgTable("workflow_templates", {id:text("id").primaryKey(),companyId:text("company_id").notNull().references(()=>companies.id),code:text("code").notNull(),name:text("name").notNull(),applicationType:text("application_type").notNull().default("GENERAL"),description:text("description"),projectRequired:integer("project_required").notNull().default(1),taskLinkMode:text("task_link_mode").notNull().default("optional"),registerCommonDocument:integer("register_common_document").notNull().default(0),documentCategory:text("document_category"),status:text("status").notNull().default("active"),currentVersion:integer("current_version").notNull().default(1),...audit},table=>[uniqueIndex("workflow_templates_company_code_uq").on(table.companyId,table.code)]);
export const workflowTemplateVersions = pgTable("workflow_template_versions", {id:text("id").primaryKey(),templateId:text("template_id").notNull().references(()=>workflowTemplates.id),version:integer("version").notNull(),definition:text("definition").notNull(),status:text("status").notNull().default("published"),publishedAt:integer("published_at"),createdBy:text("created_by").notNull().references(()=>users.id),...audit},table=>[uniqueIndex("workflow_template_versions_template_version_uq").on(table.templateId,table.version)]);
export const workflowInstances = pgTable("workflow_instances", {id:text("id").primaryKey(),companyId:text("company_id").notNull().references(()=>companies.id),projectId:text("project_id").notNull().references(()=>projectsDb.id),taskId:text("task_id").references(()=>wbsTasks.id),templateId:text("template_id").notNull().references(()=>workflowTemplates.id),templateVersionId:text("template_version_id").notNull().references(()=>workflowTemplateVersions.id),workflowNumber:text("workflow_number").notNull(),title:text("title").notNull(),requestContent:text("request_content"),sourceType:text("source_type").notNull().default("GENERAL"),sourceId:text("source_id"),priority:text("priority").notNull().default("normal"),dueDate:text("due_date"),status:text("status").notNull().default("draft"),currentStepOrder:integer("current_step_order").notNull().default(0),requesterUserId:text("requester_user_id").notNull().references(()=>users.id),mainDeliverableId:text("main_deliverable_id").references(()=>deliverables.id),officialDocumentId:text("official_document_id").references(()=>projectDocuments.id),...audit},table=>[uniqueIndex("workflow_instances_company_number_uq").on(table.companyId,table.workflowNumber)]);
export const workflowInstanceSteps = pgTable("workflow_instance_steps", {id:text("id").primaryKey(),workflowId:text("workflow_id").notNull().references(()=>workflowInstances.id,{onDelete:"cascade"}),stepOrder:integer("step_order").notNull(),name:text("name").notNull(),actionType:text("action_type").notNull(),roleCode:text("role_code"),assignmentRule:text("assignment_rule"),dueDays:integer("due_days").notNull().default(0),commentRequired:integer("comment_required").notNull().default(0),attachmentRequired:integer("attachment_required").notNull().default(0),assigneeUserId:text("assignee_user_id").references(()=>users.id),status:text("status").notNull().default("waiting"),startedAt:integer("started_at"),completedAt:integer("completed_at"),comment:text("comment"),...audit},table=>[uniqueIndex("workflow_instance_steps_order_uq").on(table.workflowId,table.stepOrder)]);
export const workflowHistory = pgTable("workflow_history", {id:text("id").primaryKey(),workflowId:text("workflow_id").notNull().references(()=>workflowInstances.id,{onDelete:"cascade"}),stepId:text("step_id").references(()=>workflowInstanceSteps.id),actorUserId:text("actor_user_id").notNull().references(()=>users.id),action:text("action").notNull(),previousStatus:text("previous_status"),nextStatus:text("next_status"),comment:text("comment"),attachments:text("attachments"),createdAt:integer("created_at").notNull()});
export const designChangeRequests = pgTable("design_change_requests", {
  drawingId:text("drawing_id"),
  changeType:text("change_type"),id:text("id").primaryKey(),companyId:text("company_id").notNull().references(()=>companies.id),projectId:text("project_id").references(()=>projectsDb.id),taskId:text("task_id").references(()=>wbsTasks.id),ecrNumber:text("ecr_number").notNull(),title:text("title").notNull(),changeTarget:text("change_target"),beforeContent:text("before_content"),afterContent:text("after_content"),reason:text("reason"),impactContent:text("impact_content"),priority:text("priority").notNull().default("normal"),dueDate:text("due_date"),requesterUserId:text("requester_user_id").notNull().references(()=>users.id),requestedAt:integer("requested_at").notNull(),workflowId:text("workflow_id").references(()=>workflowInstances.id),status:text("status").notNull().default("draft"),...audit},table=>[uniqueIndex("design_change_requests_company_number_uq").on(table.companyId,table.ecrNumber)]);
export const qualityCases = pgTable("quality_cases", {id:text("id").primaryKey(),companyId:text("company_id").notNull().references(()=>companies.id),projectId:text("project_id").references(()=>projectsDb.id),taskId:text("task_id").references(()=>wbsTasks.id),qualityNumber:text("quality_number").notNull(),title:text("title").notNull(),occurredOn:text("occurred_on"),issueType:text("issue_type"),severity:text("severity").notNull().default("medium"),description:text("description"),rootCause:text("root_cause"),correctiveAction:text("corrective_action"),effectivenessCheck:text("effectiveness_check"),dueDate:text("due_date"),ownerUserId:text("owner_user_id").references(()=>users.id),workflowId:text("workflow_id").references(()=>workflowInstances.id),status:text("status").notNull().default("draft"),...audit},table=>[uniqueIndex("quality_cases_company_number_uq").on(table.companyId,table.qualityNumber)]);


// Product/BOM tables promoted from legacy runtime DDL.
export const productParts = pgTable("product_parts", {
  actualCost:doublePrecision("actual_cost").notNull().default(0),
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), partNumber:text("part_number").notNull(), name:text("name").notNull(),
  partType:text("part_type").notNull().default("PART"), spec:text("spec"), unit:text("unit").notNull().default("EA"), revision:text("revision").notNull().default("A"),
  status:text("status").notNull().default("active"), standardCost:doublePrecision("standard_cost").notNull().default(0), createdBy:text("created_by"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
}, t=>[uniqueIndex("product_parts_company_number_uq").on(t.companyId,t.partNumber)]);

export const productBomItems = pgTable("product_bom_items", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), parentPartId:text("parent_part_id").notNull(), childPartId:text("child_part_id").notNull(),
  quantity:doublePrecision("quantity").notNull().default(1), unit:text("unit").notNull().default("EA"), sortOrder:integer("sort_order").notNull().default(0), note:text("note"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
}, t=>[uniqueIndex("product_bom_parent_child_uq").on(t.companyId,t.parentPartId,t.childPartId)]);

export const bomEditLocks = pgTable("bom_edit_locks", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), rootPartId:text("root_part_id").notNull(), lockedBy:text("locked_by").notNull(), lockedAt:integer("locked_at").notNull(), updatedAt:integer("updated_at").notNull(),
}, t=>[uniqueIndex("bom_edit_locks_company_root_uq").on(t.companyId,t.rootPartId)]);

export const partNumberHistory = pgTable("part_number_history", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), partId:text("part_id").notNull(), partNumber:text("part_number").notNull(), ruleCode:text("rule_code").notNull(), createdBy:text("created_by"), createdAt:integer("created_at").notNull(),
});

export const costSheets = pgTable("cost_sheets", {
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), partId:text("part_id").notNull(), version:integer("version").notNull().default(1),
  materialCost:doublePrecision("material_cost").notNull().default(0), laborCost:doublePrecision("labor_cost").notNull().default(0), overheadCost:doublePrecision("overhead_cost").notNull().default(0), totalCost:doublePrecision("total_cost").notNull().default(0),
  note:text("note"), status:text("status").notNull().default("draft"), createdBy:text("created_by"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
}, t=>[uniqueIndex("cost_sheets_part_version_uq").on(t.companyId,t.partId,t.version)]);


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
  id:text("id").primaryKey(), companyId:text("company_id").notNull(), projectId:text("project_id"), sourceType:text("source_type").notNull(), sourceId:text("source_id").notNull(), fileKey:text("file_key").notNull(), fileName:text("file_name").notNull(), fileSize:integer("file_size").notNull().default(0), contentType:text("content_type"), createdBy:text("created_by").notNull(), createdAt:integer("created_at").notNull(),
});

export const workflowStepDocumentRules = pgTable("workflow_step_document_rules", {
  stepId:text("step_id").primaryKey(), workflowId:text("workflow_id").notNull(), documentAction:text("document_action").notNull().default("NONE"), documentRequired:integer("document_required").notNull().default(0), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),
});

export const workflowStepDocuments = pgTable("workflow_step_documents", {
  id:text("id").primaryKey(), workflowId:text("workflow_id").notNull(), stepId:text("step_id").notNull(), deliverableId:text("deliverable_id").notNull(), versionId:text("version_id").notNull(), documentAction:text("document_action").notNull(), changeReason:text("change_reason"), createdBy:text("created_by").notNull(), createdAt:integer("created_at").notNull(),
});
