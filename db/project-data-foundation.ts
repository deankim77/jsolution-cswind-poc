/* eslint-disable @typescript-eslint/no-explicit-any */

export type RuntimeD1 = {
  prepare: (sql: string) => any;
  batch: (statements: any[]) => Promise<unknown>;
};

const foundationReadyByDb=new WeakMap<object,Promise<void>>();
const REQUIRED_TABLES=["companies","organizations","users","templates","template_versions","projects","project_members","audit_logs","project_roles","wbs_tasks","deliverables","work_calendars","calendar_holidays","partner_profiles","project_role_catalog","project_profiles","project_shares","saved_filters","workspace_tabs"];

async function hasCurrentFoundation(db:RuntimeD1){
  try{
    const marks=REQUIRED_TABLES.map(()=>"?").join(",");
    const row=await db.prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name IN (${marks})`).bind(...REQUIRED_TABLES).first() as {count?:number}|null;
    if(Number(row?.count)!==REQUIRED_TABLES.length)return false;
    await db.prepare("SELECT partner_id,project_type_id FROM projects LIMIT 0").all();
    await db.prepare("SELECT document_kind FROM deliverables LIMIT 0").all();
    return true;
  }catch{return false}
}

/**
 * Keeps older local/hosted databases compatible with the project-data rollout.
 * The checked-in Drizzle migration remains the source of truth. Healthy databases
 * take the cheap schema probe; the compatibility DDL only runs when something is missing.
 */
export function ensureProjectDataFoundation(_db: RuntimeD1) {
  // PostgreSQL schema is migration-owned. Runtime DDL is intentionally disabled.
  return Promise.resolve();
}

async function ensureProjectDataFoundationImpl(db: RuntimeD1) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS companies (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      code text NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS companies_code_uq ON companies (code)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS organizations (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      parent_id text,
      name text NOT NULL,
      code text NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS organizations_company_code_uq ON organizations (company_id, code)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      organization_id text,
      email text NOT NULL,
      name text NOT NULL,
      status text DEFAULT 'invited' NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_company_email_uq ON users (company_id, email)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS templates (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      code text NOT NULL,
      name text NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS templates_company_code_uq ON templates (company_id, code)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS template_versions (
      id text PRIMARY KEY NOT NULL,
      template_id text NOT NULL,
      version text NOT NULL,
      definition text NOT NULL,
      published_at integer,
      created_by text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (template_id) REFERENCES templates(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS template_versions_template_version_uq ON template_versions (template_id, version)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      template_version_id text NOT NULL,
      code text NOT NULL,
      name text NOT NULL,
      customer_name text,
      start_date text NOT NULL,
      end_date text NOT NULL,
      status text DEFAULT 'preparing' NOT NULL,
      template_snapshot text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (template_version_id) REFERENCES template_versions(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS projects_company_code_uq ON projects (company_id, code)"),
    db.prepare("CREATE INDEX IF NOT EXISTS projects_company_status_updated_idx ON projects (company_id,status,updated_at DESC)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_members (
      project_id text NOT NULL,
      user_id text NOT NULL,
      project_role text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS project_members_user_project_idx ON project_members (user_id,project_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      actor_user_id text,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      detail text,
      created_at integer NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_roles (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL,
      code text NOT NULL,
      name text NOT NULL,
      sort_order integer DEFAULT 0 NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS project_roles_project_code_uq ON project_roles (project_id, code)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS wbs_tasks (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL,
      wbs_code text NOT NULL,
      parent_id text,
      level integer NOT NULL,
      sort_order integer NOT NULL,
      kind text DEFAULT 'task' NOT NULL,
      name text NOT NULL,
      task_type text DEFAULT 'normal' NOT NULL,
      duration_days integer DEFAULT 1 NOT NULL,
      planned_start text,
      planned_end text,
      predecessor_id text,
      role_code text,
      assignee_user_id text,
      progress integer DEFAULT 0 NOT NULL,
      status text DEFAULT 'planned' NOT NULL,
      completion_actor text DEFAULT 'assignee' NOT NULL,
      completion_criteria text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS wbs_tasks_project_code_uq ON wbs_tasks (project_id, wbs_code)"),
    db.prepare("CREATE INDEX IF NOT EXISTS wbs_tasks_project_kind_status_idx ON wbs_tasks (project_id,kind,status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS wbs_tasks_assignee_status_end_idx ON wbs_tasks (assignee_user_id,status,planned_end)"),
    db.prepare("CREATE INDEX IF NOT EXISTS wbs_tasks_project_parent_idx ON wbs_tasks (project_id,parent_id,sort_order)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS deliverables (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL,
      task_id text,
      name text NOT NULL,
      category text,
      required integer DEFAULT 1 NOT NULL,
      status text DEFAULT 'planned' NOT NULL,
      file_key text,
      version text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (task_id) REFERENCES wbs_tasks(id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS deliverables_project_status_idx ON deliverables (project_id,status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS deliverables_task_status_idx ON deliverables (task_id,status)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS work_calendars (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      name text NOT NULL,
      timezone text DEFAULT 'Asia/Seoul' NOT NULL,
      working_days text NOT NULL,
      is_default integer DEFAULT 0 NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS work_calendars_company_default_uq ON work_calendars (company_id, is_default) WHERE is_default = 1"),
    db.prepare(`CREATE TABLE IF NOT EXISTS calendar_holidays (
      id text PRIMARY KEY NOT NULL,
      calendar_id text NOT NULL,
      holiday_date text NOT NULL,
      name text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (calendar_id) REFERENCES work_calendars(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS calendar_holidays_calendar_date_uq ON calendar_holidays (calendar_id, holiday_date)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS partner_profiles (partner_id text PRIMARY KEY NOT NULL,english_name text,country text,industry text,representative_name text,business_registration_number text,address text,main_phone text,extra text,note text,updated_at integer NOT NULL,FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_role_catalog (id text PRIMARY KEY NOT NULL,company_id text NOT NULL,code text NOT NULL,name text NOT NULL,group_name text NOT NULL,required integer DEFAULT 0 NOT NULL,enabled integer DEFAULT 1 NOT NULL,sort_order integer DEFAULT 0 NOT NULL,created_at integer NOT NULL,updated_at integer NOT NULL,FOREIGN KEY(company_id) REFERENCES companies(id))`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS project_role_catalog_company_code_uq ON project_role_catalog (company_id,code)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_profiles (project_id text PRIMARY KEY NOT NULL,description text,reference_code text,visibility text DEFAULT 'company' NOT NULL,updated_at integer NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_shares (project_id text NOT NULL,organization_id text NOT NULL,created_at integer NOT NULL,PRIMARY KEY(project_id,organization_id),FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,FOREIGN KEY(organization_id) REFERENCES organizations(id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS saved_filters (id text PRIMARY KEY NOT NULL,company_id text NOT NULL,user_id text NOT NULL,workspace text NOT NULL,name text NOT NULL,definition text NOT NULL,is_default integer DEFAULT 0 NOT NULL,created_at integer NOT NULL,updated_at integer NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS saved_filters_user_workspace_idx ON saved_filters (company_id,user_id,workspace)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS workspace_tabs (user_id text NOT NULL,tab_id text NOT NULL,workspace text NOT NULL,title text NOT NULL,context text NOT NULL,sort_order integer DEFAULT 0 NOT NULL,is_active integer DEFAULT 0 NOT NULL,updated_at integer NOT NULL,PRIMARY KEY(user_id,tab_id))`),
  ]);
  try { await db.prepare("ALTER TABLE deliverables ADD COLUMN document_kind TEXT NOT NULL DEFAULT 'document'").run(); } catch {}
}
