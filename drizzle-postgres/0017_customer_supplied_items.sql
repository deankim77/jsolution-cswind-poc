CREATE TABLE customer_supplied_items (
 id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL REFERENCES projects(id),
 section text NOT NULL, item_number text NOT NULL, description text NOT NULL, quantity double precision NOT NULL CHECK (quantity >= 0),
 status text NOT NULL, change text NOT NULL, change_text text NOT NULL, record_id text NOT NULL, version integer NOT NULL,
 item_id text NOT NULL, source_order integer NOT NULL, bom_record_id text, parent_part_id text, part_id text, bom_applied boolean NOT NULL DEFAULT false,
 confirmed_by text NOT NULL, confirmed_at integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX customer_supplied_item_uq ON customer_supplied_items(company_id,project_id,section,item_number);
