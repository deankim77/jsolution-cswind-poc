import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["app", "db", "lib"];
const changed = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function importPathFor(file) {
  const target = path.join(root, "db", "postgres-d1-compat");
  let relative = path.relative(path.dirname(file), target).replaceAll("\\", "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

function ensureCompatImport(source, file) {
  if (!source.includes("getLegacyDbCompat(")) return source;
  if (/import\s*\{[^}]*\bgetLegacyDbCompat\b[^}]*\}\s*from\s*["'][^"']*postgres-d1-compat["'];?/.test(source)) return source;
  return `import { getLegacyDbCompat } from "${importPathFor(file)}";\n${source}`;
}

for (const file of roots.flatMap(name => walk(path.join(root, name)))) {
  if (file.endsWith(path.join("db", "postgres-d1-compat.ts"))) continue;
  let source = fs.readFileSync(file, "utf8");
  const before = source;

  source = source.replace(/\bruntime\.env\.DB\b/g, "getLegacyDbCompat()");
  source = source.replace(/\benv\.DB\b/g, "getLegacyDbCompat()");
  source = source.replace(/\((?:await\s+)?import\(["']cloudflare:workers["']\)\)\.env\.DB/g, "getLegacyDbCompat()");

  if (!/\bruntime\./.test(source)) {
    source = source.replace(/\s*const\s+runtime\s*=\s*await\s+import\(["']cloudflare:workers["']\);?/g, "");
  }

  source = ensureCompatImport(source, file);

  if (!/\benv\./.test(source)) {
    source = source.replace(/^import\s*\{\s*env\s*\}\s*from\s*["']cloudflare:workers["'];?\s*\r?\n/m, "");
  }

  if (source !== before) {
    fs.writeFileSync(file, source, "utf8");
    changed.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}

// Harden the shared SQLite -> PostgreSQL SQL translator.
const compatPath = path.join(root, "db", "postgres-d1-compat.ts");
let compat = fs.readFileSync(compatPath, "utf8");
const compatBefore = compat;
const compatBlock = `  // GROUP_CONCAT compatibility: SQLite -> PostgreSQL string_agg.\n  // Handles DISTINCT, explicit separator, and the default comma separator.\n  sql = sql.replace(/GROUP_CONCAT\\(\\s*DISTINCT\\s+([^,()]+)\\s*\\)/gi, "string_agg(DISTINCT ($1)::text, ',')");\n  sql = sql.replace(/GROUP_CONCAT\\(\\s*([^,()]+)\\s*,\\s*'([^']*)'\\s*\\)/gi, "string_agg(($1)::text, '$2')");\n  sql = sql.replace(/GROUP_CONCAT\\(\\s*([^,()]+)\\s*\\)/gi, "string_agg(($1)::text, ',')");\n\n  // SQLite date('now') returns YYYY-MM-DD text; preserve that comparison behavior.\n  sql = sql.replace(/date\\(\\s*'now'\\s*\\)/gi, "CURRENT_DATE::text");\n`;
if (/  \/\/ GROUP_CONCAT compatibility:[\s\S]*?sql = sql\.replace\(\/date\\\\\([\s\S]*?\);\n/.test(compat)) {
  compat = compat.replace(/  \/\/ GROUP_CONCAT compatibility:[\s\S]*?sql = sql\.replace\(\/date\\\\\([\s\S]*?\);\n/, compatBlock);
} else if (!compat.includes("GROUP_CONCAT compatibility")) {
  compat = compat.replace(/(\s*sql = sql\.replace\(\/json_extract[\s\S]*?;\n)(\s*return sql;)/, `$1\n${compatBlock}$2`);
}
if (compat !== compatBefore) {
  fs.writeFileSync(compatPath, compat, "utf8");
  changed.push("db/postgres-d1-compat.ts");
}

// PostgreSQL is strict about GROUP BY. Replace the SQLite-style aggregate join
// in the project list with a correlated member-count subquery and remove GROUP BY.
const projectsPath = path.join(root, "app", "api", "projects", "route.ts");
if (fs.existsSync(projectsPath)) {
  let source = fs.readFileSync(projectsPath, "utf8");
  const before = source;
  source = source.replace(
    /COUNT\(pm\.user_id\) AS memberCount,/g,
    "(SELECT COUNT(*) FROM project_members pmc WHERE pmc.project_id=p.id) AS memberCount,",
  );
  source = source.replace(/\s*LEFT JOIN project_members pm ON pm\.project_id = p\.id/g, "");
  source = source.replace(/\s*GROUP BY p\.id/g, "");
  // All these objects are migration-owned in PostgreSQL.
  source = source.replace(
    /function ensureProjectMasterLinks\(db:D1\)\{[\s\S]*?return ready\}/,
    "function ensureProjectMasterLinks(_db:D1){return Promise.resolve()}",
  );
  if (source !== before) {
    fs.writeFileSync(projectsPath, source, "utf8");
    changed.push("app/api/projects/route.ts");
  }
}

// ECR compatibility columns are now migration-owned as well.
const ecrPath = path.join(root, "app", "api", "ecr", "route.ts");
if (fs.existsSync(ecrPath)) {
  let source = fs.readFileSync(ecrPath, "utf8");
  const before = source;
  source = source.replace(
    /async function ensureEcrDrawingCompatibility\(db:any\)\{[\s\S]*?\}\nasync function drawingFor/,
    "async function ensureEcrDrawingCompatibility(_db:any){return}\nasync function drawingFor",
  );
  if (source !== before) {
    fs.writeFileSync(ecrPath, source, "utf8");
    changed.push("app/api/ecr/route.ts");
  }
}

const notificationPath = path.join(root, "app", "api", "notifications", "notification-service.ts");
if (fs.existsSync(notificationPath)) {
  let source = fs.readFileSync(notificationPath, "utf8");
  const before = source;
  source = source.replace(/w\.planned_end<date\('now'\)/g, "w.planned_end < CURRENT_DATE::text");
  if (source !== before) {
    fs.writeFileSync(notificationPath, source, "utf8");
    changed.push("app/api/notifications/notification-service.ts");
  }
}

console.log(`Node/PostgreSQL compatibility patch complete: ${changed.length} file(s) changed.`);
for (const file of [...new Set(changed)]) console.log(`  ${file}`);
