CREATE TABLE trr_versions (
 id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL,
 version integer NOT NULL CHECK (version > 0), fingerprint text NOT NULL,
 summary text NOT NULL, document jsonb NOT NULL, file_key text NOT NULL,
 created_by text NOT NULL, created_at integer NOT NULL,
 FOREIGN KEY (project_id) REFERENCES projects(id),
 CONSTRAINT trr_version_scope_uq UNIQUE(company_id,project_id,version),
 CONSTRAINT trr_fingerprint_scope_uq UNIQUE(company_id,project_id,fingerprint)
);
--> statement-breakpoint
CREATE TABLE trr_jobs (
 id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','failed')),
 token text, error text, updated_at integer NOT NULL,
 FOREIGN KEY (project_id) REFERENCES projects(id),
 CONSTRAINT trr_job_scope_uq UNIQUE(company_id,project_id)
);
