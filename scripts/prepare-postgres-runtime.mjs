import fs from "node:fs";
import path from "node:path";

const root=process.cwd();

function patch(file, transform){
  const full=path.join(root,file);
  if(!fs.existsSync(full)) throw new Error(`Missing file: ${file}`);
  const before=fs.readFileSync(full,"utf8");
  const after=transform(before);
  if(after!==before){
    fs.writeFileSync(full,after,"utf8");
    console.log(`patched ${file}`);
  }else{
    console.log(`ok ${file}`);
  }
}

patch("db/workflow-foundation.ts", source => {
  if(source.includes("PostgreSQL schema is migration-owned. Workflow runtime DDL is disabled.")) return source;
  return source.replace(
    /export async function ensureWorkflowFoundation\(db:RuntimeD1\)\{[\s\S]*?\}\n\nexport const defaultWorkflowTemplates/,
    `export async function ensureWorkflowFoundation(_db:RuntimeD1){\n  // PostgreSQL schema is migration-owned. Workflow runtime DDL is disabled.\n  return;\n}\n\nexport const defaultWorkflowTemplates`,
  );
});

patch("db/project-data-foundation.ts", source => {
  if(source.includes("PostgreSQL schema is migration-owned. Runtime DDL is intentionally disabled.")) return source;
  return source.replace(
    /export function ensureProjectDataFoundation\(db: RuntimeD1\) \{[\s\S]*?\n\}/,
    `export function ensureProjectDataFoundation(_db: RuntimeD1) {\n  // PostgreSQL schema is migration-owned. Runtime DDL is intentionally disabled.\n  return Promise.resolve();\n}`,
  );
});

patch("app/api/state/route.ts", source => source.replace(
  /async function ensure\(db:D1\)\{[\s\S]*?\n\}/,
  `async function ensure(_db:D1){return;}`,
));

patch("app/api/product-data/route.ts", source => source.replace(
  /async function ensureTables\(db:D1\)\{[\s\S]*?\n\}/,
  `async function ensureTables(_db:D1){return;}`,
));

patch("app/api/workflows/shared.ts", source => {
  let out=source;
  if(!out.includes('from "../../../db/postgres-d1-compat"')){
    out=out.replace(
      'import type {RequestContext} from "../../../db/request-context";',
      'import type {RequestContext} from "../../../db/request-context";\nimport {getLegacyDbCompat} from "../../../db/postgres-d1-compat";',
    );
  }
  out=out.replace(
    /export async function workflowDb\(\):Promise<D1>\{const runtime=await import\("cloudflare:workers"\);const db=runtime\.env\.DB as unknown as D1;await ensureProjectDataFoundation\(db as RuntimeD1\);await ensureWorkflowFoundation\(db as RuntimeD1\);return db\}/,
    'export async function workflowDb():Promise<D1>{const db=getLegacyDbCompat() as unknown as D1;await ensureProjectDataFoundation(db as RuntimeD1);await ensureWorkflowFoundation(db as RuntimeD1);return db}',
  );
  return out;
});

console.log("PostgreSQL runtime preparation complete.");
