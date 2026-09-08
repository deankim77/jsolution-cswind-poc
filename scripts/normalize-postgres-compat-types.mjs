import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaPath = path.join(root, "db", "schema.ts");
if (!fs.existsSync(schemaPath)) throw new Error(`Schema not found: ${schemaPath}`);

let source = fs.readFileSync(schemaPath, "utf8");
if (!source.includes('from "drizzle-orm/pg-core"')) {
  throw new Error("db/schema.ts is not a PostgreSQL Drizzle schema.");
}

// Transitional compatibility rule:
// preserve the physical value semantics used by the existing D1/raw SQL code.
// - epoch seconds remain integer
// - boolean flags remain integer 0/1
// - JSON payloads remain text containing JSON
source = source
  .replace(/\btimestamp\(([^,()]+),\s*\{\s*withTimezone\s*:\s*true\s*,\s*mode\s*:\s*["']date["']\s*\}\)/g, 'integer($1)')
  .replace(/\bboolean\(([^)]+)\)/g, 'integer($1)')
  .replace(/\bjsonb\(([^)]+)\)/g, 'text($1)')
  // Drizzle keeps boolean defaults when a boolean() column is converted to integer().
  // PostgreSQL rejects `integer DEFAULT true/false`, so preserve D1 semantics as 1/0.
  .replace(/\.default\(true\)/g, '.default(1)')
  .replace(/\.default\(false\)/g, '.default(0)');

source = source.replace(
  /import\s*\{([^}]*)\}\s*from\s*["']drizzle-orm\/pg-core["'];?/,
  (_m, body) => {
    const names = body.split(",").map((v) => v.trim()).filter(Boolean);
    const kept = names.filter((name) => !["boolean", "jsonb", "timestamp"].includes(name));
    for (const required of ["integer", "pgTable", "primaryKey", "text", "uniqueIndex"]) {
      if (!kept.includes(required)) kept.push(required);
    }
    kept.sort();
    return `import { ${kept.join(", ")} } from "drizzle-orm/pg-core";`;
  }
);

const forbidden = [
  /\btimestamp\(/,
  /\bboolean\(/,
  /\bjsonb\(/,
  /\.default\((?:true|false)\)/,
];
if (forbidden.some((re) => re.test(source))) {
  throw new Error("Compatibility normalization left native timestamp/boolean/jsonb constructors or boolean defaults in db/schema.ts");
}

fs.writeFileSync(schemaPath, source, "utf8");
console.log("Normalized PostgreSQL schema for legacy API compatibility: epoch/boolean/json remain integer/text during migration; boolean defaults are 1/0.");
