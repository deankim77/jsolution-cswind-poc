import { index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { deliverables } from "./schema";

export const workflowSourceDrawingLinks = pgTable("workflow_source_drawing_links", {
  companyId: text("company_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  drawingId: text("drawing_id").notNull().references(() => deliverables.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [
  primaryKey({ columns: [table.companyId, table.sourceType, table.sourceId, table.drawingId] }),
  index("workflow_source_drawing_links_source_idx").on(table.companyId, table.sourceType, table.sourceId),
  index("workflow_source_drawing_links_drawing_idx").on(table.companyId, table.drawingId),
]);
