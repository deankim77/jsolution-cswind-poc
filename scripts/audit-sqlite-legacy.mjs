import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const roots = ["app/api", "db", "lib", "worker"];
const patterns = [
  ["cloudflare_workers", /cloudflare:workers/g],
  ["d1_driver", /drizzle-orm\/d1/g],
  ["env_db", /\benv\.DB\b/g],
  ["prepare", /\.prepare\s*\(/g],
  ["batch", /\.batch\s*\(/g],
  ["sqlite_master", /sqlite_master/g],
  ["pragma", /\bPRAGMA\b/gi],
  ["insert_or_ignore", /INSERT\s+OR\s+IGNORE/gi],
  ["insert_or_replace", /INSERT\s+OR\s+REPLACE/gi],
  ["question_placeholders", /\?/g],
  ["strftime", /\bstrftime\s*\(/gi],
  ["unixepoch", /\bunixepoch\s*\(/gi],
  ["json_extract", /\bjson_extract\s*\(/gi],
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = roots.flatMap((dir) => walk(path.join(root, dir)));
const totals = Object.fromEntries(patterns.map(([name]) => [name, 0]));
const perFile = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const hits = {};
  for (const [name, regex] of patterns) {
    regex.lastIndex = 0;
    const count = [...source.matchAll(regex)].length;
    if (count) {
      hits[name] = count;
      totals[name] += count;
    }
  }
  if (Object.keys(hits).length) {
    perFile.push({ file: path.relative(root, file).replaceAll("\\", "/"), hits, score: Object.values(hits).reduce((a, b) => a + b, 0) });
  }
}

perFile.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
console.log("AI PLM SQLite/D1 legacy audit");
console.log(`Scanned ${files.length} source files; ${perFile.length} contain legacy DB patterns.\n`);
console.log("Totals:");
for (const [name] of patterns) console.log(`  ${name.padEnd(23)} ${totals[name]}`);
console.log("\nTop legacy files:");
for (const item of perFile.slice(0, 80)) {
  const detail = Object.entries(item.hits).map(([k, v]) => `${k}=${v}`).join(", ");
  console.log(`  ${item.file}: ${detail}`);
}

if (process.argv.includes("--json")) {
  fs.writeFileSync(path.join(root, "sqlite-legacy-audit.json"), JSON.stringify({ totals, files: perFile }, null, 2));
  console.log("\nWrote sqlite-legacy-audit.json");
}
