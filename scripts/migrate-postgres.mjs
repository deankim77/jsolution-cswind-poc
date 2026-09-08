import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();
const migrationDir = path.join(root, "drizzle-postgres");
const journalPath = path.join(migrationDir, "meta", "_journal.json");

if (!process.env.DATABASE_URL) {
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for PostgreSQL migrations.");
}
if (!fs.existsSync(journalPath)) {
  throw new Error(`Migration journal not found: ${journalPath}`);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const entries = [...(journal.entries ?? [])].sort((a, b) => Number(a.idx) - Number(b.idx));
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
  await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint NOT NULL
  )`);

  for (const entry of entries) {
    const sqlPath = path.join(migrationDir, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) throw new Error(`Migration SQL not found: ${sqlPath}`);

    const sql = fs.readFileSync(sqlPath, "utf8");
    const hash = crypto.createHash("sha256").update(sql).digest("hex");
    const createdAt = String(entry.when);
    const existing = await client.query(
      "SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at = $1 ORDER BY id DESC LIMIT 1",
      [createdAt],
    );

    if (existing.rowCount) {
      if (existing.rows[0].hash !== hash) {
        throw new Error(`Migration ${entry.tag} has the same timestamp but a different hash.`);
      }
      console.log(`skip ${entry.tag} (already applied)`);
      continue;
    }

    const statements = sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean);

    await client.query("BEGIN");
    try {
      for (const statement of statements) await client.query(statement);
      await client.query(
        "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
        [hash, createdAt],
      );
      await client.query("COMMIT");
      console.log(`applied ${entry.tag} (${statements.length} statements)`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  const countResult = await client.query("SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations");
  console.log(`PostgreSQL migrations complete: ${countResult.rows[0].count} migration(s) recorded.`);
} finally {
  await client.end();
}
