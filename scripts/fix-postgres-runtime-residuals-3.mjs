import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const changed=[];
function patch(rel,transforms){const file=path.join(root,rel);let text=fs.readFileSync(file,"utf8"),before=text;for(const fn of transforms)text=fn(text);if(text!==before){fs.writeFileSync(file,text,"utf8");changed.push(rel)}}
const replace=(from,to)=>text=>text.replace(from,to);

// PostgreSQL: DISTINCT queries cannot ORDER BY a non-selected expression.
patch("app/api/workflows/route.ts",[
  replace(
    "SELECT DISTINCT p.id,p.code,p.name FROM projects p LEFT JOIN project_members m ON m.project_id=p.id WHERE p.company_id=? AND (m.user_id=? OR EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.code IN ('SUPER_ADMIN','ADMIN','SYSTEM_ADMIN'))) ORDER BY p.updated_at DESC",
    "SELECT p.id,p.code,p.name FROM projects p WHERE p.company_id=? AND (EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=?) OR EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.code IN ('SUPER_ADMIN','ADMIN','SYSTEM_ADMIN'))) ORDER BY p.updated_at DESC"
  ),
]);

// SQLite julianday -> PostgreSQL date subtraction.
patch("app/api/projects/[projectId]/baseline/route.ts",[
  replace(
    "CAST(julianday(w.planned_end)-julianday(b.planned_end) AS integer) AS delayDays",
    "CASE WHEN w.planned_end IS NOT NULL AND b.planned_end IS NOT NULL THEN (w.planned_end::date-b.planned_end::date) ELSE NULL END AS delayDays"
  ),
]);

// PostgreSQL has no rowid.
patch("app/api/projects/[projectId]/gates/route.ts",[
  replace("ORDER BY d2.decided_at DESC,d2.rowid DESC LIMIT 1","ORDER BY d2.decided_at DESC,d2.id DESC LIMIT 1"),
]);

// Node runtime: database uses PostgreSQL. File storage remains optional until the Storage Adapter is connected.
patch("app/api/projects/[projectId]/issues/route.ts",[
  text=>text.includes('postgres-d1-compat')?text:text.replace(
    'import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";',
    'import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";\nimport {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";'
  ),
  text=>text.replace(/async function runtime\(\)\{const runtime=await import\("cloudflare:workers"\);return runtime\.env as unknown as \{DB:D1;FILES\?:R2Bucket\};\}/,
    'async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:undefined as R2Bucket|undefined};}'),
  // Schema is migration-owned in PostgreSQL; do not run request-time DDL.
  text=>text.replace(/function ensureTables\(db:D1\)\{const key=db as object,existing=issueSchemaReadyByDb\.get\(key\);if\(existing\)return existing;const ready=ensureTablesImpl\(db\)\.catch\(reason=>\{issueSchemaReadyByDb\.delete\(key\);throw reason\}\);issueSchemaReadyByDb\.set\(key,ready\);return ready;\}/,
    'async function ensureTables(_db:D1){return;}'),
]);

patch("app/api/projects/[projectId]/deliverables/route.ts",[
  text=>text.includes('postgres-d1-compat')?text:text.replace(
    'import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";',
    'import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";\nimport {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";'
  ),
  text=>text.replace(/async function runtime\(\)\{const runtime=await import\("cloudflare:workers"\);return runtime\.env as unknown as \{DB:D1;FILES\?:R2Bucket;DWG_CONVERTER_URL\?:string;DWG_CONVERTER_TOKEN\?:string\};\}/,
    'async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:undefined as R2Bucket|undefined,DWG_CONVERTER_URL:process.env.DWG_CONVERTER_URL,DWG_CONVERTER_TOKEN:process.env.DWG_CONVERTER_TOKEN};}'),
  // Schema is migration-owned in PostgreSQL; avoid request-time CREATE/ALTER/INDEX races.
  text=>text.replace(/const ensureTablesOnce=\(db:D1\)=>tablesReady\?\?=\(ensureTables\(db\)\.catch\(reason=>\{tablesReady=null;throw reason\}\)\);/,
    'const ensureTablesOnce=async(_db:D1)=>{};'),
]);

// Cost tables and indexes are migration-owned. Removing request-time DDL also prevents concurrent CREATE INDEX races.
patch("app/api/project-costs/bom-cost-data/route.ts",[
  text=>text.replace(/async function ensureTables\(db:D1\)\{[\s\S]*?\n\}/,
    'async function ensureTables(_db:D1){return;}'),
]);

console.log(`Final PostgreSQL runtime residual patch complete: ${changed.length} file(s) changed.`);
for(const file of changed)console.log(` - ${file}`);
if(!changed.length)console.log("No changes needed; patch is already applied.");
