import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const schemaPath=path.join(root,"db","schema.ts");
const foundationPath=path.join(root,"db","project-data-foundation.ts");
const statePath=path.join(root,"app","api","state","route.ts");
const productPath=path.join(root,"app","api","product-data","route.ts");

function read(file){if(!fs.existsSync(file))throw new Error(`Missing file: ${file}`);return fs.readFileSync(file,"utf8")}
function write(file,source){fs.writeFileSync(file,source,"utf8")}

let schema=read(schemaPath);
if(!schema.includes('from "drizzle-orm/pg-core"'))throw new Error("Expected PostgreSQL Drizzle schema");
if(!schema.includes("doublePrecision")){
  schema=schema.replace(/import\s*\{([^}]*)\}\s*from\s*["']drizzle-orm\/pg-core["'];?/,(_m,body)=>{
    const names=body.split(",").map(v=>v.trim()).filter(Boolean);
    if(!names.includes("doublePrecision"))names.push("doublePrecision");
    names.sort();
    return `import { ${names.join(", ")} } from "drizzle-orm/pg-core";`;
  });
}
if(!schema.includes('pgTable("product_parts"')){
  schema += `\n\n// Product/BOM tables promoted from legacy runtime DDL.\nexport const productParts = pgTable("product_parts", {\n  id:text("id").primaryKey(), companyId:text("company_id").notNull(), partNumber:text("part_number").notNull(), name:text("name").notNull(),\n  partType:text("part_type").notNull().default("PART"), spec:text("spec"), unit:text("unit").notNull().default("EA"), revision:text("revision").notNull().default("A"),\n  status:text("status").notNull().default("active"), standardCost:doublePrecision("standard_cost").notNull().default(0), createdBy:text("created_by"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),\n}, t=>[uniqueIndex("product_parts_company_number_uq").on(t.companyId,t.partNumber)]);\n\nexport const productBomItems = pgTable("product_bom_items", {\n  id:text("id").primaryKey(), companyId:text("company_id").notNull(), parentPartId:text("parent_part_id").notNull(), childPartId:text("child_part_id").notNull(),\n  quantity:doublePrecision("quantity").notNull().default(1), unit:text("unit").notNull().default("EA"), sortOrder:integer("sort_order").notNull().default(0), note:text("note"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),\n}, t=>[uniqueIndex("product_bom_parent_child_uq").on(t.companyId,t.parentPartId,t.childPartId)]);\n\nexport const bomEditLocks = pgTable("bom_edit_locks", {\n  id:text("id").primaryKey(), companyId:text("company_id").notNull(), rootPartId:text("root_part_id").notNull(), lockedBy:text("locked_by").notNull(), lockedAt:integer("locked_at").notNull(), updatedAt:integer("updated_at").notNull(),\n}, t=>[uniqueIndex("bom_edit_locks_company_root_uq").on(t.companyId,t.rootPartId)]);\n\nexport const partNumberHistory = pgTable("part_number_history", {\n  id:text("id").primaryKey(), companyId:text("company_id").notNull(), partId:text("part_id").notNull(), partNumber:text("part_number").notNull(), ruleCode:text("rule_code").notNull(), createdBy:text("created_by"), createdAt:integer("created_at").notNull(),\n});\n\nexport const costSheets = pgTable("cost_sheets", {\n  id:text("id").primaryKey(), companyId:text("company_id").notNull(), partId:text("part_id").notNull(), version:integer("version").notNull().default(1),\n  materialCost:doublePrecision("material_cost").notNull().default(0), laborCost:doublePrecision("labor_cost").notNull().default(0), overheadCost:doublePrecision("overhead_cost").notNull().default(0), totalCost:doublePrecision("total_cost").notNull().default(0),\n  note:text("note"), status:text("status").notNull().default("draft"), createdBy:text("created_by"), createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(),\n}, t=>[uniqueIndex("cost_sheets_part_version_uq").on(t.companyId,t.partId,t.version)]);\n`;
  write(schemaPath,schema);
  console.log("Added 5 Product/BOM tables to db/schema.ts");
}else console.log("Product/BOM tables already present in db/schema.ts");

let foundation=read(foundationPath);
foundation=foundation.replace(/export function ensureProjectDataFoundation\(db: RuntimeD1\) \{[\s\S]*?\n\}/,`export function ensureProjectDataFoundation(_db: RuntimeD1) {\n  // PostgreSQL schema is migration-owned. Runtime DDL is intentionally disabled.\n  return Promise.resolve();\n}`);
write(foundationPath,foundation);
console.log("Disabled project-data runtime DDL");

let state=read(statePath);
state=state.replace(/async function ensure\(db:D1\)\{[^\n]*\}/,`async function ensure(_db:D1){return;}`);
write(statePath,state);
console.log("Disabled /api/state runtime DDL");

let product=read(productPath);
product=product.replace(/async function ensureTables\(db:D1\)\{[\s\S]*?\n\}/,`async function ensureTables(_db:D1){return;}`);
write(productPath,product);
console.log("Disabled /api/product-data runtime DDL");

console.log("Runtime DDL promotion complete. Next: npm.cmd run db:generate && npm.cmd run db:migrate");
