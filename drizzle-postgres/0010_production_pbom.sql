CREATE TABLE production_bom_roots (
 project_id text PRIMARY KEY REFERENCES projects(id), company_id text NOT NULL,
 root_part_id text NOT NULL REFERENCES product_parts(id), created_at integer NOT NULL
);
CREATE UNIQUE INDEX production_bom_roots_part_uq ON production_bom_roots(root_part_id);
--> statement-breakpoint
CREATE TABLE customer_part_identities (
 id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL REFERENCES projects(id),
 customer_key text NOT NULL, part_id text NOT NULL REFERENCES product_parts(id), revision text NOT NULL
);
CREATE UNIQUE INDEX customer_part_identity_uq ON customer_part_identities(company_id,project_id,customer_key);
--> statement-breakpoint
CREATE TABLE customer_bom_occurrences (
 id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL REFERENCES projects(id),
 record_id text NOT NULL REFERENCES customer_raw_data(id), version integer NOT NULL, item_id text NOT NULL,
 bom_item_id text NOT NULL REFERENCES product_bom_items(id) ON DELETE CASCADE, fact jsonb NOT NULL,
 source text NOT NULL, confirmed_by text NOT NULL, confirmed_at integer NOT NULL
);
CREATE UNIQUE INDEX customer_bom_occurrence_uq ON customer_bom_occurrences(record_id,item_id);

--> statement-breakpoint
ALTER TABLE customer_raw_data ADD COLUMN intake_group text NOT NULL DEFAULT 'unclassified';
ALTER TABLE customer_raw_data ADD COLUMN source_purpose text NOT NULL DEFAULT 'input';
ALTER TABLE customer_raw_data ADD CONSTRAINT customer_raw_data_intake_ck CHECK (intake_group IN ('unclassified','a_bt','a_wt','a_im','a_common','b_initial','b_change','b_missing','b_parts','common'));
ALTER TABLE customer_raw_data ADD CONSTRAINT customer_raw_data_purpose_ck CHECK (source_purpose IN ('input','template','example'));
