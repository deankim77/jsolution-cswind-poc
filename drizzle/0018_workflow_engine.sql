CREATE TABLE IF NOT EXISTS workflow_templates (
  id text PRIMARY KEY NOT NULL, company_id text NOT NULL, code text NOT NULL, name text NOT NULL,
  application_type text DEFAULT 'GENERAL' NOT NULL, description text, project_required integer DEFAULT 1 NOT NULL,
  task_link_mode text DEFAULT 'optional' NOT NULL, register_common_document integer DEFAULT 0 NOT NULL,
  document_category text, status text DEFAULT 'active' NOT NULL, current_version integer DEFAULT 1 NOT NULL,
  created_at integer NOT NULL, updated_at integer NOT NULL,
  FOREIGN KEY(company_id) REFERENCES companies(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_company_code_uq ON workflow_templates(company_id,code);

CREATE TABLE IF NOT EXISTS workflow_template_versions (
  id text PRIMARY KEY NOT NULL, template_id text NOT NULL, version integer NOT NULL, definition text NOT NULL,
  status text DEFAULT 'published' NOT NULL, published_at integer, created_by text NOT NULL,
  created_at integer NOT NULL, updated_at integer NOT NULL,
  FOREIGN KEY(template_id) REFERENCES workflow_templates(id), FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_template_versions_template_version_uq ON workflow_template_versions(template_id,version);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id text PRIMARY KEY NOT NULL, company_id text NOT NULL, project_id text NOT NULL, task_id text,
  template_id text NOT NULL, template_version_id text NOT NULL, workflow_number text NOT NULL,
  title text NOT NULL, request_content text, source_type text DEFAULT 'GENERAL' NOT NULL, source_id text,
  priority text DEFAULT 'normal' NOT NULL, due_date text, status text DEFAULT 'draft' NOT NULL,
  current_step_order integer DEFAULT 0 NOT NULL, requester_user_id text NOT NULL, main_deliverable_id text,
  official_document_id text, created_at integer NOT NULL, updated_at integer NOT NULL,
  FOREIGN KEY(company_id) REFERENCES companies(id), FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(task_id) REFERENCES wbs_tasks(id), FOREIGN KEY(template_id) REFERENCES workflow_templates(id),
  FOREIGN KEY(template_version_id) REFERENCES workflow_template_versions(id), FOREIGN KEY(requester_user_id) REFERENCES users(id),
  FOREIGN KEY(main_deliverable_id) REFERENCES deliverables(id), FOREIGN KEY(official_document_id) REFERENCES project_documents(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_instances_company_number_uq ON workflow_instances(company_id,workflow_number);
CREATE INDEX IF NOT EXISTS workflow_instances_project_status_idx ON workflow_instances(project_id,status,updated_at);

CREATE TABLE IF NOT EXISTS workflow_instance_steps (
  id text PRIMARY KEY NOT NULL, workflow_id text NOT NULL, step_order integer NOT NULL, name text NOT NULL,
  action_type text NOT NULL, role_code text, assignment_rule text, due_days integer DEFAULT 0 NOT NULL,
  comment_required integer DEFAULT 0 NOT NULL, attachment_required integer DEFAULT 0 NOT NULL,
  assignee_user_id text, status text DEFAULT 'waiting' NOT NULL, started_at integer, completed_at integer,
  comment text, created_at integer NOT NULL, updated_at integer NOT NULL,
  FOREIGN KEY(workflow_id) REFERENCES workflow_instances(id) ON DELETE CASCADE, FOREIGN KEY(assignee_user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_instance_steps_order_uq ON workflow_instance_steps(workflow_id,step_order);
CREATE INDEX IF NOT EXISTS workflow_instance_steps_assignee_idx ON workflow_instance_steps(assignee_user_id,status,updated_at);

CREATE TABLE IF NOT EXISTS workflow_history (
  id text PRIMARY KEY NOT NULL, workflow_id text NOT NULL, step_id text, actor_user_id text NOT NULL,
  action text NOT NULL, previous_status text, next_status text, comment text, attachments text,
  created_at integer NOT NULL,
  FOREIGN KEY(workflow_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
  FOREIGN KEY(step_id) REFERENCES workflow_instance_steps(id), FOREIGN KEY(actor_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS workflow_history_workflow_created_idx ON workflow_history(workflow_id,created_at);

CREATE TABLE IF NOT EXISTS design_change_requests (
  id text PRIMARY KEY NOT NULL, company_id text NOT NULL, project_id text NOT NULL, task_id text,
  ecr_number text NOT NULL, title text NOT NULL, change_target text, before_content text, after_content text,
  reason text, impact_content text, priority text DEFAULT 'normal' NOT NULL, requester_user_id text NOT NULL,
  requested_at integer NOT NULL, workflow_id text, status text DEFAULT 'draft' NOT NULL,
  created_at integer NOT NULL, updated_at integer NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(task_id) REFERENCES wbs_tasks(id),
  FOREIGN KEY(requester_user_id) REFERENCES users(id), FOREIGN KEY(workflow_id) REFERENCES workflow_instances(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS design_change_requests_company_number_uq ON design_change_requests(company_id,ecr_number);

CREATE TABLE IF NOT EXISTS quality_cases (
  id text PRIMARY KEY NOT NULL, company_id text NOT NULL, project_id text NOT NULL, task_id text,
  quality_number text NOT NULL, title text NOT NULL, occurred_on text, issue_type text, severity text DEFAULT 'medium' NOT NULL,
  description text, root_cause text, corrective_action text, effectiveness_check text, owner_user_id text,
  workflow_id text, status text DEFAULT 'draft' NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(task_id) REFERENCES wbs_tasks(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id), FOREIGN KEY(workflow_id) REFERENCES workflow_instances(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS quality_cases_company_number_uq ON quality_cases(company_id,quality_number);
