import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const changed = [];

function patch(rel, transforms) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const transform of transforms) text = transform(text);
  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    changed.push(rel);
  }
}

const replace = (from, to) => text => text.replace(from, to);

// PostgreSQL has no SQLite rowid. Use deterministic primary-key tie breakers instead.
patch("app/api/templates/route.ts", [
  replace("ORDER BY tv2.updated_at DESC, tv2.created_at DESC, tv2.rowid DESC LIMIT 1", "ORDER BY tv2.updated_at DESC, tv2.created_at DESC, tv2.id DESC LIMIT 1"),
]);

patch("app/api/dashboard/summary/route.ts", [
  replace("planned_end<date('now')", "planned_end<CURRENT_DATE::text"),
  replace("ORDER BY d.decided_at DESC,d.rowid DESC LIMIT 1", "ORDER BY d.decided_at DESC,d.id DESC LIMIT 1"),
]);

patch("app/api/workflows/shared.ts", [
  replace("ORDER BY h.created_at,h.rowid", "ORDER BY h.created_at,h.id"),
]);

// Avoid DISTINCT + ORDER BY on a non-selected PostgreSQL expression by using EXISTS for access filtering.
patch("app/api/project-costs/route.ts", [
  replace(
    '"SELECT DISTINCT p.id,p.code,p.name,p.status FROM projects p LEFT JOIN project_members pm ON pm.project_id=p.id WHERE p.company_id=? AND pm.user_id=? ORDER BY p.updated_at DESC,p.name"',
    '"SELECT p.id,p.code,p.name,p.status FROM projects p WHERE p.company_id=? AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?) ORDER BY p.updated_at DESC,p.name"'
  ),
]);

// Node runtime: use the PostgreSQL compatibility DB instead of Cloudflare Worker DB.
patch("app/api/ai/conversations/route.ts", [
  text => {
    if (!text.includes('getLegacyDbCompat')) {
      text = text.replace(
        'import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";',
        'import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";\nimport { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";'
      );
    }
    return text;
  },
  text => text.replace(
    /async function runtime\(\): Promise<\{DB:D1;FILES\?:R2Bucket\}> \{\s*const cloudflare = await import\("cloudflare:workers"\);\s*return cloudflare\.env as unknown as \{DB:D1;FILES\?:R2Bucket\};\s*\}/m,
    'async function runtime(): Promise<{DB:D1;FILES?:R2Bucket}> {\n  return {DB:getLegacyDbCompat() as unknown as D1};\n}'
  ),
  replace("ORDER BY created_at ASC,rowid ASC", "ORDER BY created_at ASC,id ASC"),
  replace("ORDER BY created_at DESC,rowid DESC", "ORDER BY created_at DESC,id DESC"),
]);

console.log(`Residual PostgreSQL runtime patch complete: ${changed.length} file(s) changed.`);
for (const file of changed) console.log(` - ${file}`);
if (!changed.length) console.log("No changes needed; patch is already applied.");
