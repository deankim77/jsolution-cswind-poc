CREATE TABLE production_bulk_locks (
 token text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL,
 area text NOT NULL CHECK (area IN ('pbom','extract')), owner text NOT NULL,
 created_at integer NOT NULL, fingerprint text NOT NULL, bom_lock_ids jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX production_bulk_scope_uq ON production_bulk_locks(company_id,project_id,area);
