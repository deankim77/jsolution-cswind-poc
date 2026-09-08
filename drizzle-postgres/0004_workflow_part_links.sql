CREATE TABLE IF NOT EXISTS "workflow_source_part_links" (
  "company_id" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "part_id" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  CONSTRAINT "workflow_source_part_links_company_id_source_type_source_id_part_id_pk" PRIMARY KEY("company_id","source_type","source_id","part_id"),
  CONSTRAINT "workflow_source_part_links_part_id_product_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."product_parts"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_source_part_links_source_idx" ON "workflow_source_part_links" USING btree ("company_id","source_type","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_source_part_links_part_idx" ON "workflow_source_part_links" USING btree ("company_id","part_id");
