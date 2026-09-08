import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaPath = path.join(root, "db", "schema.ts");

if (!fs.existsSync(schemaPath)) {
  console.error(`Schema not found: ${schemaPath}`);
  process.exit(1);
}

let source = fs.readFileSync(schemaPath, "utf8");

if (source.includes('from "drizzle-orm/pg-core"')) {
  console.log("db/schema.ts is already using drizzle-orm/pg-core. No conversion needed.");
  process.exit(0);
}

if (!source.includes('from "drizzle-orm/sqlite-core"')) {
  console.error("Expected a SQLite Drizzle schema, but drizzle-orm/sqlite-core was not found.");
  process.exit(1);
}

source = source.replace(
  /import\s*\{[^}]*\}\s*from\s*["']drizzle-orm\/sqlite-core["'];?/,
  'import { integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";'
);

// Migration principle: change the database engine first, not application value semantics.
// Existing raw D1 APIs use epoch integers, 0/1 flags and JSON strings extensively.
// Preserve those physical representations during the PostgreSQL cutover; native PG types
// can be introduced later behind repository/service boundaries without breaking legacy APIs.
source = source
  .replace(/\binteger\(([^,()]+),\s*\{\s*mode\s*:\s*["']timestamp["']\s*\}\)/g, 'integer($1)')
  .replace(/\binteger\(([^,()]+),\s*\{\s*mode\s*:\s*["']boolean["']\s*\}\)/g, 'integer($1)')
  .replace(/\btext\(([^,()]+),\s*\{\s*mode\s*:\s*["']json["']\s*\}\)/g, 'text($1)')
  .replace(/\bsqliteTable\b/g, "pgTable");

const leftovers = [
  ["drizzle-orm/sqlite-core", /drizzle-orm\/sqlite-core/],
  ["sqliteTable", /\bsqliteTable\b/],
  ["SQLite timestamp mode", /mode\s*:\s*["']timestamp["']/],
  ["SQLite boolean mode", /mode\s*:\s*["']boolean["']/],
  ["SQLite JSON text mode", /mode\s*:\s*["']json["']/],
];

const unresolved = leftovers.filter(([, re]) => re.test(source)).map(([name]) => name);
if (unresolved.length) {
  console.error(`PostgreSQL schema conversion stopped; unresolved SQLite constructs: ${unresolved.join(", ")}`);
  process.exit(1);
}

fs.writeFileSync(schemaPath, source, "utf8");
console.log("Converted db/schema.ts to PostgreSQL while preserving legacy epoch/0-1/JSON-text value semantics.");
console.log("Next: run npm.cmd run check:contracts, then npm.cmd run db:generate with DATABASE_URL set.");
