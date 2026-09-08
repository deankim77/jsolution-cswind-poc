import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();

if (!process.argv.includes("--replace")) {
  console.error("Refusing to modify PostgreSQL without --replace.");
  console.error("Run: node scripts/migrate-d1-data-to-postgres.mjs --replace");
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") process.loadEnvFile(envPath);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const defaultSqlite = path.join(
  root,
  ".wrangler",
  "state",
  "v3",
  "d1",
  "miniflare-D1DatabaseObject",
  "faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite",
);
const sqlitePath = process.env.D1_SOURCE_DB || defaultSqlite;
if (!fs.existsSync(sqlitePath)) throw new Error(`D1 source database not found: ${sqlitePath}`);

const python = String.raw`
import sqlite3, json, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
p=sys.argv[1]
con=sqlite3.connect('file:'+p+'?mode=ro', uri=True)
con.row_factory=sqlite3.Row
cur=con.cursor()
tables=[r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_cf_METADATA' ORDER BY name")]
out={"tables":{}}
for t in tables:
    cols=[r[1] for r in cur.execute('PRAGMA table_info("'+t.replace('"','""')+'")')]
    rows=[]
    q='SELECT * FROM "'+t.replace('"','""')+'"'
    for row in cur.execute(q):
        rows.append({k: row[k] for k in row.keys()})
    out["tables"][t]={"columns":cols,"rows":rows}
print(json.dumps(out, ensure_ascii=False, separators=(',',':')))
con.close()
`;

const py = spawnSync("python", ["-c", python, sqlitePath], {
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
  env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
});
if (py.status !== 0) throw new Error(`Failed to read D1 with Python:\n${py.stderr || py.stdout}`);
const source = JSON.parse(py.stdout);
const sourceTables = source.tables ?? {};

for (const required of ["companies", "users", "projects", "wbs_tasks"]) {
  const count = sourceTables[required]?.rows?.length ?? 0;
  if (!count) throw new Error(`Safety check failed: source table ${required} is empty or missing.`);
}

function qident(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function toPgValue(value, dataType, udtName) {
  if (value === null || value === undefined) return null;
  if (dataType === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const v = String(value).toLowerCase();
    return v === "1" || v === "true" || v === "t" || v === "yes";
  }
  if (dataType === "timestamp with time zone" || dataType === "timestamp without time zone") {
    if (value instanceof Date) return value;
    if (typeof value === "number") {
      const millis = Math.abs(value) < 100000000000 ? value * 1000 : value;
      return new Date(millis);
    }
    return value;
  }
  if (dataType === "json" || dataType === "jsonb" || udtName === "json" || udtName === "jsonb") {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const migrationCount = await client.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations");
  if ((migrationCount.rows[0]?.count ?? 0) < 3) throw new Error("PostgreSQL schema migrations 0000-0002 must be applied first.");

  const tableRows = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `);
  const targetTableSet = new Set(tableRows.rows.map(r => r.table_name));
  if (targetTableSet.size < 69) throw new Error(`Expected at least 69 PostgreSQL public tables, found ${targetTableSet.size}.`);

  const sourceNames = Object.keys(sourceTables).filter(t => targetTableSet.has(t));
  const missingTargets = Object.keys(sourceTables).filter(t => !targetTableSet.has(t));
  if (missingTargets.length) throw new Error(`Source tables missing in PostgreSQL: ${missingTargets.join(", ")}`);

  const columnsResult = await client.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
    FROM information_schema.columns
    WHERE table_schema='public'
    ORDER BY table_name, ordinal_position
  `);
  const targetColumns = new Map();
  for (const row of columnsResult.rows) {
    if (!targetColumns.has(row.table_name)) targetColumns.set(row.table_name, []);
    targetColumns.get(row.table_name).push(row);
  }

  const columnMismatches = [];
  for (const table of sourceNames) {
    const sourceCols = new Set(sourceTables[table].columns);
    const targetCols = new Set((targetColumns.get(table) ?? []).map(c => c.column_name));
    const sourceOnly = [...sourceCols].filter(c => !targetCols.has(c));
    if (sourceOnly.length) columnMismatches.push({ table, columns: sourceOnly });
  }
  if (columnMismatches.length) {
    console.error("D1 columns missing from PostgreSQL:");
    for (const item of columnMismatches) console.error(`  ${item.table}: ${item.columns.join(", ")}`);
    throw new Error(`Column mismatch detected in ${columnMismatches.length} table(s). No PostgreSQL data was modified.`);
  }

  const fkResult = await client.query(`
    SELECT child.relname AS child_table, parent.relname AS parent_table
    FROM pg_constraint c
    JOIN pg_class child ON child.oid=c.conrelid
    JOIN pg_namespace ns ON ns.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=c.confrelid
    WHERE c.contype='f' AND ns.nspname='public'
  `);
  const deps = new Map(sourceNames.map(t => [t, new Set()]));
  for (const row of fkResult.rows) {
    if (deps.has(row.child_table) && deps.has(row.parent_table) && row.child_table !== row.parent_table) {
      deps.get(row.child_table).add(row.parent_table);
    }
  }
  const order = [];
  const remaining = new Set(sourceNames);
  while (remaining.size) {
    const ready = [...remaining].filter(t => [...deps.get(t)].every(d => !remaining.has(d))).sort();
    if (!ready.length) throw new Error(`Foreign-key dependency cycle detected among: ${[...remaining].join(", ")}`);
    for (const t of ready) { order.push(t); remaining.delete(t); }
  }

  console.log(`D1 source: ${sqlitePath}`);
  console.log(`Source business tables: ${Object.keys(sourceTables).length}`);
  console.log(`PostgreSQL public tables: ${targetTableSet.size}`);
  console.log(`Tables to copy: ${sourceNames.length}`);

  await client.query("BEGIN");
  try {
    const truncateTargets = [...targetTableSet].sort().map(qident).join(", ");
    await client.query(`TRUNCATE TABLE ${truncateTargets} RESTART IDENTITY CASCADE`);

    let total = 0;
    const report = [];
    for (const table of order) {
      const rows = sourceTables[table].rows;
      const pgCols = targetColumns.get(table) ?? [];
      const pgColMap = new Map(pgCols.map(c => [c.column_name, c]));
      const cols = sourceTables[table].columns.filter(c => pgColMap.has(c));
      if (!cols.length && rows.length) throw new Error(`No common columns for ${table}`);

      if (rows.length) {
        const colSql = cols.map(qident).join(", ");
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const sql = `INSERT INTO ${qident(table)} (${colSql}) VALUES (${placeholders})`;
        for (const row of rows) {
          const values = cols.map(c => {
            const meta = pgColMap.get(c);
            return toPgValue(row[c], meta.data_type, meta.udt_name);
          });
          await client.query(sql, values);
        }
      }

      const verify = await client.query(`SELECT count(*)::int AS count FROM ${qident(table)}`);
      const targetCount = verify.rows[0].count;
      if (targetCount !== rows.length) throw new Error(`Row-count mismatch for ${table}: D1=${rows.length}, PostgreSQL=${targetCount}`);
      total += rows.length;
      report.push({ table, source: rows.length, target: targetCount });
      console.log(`${table}: ${rows.length}`);
    }

    await client.query("COMMIT");
    console.log(`Migration complete: ${total} row(s) copied across ${report.length} table(s).`);

    for (const key of ["companies", "users", "projects", "wbs_tasks", "task_actuals", "deliverables", "deliverable_versions", "user_notifications"]) {
      const item = report.find(r => r.table === key);
      if (item) console.log(`VERIFY ${key}: D1=${item.source}, PostgreSQL=${item.target}`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  await client.end();
}
