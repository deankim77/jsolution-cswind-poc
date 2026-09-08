CREATE INDEX IF NOT EXISTS idx_wbs_tasks_my_work_assignee
  ON wbs_tasks (assignee_user_id, kind, status, planned_end);

CREATE INDEX IF NOT EXISTS idx_wbs_tasks_my_work_project
  ON wbs_tasks (project_id, kind, status, planned_end);

CREATE INDEX IF NOT EXISTS idx_project_members_my_work_reviewer
  ON project_members (user_id, project_id, project_role);

CREATE INDEX IF NOT EXISTS idx_deliverables_task_id
  ON deliverables (task_id);

CREATE INDEX IF NOT EXISTS idx_project_issues_task_status
  ON project_issues (task_id, status);
