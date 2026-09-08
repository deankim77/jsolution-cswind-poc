import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const errors = [];

// Immutable migration baseline: the first commit copied from the legacy V2 source.
// Existing D1/SQLite dependencies may only stay the same or decrease from this point.
// New D1/SQLite dependencies are forbidden.
const MIGRATION_BASELINE = "c7e7b3b";

const requiredFiles = [
  "ARCHITECTURE.md",
  "AGENTS.md",
  "docs/UI-CONTRACT.md",
  "docs/V2-UI-STANDARD.md",
  "app/ui-standard-tokens.css",
  "app/v2/v2-ui-foundation-enforcement.css",
];

for (const relative of requiredFiles) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) errors.push(`${relative}: required architecture/UI contract file is missing`);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function gitShow(relative) {
  try {
    return execFileSync("git", ["show", `${MIGRATION_BASELINE}:${relative}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

const appDir = path.join(root, "app");
const uiFiles = walk(appDir).filter((file) => {
  const relative = rel(file);
  if (relative.startsWith("app/api/")) return false;
  return /\.(ts|tsx|js|jsx)$/.test(relative);
});

const forbiddenUiPatterns = [
  { re: /(?:from\s*["']|import\s*["'])drizzle-orm(?:\/[^"']*)?["']/g, reason: "UI must not import drizzle-orm directly" },
  { re: /(?:from\s*["']|import\s*["'])cloudflare:workers["']/g, reason: "UI must not access Cloudflare worker bindings directly" },
  { re: /(?:from\s*["']|import\s*["'])(?:@\/)?db(?:\/[^"']*)?["']/g, reason: "UI must not import the DB layer directly" },
  { re: /(?:from\s*["']|import\s*["'])\.\.\/(?:\.\.\/)*db(?:\/[^"']*)?["']/g, reason: "UI must not import the DB layer directly" },
  { re: /\benv\.DB\b/g, reason: "UI must not access D1 env.DB" },
  { re: /\bdrizzle\s*\(/g, reason: "UI must not instantiate an ORM connection" },
];

for (const file of uiFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const rule of forbiddenUiPatterns) {
    rule.re.lastIndex = 0;
    if (rule.re.test(source)) errors.push(`${rel(file)}: ${rule.reason}`);
  }
}

const legacyPatterns = [
  { name: "drizzle-orm/d1", re: /drizzle-orm\/d1/g },
  { name: "drizzle-orm/sqlite-core", re: /drizzle-orm\/sqlite-core/g },
  { name: "sqliteTable", re: /\bsqliteTable\b/g },
  { name: "env.DB", re: /\benv\.DB\b/g },
];

function countMatches(source, re) {
  if (!source) return 0;
  re.lastIndex = 0;
  return [...source.matchAll(re)].length;
}

// PostgreSQL migration rule:
// - Files existing at the immutable baseline may keep or reduce their legacy dependency count.
// - A legacy dependency count may never increase.
// - New files may not introduce any D1/SQLite dependency.
const sourceRoots = ["app", "db", "lib", "worker"].flatMap((name) => walk(path.join(root, name)));
for (const file of sourceRoots) {
  const relative = rel(file);
  if (!/\.(ts|tsx|js|jsx)$/.test(relative)) continue;

  const current = fs.readFileSync(file, "utf8");
  const baseline = gitShow(relative);

  for (const pattern of legacyPatterns) {
    const currentCount = countMatches(current, pattern.re);
    const baselineCount = countMatches(baseline, pattern.re);

    if (currentCount > baselineCount) {
      errors.push(
        `${relative}: legacy ${pattern.name} usage increased from ${baselineCount} to ${currentCount}; ` +
        "D1/SQLite dependencies may only decrease during the PostgreSQL migration"
      );
    }
  }
}

if (errors.length) {
  console.error("AI PLM Architecture Contract check failed:\n" + errors.join("\n"));
  process.exit(1);
}

console.log(
  `AI PLM Architecture Contract check passed (${uiFiles.length} UI source files checked; D1 baseline ${MIGRATION_BASELINE} enforced).`
);
