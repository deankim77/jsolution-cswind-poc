CREATE INDEX IF NOT EXISTS project_issues_status_updated_idx
  ON project_issues(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS project_issues_project_updated_idx
  ON project_issues(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS project_issues_owner_due_idx
  ON project_issues(owner_user_id, due_date);
