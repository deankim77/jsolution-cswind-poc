ALTER TABLE "ai_conversations" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "drawing_code" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "drawing_company_id" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "drawing_type" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "internal_drawing_number" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "customer_drawing_number" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "owner_department" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "design_change_requests" ADD COLUMN "drawing_id" text;--> statement-breakpoint
ALTER TABLE "design_change_requests" ADD COLUMN "change_type" text;--> statement-breakpoint
ALTER TABLE "product_parts" ADD COLUMN "actual_cost" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_issues" ADD COLUMN "created_by" text;