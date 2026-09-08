import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "db", "schema.ts");
if (!fs.existsSync(schemaPath)) throw new Error(`Missing schema: ${schemaPath}`);
let source = fs.readFileSync(schemaPath, "utf8");

const patches = [
  {
    table: "ai_conversations",
    columns: [
      ["group_name", 'groupName:text("group_name")'],
    ],
  },
  {
    table: "deliverables",
    columns: [
      ["drawing_code", 'drawingCode:text("drawing_code")'],
      ["drawing_company_id", 'drawingCompanyId:text("drawing_company_id")'],
      ["drawing_type", 'drawingType:text("drawing_type")'],
      ["internal_drawing_number", 'internalDrawingNumber:text("internal_drawing_number")'],
      ["customer_drawing_number", 'customerDrawingNumber:text("customer_drawing_number")'],
      ["owner_department", 'ownerDepartment:text("owner_department")'],
      ["owner_user_id", 'ownerUserId:text("owner_user_id")'],
    ],
  },
  {
    table: "design_change_requests",
    columns: [
      ["drawing_id", 'drawingId:text("drawing_id")'],
      ["change_type", 'changeType:text("change_type")'],
    ],
  },
  {
    table: "product_parts",
    columns: [
      ["actual_cost", 'actualCost:doublePrecision("actual_cost").notNull().default(0)'],
    ],
  },
  {
    table: "project_issues",
    columns: [
      ["created_by", 'createdBy:text("created_by")'],
    ],
  },
];

if (source.includes('pgTable("product_parts"') && !source.includes("doublePrecision")) {
  source = source.replace(/import\s*\{([^}]*)\}\s*from\s*["']drizzle-orm\/pg-core["'];?/, (_m, body) => {
    const names = body.split(",").map(v => v.trim()).filter(Boolean);
    if (!names.includes("doublePrecision")) names.push("doublePrecision");
    return `import { ${names.join(", ")} } from "drizzle-orm/pg-core";`;
  });
}

let added = 0;
for (const patch of patches) {
  const marker = `pgTable("${patch.table}", {`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Table definition not found in db/schema.ts: ${patch.table}`);
  const insertAt = start + marker.length;
  const missing = patch.columns.filter(([column]) => !source.slice(start, source.indexOf("});", start) + 3).includes(`"${column}"`));
  if (!missing.length) {
    console.log(`${patch.table}: columns already present`);
    continue;
  }
  const fragment = `\n  ${missing.map(([, expr]) => expr).join(",\n  ")},`;
  source = source.slice(0, insertAt) + fragment + source.slice(insertAt);
  added += missing.length;
  console.log(`${patch.table}: added ${missing.map(([c]) => c).join(", ")}`);
}

fs.writeFileSync(schemaPath, source, "utf8");
console.log(`Added ${added} D1 compatibility column(s) to db/schema.ts`);
console.log("Next: npm.cmd run db:generate");
