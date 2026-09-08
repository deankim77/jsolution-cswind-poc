CREATE TABLE IF NOT EXISTS task_completion_reviews (
  id text PRIMARY KEY NOT NULL,
  project_id text NOT NULL,
  task_id text NOT NULL,
  action text NOT NULL,
  note text,
  reviewed_by text NOT NULL,
  reviewed_at integer NOT NULL
);

CREATE INDEX IF NOT EXISTS task_completion_reviews_project_task_idx
  ON task_completion_reviews(project_id,task_id,reviewed_at);
