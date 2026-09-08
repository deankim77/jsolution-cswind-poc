CREATE TABLE "bom_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"root_part_id" text NOT NULL,
	"revision_seq" integer NOT NULL,
	"revision" text NOT NULL,
	"structure_hash" text NOT NULL,
	"snapshot_json" text NOT NULL,
	"change_note" text,
	"created_by" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverable_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"deliverable_id" text NOT NULL,
	"version_id" text,
	"action" text NOT NULL,
	"note" text,
	"reviewed_by" text,
	"reviewed_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverable_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"deliverable_id" text NOT NULL,
	"task_id" text,
	"revision" integer NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"content_type" text,
	"note" text,
	"created_by" text,
	"created_at" integer NOT NULL,
	"deleted_at" integer,
	"deleted_by" text,
	"preview_file_key" text,
	"conversion_status" text,
	"conversion_error" text,
	"converted_at" integer
);
--> statement-breakpoint
CREATE TABLE "drawing_code_sequences" (
	"company_id" text NOT NULL,
	"issue_year" integer NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "drawing_code_sequences_company_id_issue_year_pk" PRIMARY KEY("company_id","issue_year")
);
--> statement-breakpoint
CREATE TABLE "issue_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"content_type" text,
	"created_by" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_category_links" (
	"company_id" text NOT NULL,
	"part_id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_cost_history" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"part_id" text NOT NULL,
	"target_cost" double precision DEFAULT 0 NOT NULL,
	"actual_cost" double precision DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_number_settings" (
	"company_id" text PRIMARY KEY NOT NULL,
	"prefix" text DEFAULT 'P' NOT NULL,
	"separator" text DEFAULT '-' NOT NULL,
	"digits" integer DEFAULT 6 NOT NULL,
	"next_sequence" integer DEFAULT 1 NOT NULL,
	"allow_manual" integer DEFAULT 1 NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_cost_bom_roots" (
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"root_part_id" text NOT NULL,
	"owner_user_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	CONSTRAINT "project_cost_bom_roots_project_id_root_part_id_pk" PRIMARY KEY("project_id","root_part_id")
);
--> statement-breakpoint
CREATE TABLE "project_cost_budgets" (
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"category_code" text NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"updated_by" text,
	"updated_at" integer NOT NULL,
	CONSTRAINT "project_cost_budgets_project_id_category_code_pk" PRIMARY KEY("project_id","category_code")
);
--> statement-breakpoint
CREATE TABLE "project_cost_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"group_code" text NOT NULL,
	"name" text NOT NULL,
	"source_type" text DEFAULT 'MANUAL' NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_cost_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"category_code" text NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"occurred_on" text NOT NULL,
	"vendor" text,
	"note" text,
	"created_by" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_cost_profiles" (
	"company_id" text NOT NULL,
	"project_id" text PRIMARY KEY NOT NULL,
	"bom_root_part_id" text,
	"updated_by" text,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_issue_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"action" text NOT NULL,
	"note" text,
	"actor_user_id" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_part_costs" (
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"part_id" text NOT NULL,
	"target_cost" double precision DEFAULT 0 NOT NULL,
	"actual_cost" double precision DEFAULT 0 NOT NULL,
	"updated_by" text,
	"updated_at" integer NOT NULL,
	"cost_mode" text DEFAULT 'AUTO' NOT NULL,
	CONSTRAINT "project_part_costs_project_id_part_id_pk" PRIMARY KEY("project_id","part_id")
);
--> statement-breakpoint
CREATE TABLE "system_seed_markers" (
	"company_id" text NOT NULL,
	"seed_key" text NOT NULL,
	"created_at" integer NOT NULL,
	CONSTRAINT "system_seed_markers_company_id_seed_key_pk" PRIMARY KEY("company_id","seed_key")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"company_id" text NOT NULL,
	"setting_key" text NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" integer NOT NULL,
	CONSTRAINT "system_settings_company_id_setting_key_pk" PRIMARY KEY("company_id","setting_key")
);
--> statement-breakpoint
CREATE TABLE "task_actuals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"actual_date" text NOT NULL,
	"actual_hours" double precision DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"work_note" text,
	"completed" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"project_id" text,
	"task_id" text,
	"event_key" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"due_date" text,
	"read_at" integer,
	"resolved_at" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instance_deliverables" (
	"workflow_id" text NOT NULL,
	"deliverable_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	CONSTRAINT "workflow_instance_deliverables_workflow_id_deliverable_id_pk" PRIMARY KEY("workflow_id","deliverable_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_source_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"project_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"content_type" text,
	"created_by" text NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_step_document_rules" (
	"step_id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"document_action" text DEFAULT 'NONE' NOT NULL,
	"document_required" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_step_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"step_id" text NOT NULL,
	"deliverable_id" text NOT NULL,
	"version_id" text NOT NULL,
	"document_action" text NOT NULL,
	"change_reason" text,
	"created_by" text NOT NULL,
	"created_at" integer NOT NULL
);
