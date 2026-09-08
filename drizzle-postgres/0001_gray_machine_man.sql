CREATE TABLE "bom_edit_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"root_part_id" text NOT NULL,
	"locked_by" text NOT NULL,
	"locked_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_sheets" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"part_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"material_cost" double precision DEFAULT 0 NOT NULL,
	"labor_cost" double precision DEFAULT 0 NOT NULL,
	"overhead_cost" double precision DEFAULT 0 NOT NULL,
	"total_cost" double precision DEFAULT 0 NOT NULL,
	"note" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_number_history" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"part_id" text NOT NULL,
	"part_number" text NOT NULL,
	"rule_code" text NOT NULL,
	"created_by" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_bom_items" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"parent_part_id" text NOT NULL,
	"child_part_id" text NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'EA' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_parts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"part_number" text NOT NULL,
	"name" text NOT NULL,
	"part_type" text DEFAULT 'PART' NOT NULL,
	"spec" text,
	"unit" text DEFAULT 'EA' NOT NULL,
	"revision" text DEFAULT 'A' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"standard_cost" double precision DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bom_edit_locks_company_root_uq" ON "bom_edit_locks" USING btree ("company_id","root_part_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_sheets_part_version_uq" ON "cost_sheets" USING btree ("company_id","part_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "product_bom_parent_child_uq" ON "product_bom_items" USING btree ("company_id","parent_part_id","child_part_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_parts_company_number_uq" ON "product_parts" USING btree ("company_id","part_number");