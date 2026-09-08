-- CS WIND POC only. Preserve all existing project types and project assignments.
INSERT INTO project_types (id, company_id, code, name, description, status, created_at, updated_at)
SELECT 'cswind-type-' || md5(c.id || ':' || v.code), c.id, v.code, v.name, v.description,
       'active', extract(epoch from now())::integer, extract(epoch from now())::integer
FROM companies c CROSS JOIN (VALUES
  ('R_AND_D', 'R&D', '연구개발 프로젝트'),
  ('PRODUCTION', 'Production', '생산 프로젝트 · 고객 원본 및 검토 데이터 관리')
) AS v(code, name, description)
ON CONFLICT (company_id, code) DO NOTHING;
--> statement-breakpoint
CREATE TABLE customer_raw_data (
  id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  raw_data_id text NOT NULL, revision integer NOT NULL,
  title text NOT NULL, document_type text NOT NULL, impact_target text NOT NULL,
  file_key text NOT NULL, file_name text NOT NULL, file_size integer NOT NULL, checksum text NOT NULL, note text,
  analysis_status text NOT NULL DEFAULT 'not_requested', review_status text NOT NULL DEFAULT 'pending',
  applied_status text NOT NULL DEFAULT 'not_applied', created_by text NOT NULL REFERENCES users(id), created_at integer NOT NULL,
  reviewed_by text REFERENCES users(id), reviewed_at integer,
  CONSTRAINT customer_raw_data_revision_ck CHECK (revision > 0),
  CONSTRAINT customer_raw_data_size_ck CHECK (file_size > 0 AND file_size <= 52428800),
  CONSTRAINT customer_raw_data_type_ck CHECK (document_type IN ('drawing','specification','bom','requirement','report','other')),
  CONSTRAINT customer_raw_data_impact_ck CHECK (impact_target IN ('unclassified','pbom','requirement','process','multiple')),
  CONSTRAINT customer_raw_data_analysis_ck CHECK (analysis_status = 'not_requested'),
  CONSTRAINT customer_raw_data_applied_ck CHECK (applied_status = 'not_applied'),
  CONSTRAINT customer_raw_data_review_ck CHECK (
    (review_status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
    (review_status = 'reviewed' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX customer_raw_data_revision_uq ON customer_raw_data(project_id, raw_data_id, revision);
CREATE UNIQUE INDEX customer_raw_data_scope_uq ON customer_raw_data(company_id, project_id, id);
CREATE INDEX customer_raw_data_project_idx ON customer_raw_data(company_id, project_id, created_at);
--> statement-breakpoint
CREATE TABLE customer_raw_data_relations (
  id text PRIMARY KEY, company_id text NOT NULL, project_id text NOT NULL,
  source_id text NOT NULL, target_id text NOT NULL, relation_type text NOT NULL,
  created_by text NOT NULL REFERENCES users(id), created_at integer NOT NULL,
  CONSTRAINT customer_relation_source_fk FOREIGN KEY (company_id, project_id, source_id) REFERENCES customer_raw_data(company_id, project_id, id),
  CONSTRAINT customer_relation_target_fk FOREIGN KEY (company_id, project_id, target_id) REFERENCES customer_raw_data(company_id, project_id, id),
  CONSTRAINT customer_relation_self_ck CHECK (source_id <> target_id),
  CONSTRAINT customer_relation_type_ck CHECK (relation_type IN ('references','supersedes'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX customer_relation_uq ON customer_raw_data_relations(source_id, target_id, relation_type);
CREATE INDEX customer_relation_project_idx ON customer_raw_data_relations(company_id, project_id);
