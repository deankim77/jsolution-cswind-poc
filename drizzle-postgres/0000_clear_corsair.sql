CREATE TABLE "ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"context_type" text NOT NULL,
	"context_title" text NOT NULL,
	"context_items" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"citations" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"detail" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"holiday_date" text NOT NULL,
	"name" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "common_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"group_code" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"name" text NOT NULL,
	"category" text,
	"required" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"file_key" text,
	"version" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_change_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"ecr_number" text NOT NULL,
	"title" text NOT NULL,
	"change_target" text,
	"before_content" text,
	"after_content" text,
	"reason" text,
	"impact_content" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"requester_user_id" text NOT NULL,
	"requested_at" integer NOT NULL,
	"workflow_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_profiles" (
	"partner_id" text PRIMARY KEY NOT NULL,
	"english_name" text,
	"country" text,
	"industry" text,
	"representative_name" text,
	"business_registration_number" text,
	"address" text,
	"main_phone" text,
	"extra" text,
	"note" text,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"contact_name" text,
	"email" text,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_baseline_tasks" (
	"baseline_id" text NOT NULL,
	"task_id" text NOT NULL,
	"wbs_code" text NOT NULL,
	"name" text NOT NULL,
	"planned_start" text,
	"planned_end" text,
	"duration_days" integer NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "project_baseline_tasks_baseline_id_task_id_pk" PRIMARY KEY("baseline_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "project_baselines" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"captured_at" integer NOT NULL,
	"captured_by" text,
	"is_active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"title" text NOT NULL,
	"category" text,
	"file_key" text,
	"version" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_gate_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"gate_task_id" text NOT NULL,
	"gate_code" text NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"decided_by" text NOT NULL,
	"decided_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"issue_type" text DEFAULT 'issue' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"owner_user_id" text,
	"due_date" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"meeting_at" integer NOT NULL,
	"minutes" text,
	"created_by" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_role" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_profiles" (
	"project_id" text PRIMARY KEY NOT NULL,
	"description" text,
	"reference_code" text,
	"visibility" text DEFAULT 'company' NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_role_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"group_name" text NOT NULL,
	"required" integer DEFAULT 0 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_shares" (
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" integer NOT NULL,
	CONSTRAINT "project_shares_project_id_organization_id_pk" PRIMARY KEY("project_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "project_types" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"template_version_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"customer_name" text,
	"partner_id" text,
	"project_type_id" text,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'preparing' NOT NULL,
	"template_snapshot" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"quality_number" text NOT NULL,
	"title" text NOT NULL,
	"occurred_on" text,
	"issue_type" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"description" text,
	"root_cause" text,
	"corrective_action" text,
	"effectiveness_check" text,
	"owner_user_id" text,
	"workflow_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"permissions" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_filters" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace" text NOT NULL,
	"name" text NOT NULL,
	"definition" text NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"version" text NOT NULL,
	"definition" text NOT NULL,
	"published_at" integer,
	"created_by" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"project_id" text,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_work_state" (
	"user_id" text NOT NULL,
	"state_key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" integer NOT NULL,
	CONSTRAINT "user_work_state_user_id_state_key_pk" PRIMARY KEY("user_id","state_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"organization_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"avatar_key" text DEFAULT 'avatar-01' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wbs_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"wbs_code" text NOT NULL,
	"parent_id" text,
	"level" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"kind" text DEFAULT 'task' NOT NULL,
	"name" text NOT NULL,
	"task_type" text DEFAULT 'normal' NOT NULL,
	"duration_days" integer DEFAULT 1 NOT NULL,
	"planned_start" text,
	"planned_end" text,
	"predecessor_id" text,
	"role_code" text,
	"assignee_user_id" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"completion_actor" text DEFAULT 'assignee' NOT NULL,
	"completion_criteria" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_calendars" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Seoul' NOT NULL,
	"working_days" text NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_history" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"step_id" text,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"previous_status" text,
	"next_status" text,
	"comment" text,
	"attachments" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instance_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"step_order" integer NOT NULL,
	"name" text NOT NULL,
	"action_type" text NOT NULL,
	"role_code" text,
	"assignment_rule" text,
	"due_days" integer DEFAULT 0 NOT NULL,
	"comment_required" integer DEFAULT 0 NOT NULL,
	"attachment_required" integer DEFAULT 0 NOT NULL,
	"assignee_user_id" text,
	"status" text DEFAULT 'waiting' NOT NULL,
	"started_at" integer,
	"completed_at" integer,
	"comment" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"template_id" text NOT NULL,
	"template_version_id" text NOT NULL,
	"workflow_number" text NOT NULL,
	"title" text NOT NULL,
	"request_content" text,
	"source_type" text DEFAULT 'GENERAL' NOT NULL,
	"source_id" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"due_date" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_step_order" integer DEFAULT 0 NOT NULL,
	"requester_user_id" text NOT NULL,
	"main_deliverable_id" text,
	"official_document_id" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"version" integer NOT NULL,
	"definition" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"published_at" integer,
	"created_by" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"application_type" text DEFAULT 'GENERAL' NOT NULL,
	"description" text,
	"project_required" integer DEFAULT 1 NOT NULL,
	"task_link_mode" text DEFAULT 'optional' NOT NULL,
	"register_common_document" integer DEFAULT 0 NOT NULL,
	"document_category" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_tabs" (
	"user_id" text NOT NULL,
	"tab_id" text NOT NULL,
	"workspace" text NOT NULL,
	"title" text NOT NULL,
	"context" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 0 NOT NULL,
	"updated_at" integer NOT NULL,
	CONSTRAINT "workspace_tabs_user_id_tab_id_pk" PRIMARY KEY("user_id","tab_id")
);
--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_holidays" ADD CONSTRAINT "calendar_holidays_calendar_id_work_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."work_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "common_codes" ADD CONSTRAINT "common_codes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_task_id_wbs_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wbs_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_change_requests" ADD CONSTRAINT "design_change_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_change_requests" ADD CONSTRAINT "design_change_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_change_requests" ADD CONSTRAINT "design_change_requests_task_id_wbs_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wbs_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_change_requests" ADD CONSTRAINT "design_change_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_change_requests" ADD CONSTRAINT "design_change_requests_workflow_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_baseline_tasks" ADD CONSTRAINT "project_baseline_tasks_baseline_id_project_baselines_id_fk" FOREIGN KEY ("baseline_id") REFERENCES "public"."project_baselines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_baselines" ADD CONSTRAINT "project_baselines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_task_id_wbs_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wbs_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_gate_decisions" ADD CONSTRAINT "project_gate_decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_gate_decisions" ADD CONSTRAINT "project_gate_decisions_gate_task_id_wbs_tasks_id_fk" FOREIGN KEY ("gate_task_id") REFERENCES "public"."wbs_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_gate_decisions" ADD CONSTRAINT "project_gate_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_task_id_wbs_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wbs_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_meetings" ADD CONSTRAINT "project_meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_meetings" ADD CONSTRAINT "project_meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_profiles" ADD CONSTRAINT "project_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_role_catalog" ADD CONSTRAINT "project_role_catalog_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_roles" ADD CONSTRAINT "project_roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_shares" ADD CONSTRAINT "project_shares_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_shares" ADD CONSTRAINT "project_shares_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_types" ADD CONSTRAINT "project_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_cases" ADD CONSTRAINT "quality_cases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_cases" ADD CONSTRAINT "quality_cases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_cases" ADD CONSTRAINT "quality_cases_task_id_wbs_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wbs_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_cases" ADD CONSTRAINT "quality_cases_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_cases" ADD CONSTRAINT "quality_cases_workflow_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wbs_tasks" ADD CONSTRAINT "wbs_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_calendars" ADD CONSTRAINT "work_calendars_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_workflow_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_step_id_workflow_instance_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_instance_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_workflow_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_task_id_wbs_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wbs_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_template_version_id_workflow_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."workflow_template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_main_deliverable_id_deliverables_id_fk" FOREIGN KEY ("main_deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_official_document_id_project_documents_id_fk" FOREIGN KEY ("official_document_id") REFERENCES "public"."project_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_versions" ADD CONSTRAINT "workflow_template_versions_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_template_versions" ADD CONSTRAINT "workflow_template_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_holidays_calendar_date_uq" ON "calendar_holidays" USING btree ("calendar_id","holiday_date");--> statement-breakpoint
CREATE UNIQUE INDEX "common_codes_version_uq" ON "common_codes" USING btree ("company_id","group_code","code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_code_uq" ON "companies" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "design_change_requests_company_number_uq" ON "design_change_requests" USING btree ("company_id","ecr_number");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_company_code_uq" ON "organizations" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_company_code_uq" ON "partners" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "project_baselines_project_version_uq" ON "project_baselines" USING btree ("project_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "project_role_catalog_company_code_uq" ON "project_role_catalog" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "project_roles_project_code_uq" ON "project_roles" USING btree ("project_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "project_types_company_code_uq" ON "project_types" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_company_code_uq" ON "projects" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "quality_cases_company_number_uq" ON "quality_cases" USING btree ("company_id","quality_number");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_company_code_uq" ON "roles" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_version_uq" ON "template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_company_code_uq" ON "templates" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_company_email_uq" ON "users" USING btree ("company_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "wbs_tasks_project_code_uq" ON "wbs_tasks" USING btree ("project_id","wbs_code");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_instance_steps_order_uq" ON "workflow_instance_steps" USING btree ("workflow_id","step_order");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_instances_company_number_uq" ON "workflow_instances" USING btree ("company_id","workflow_number");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_template_versions_template_version_uq" ON "workflow_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_templates_company_code_uq" ON "workflow_templates" USING btree ("company_id","code");