CREATE TABLE production_data_assignments (
  company_id text NOT NULL,
  project_id text NOT NULL,
  record_id text NOT NULL,
  task_id text NOT NULL REFERENCES wbs_tasks(id) ON DELETE RESTRICT,
  confirmed_by text NOT NULL REFERENCES users(id),
  confirmed_at integer NOT NULL,
  PRIMARY KEY (record_id, task_id),
  FOREIGN KEY (company_id, project_id, record_id) REFERENCES customer_raw_data(company_id, project_id, id)
);
--> statement-breakpoint
CREATE INDEX production_assignments_project_idx ON production_data_assignments(company_id,project_id);
