import {pgTable,text,integer,doublePrecision,boolean,uniqueIndex} from 'drizzle-orm/pg-core';
import {projectsDb} from './schema';
export const customerSuppliedItems=pgTable('customer_supplied_items',{
 id:text('id').primaryKey(),companyId:text('company_id').notNull(),projectId:text('project_id').notNull().references(()=>projectsDb.id),
 section:text('section').notNull(),itemNumber:text('item_number').notNull(),description:text('description').notNull(),quantity:doublePrecision('quantity').notNull(),status:text('status').notNull(),change:text('change').notNull(),changeText:text('change_text').notNull(),
 recordId:text('record_id').notNull(),version:integer('version').notNull(),itemId:text('item_id').notNull(),sourceOrder:integer('source_order').notNull(),
 bomRecordId:text('bom_record_id'),parentPartId:text('parent_part_id'),partId:text('part_id'),bomApplied:boolean('bom_applied').notNull().default(false),confirmedBy:text('confirmed_by').notNull(),confirmedAt:integer('confirmed_at').notNull(),
},t=>[uniqueIndex('customer_supplied_item_uq').on(t.companyId,t.projectId,t.section,t.itemNumber)]);
