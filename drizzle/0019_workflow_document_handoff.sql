CREATE TABLE IF NOT EXISTS workflow_step_document_rules (
  step_id text PRIMARY KEY NOT NULL,
  workflow_id text NOT NULL,
  document_action text DEFAULT 'NONE' NOT NULL,
  document_required integer DEFAULT 0 NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS workflow_step_document_rules_workflow_idx ON workflow_step_document_rules(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_step_documents (
  id text PRIMARY KEY NOT NULL,
  workflow_id text NOT NULL,
  step_id text NOT NULL,
  deliverable_id text NOT NULL,
  version_id text NOT NULL,
  document_action text NOT NULL,
  change_reason text,
  created_by text NOT NULL,
  created_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS workflow_step_documents_workflow_step_idx ON workflow_step_documents(workflow_id,step_id,created_at);
