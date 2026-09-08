CREATE TABLE IF NOT EXISTS "workflow_source_drawing_links" (
  "company_id" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "drawing_id" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  CONSTRAINT "workflow_source_drawing_links_company_id_source_type_source_id_drawing_id_pk" PRIMARY KEY("company_id","source_type","source_id","drawing_id"),
  CONSTRAINT "workflow_source_drawing_links_drawing_id_deliverables_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."deliverables"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_source_drawing_links_source_idx" ON "workflow_source_drawing_links" USING btree ("company_id","source_type","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_source_drawing_links_drawing_idx" ON "workflow_source_drawing_links" USING btree ("company_id","drawing_id");
