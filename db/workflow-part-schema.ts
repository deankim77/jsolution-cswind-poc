import { integer, pgTable, primaryKey, text, index } from "drizzle-orm/pg-core";
import { productParts } from "./schema";

export const workflowSourcePartLinks = pgTable("workflow_source_part_links", {
  companyId: text("company_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  partId: text("part_id").notNull().references(() => productParts.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [
  primaryKey({ columns: [table.companyId, table.sourceType, table.sourceId, table.partId] }),
  index("workflow_source_part_links_source_idx").on(table.companyId, table.sourceType, table.sourceId),
  index("workflow_source_part_links_part_idx").on(table.companyId, table.partId),
]);
