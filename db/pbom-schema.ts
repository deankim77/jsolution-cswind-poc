import {integer,jsonb,pgTable,text,uniqueIndex} from 'drizzle-orm/pg-core';
import {projectsDb,productParts,productBomItems} from './schema';
import {customerRawData} from './customer-data-schema';
import type {BomFact} from '../lib/pbom-contract';
export const productionBomRoots=pgTable('production_bom_roots',{
 projectId:text('project_id').primaryKey().references(()=>projectsDb.id),companyId:text('company_id').notNull(),rootPartId:text('root_part_id').notNull().references(()=>productParts.id),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('production_bom_roots_part_uq').on(t.rootPartId)]);
export const customerPartIdentities=pgTable('customer_part_identities',{
 id:text('id').primaryKey(),companyId:text('company_id').notNull(),projectId:text('project_id').notNull().references(()=>projectsDb.id),customerKey:text('customer_key').notNull(),partId:text('part_id').notNull().references(()=>productParts.id),revision:text('revision').notNull(),
},t=>[uniqueIndex('customer_part_identity_uq').on(t.companyId,t.projectId,t.customerKey)]);
export const customerBomOccurrences=pgTable('customer_bom_occurrences',{
 id:text('id').primaryKey(),companyId:text('company_id').notNull(),projectId:text('project_id').notNull().references(()=>projectsDb.id),recordId:text('record_id').notNull().references(()=>customerRawData.id),version:integer('version').notNull(),itemId:text('item_id').notNull(),bomItemId:text('bom_item_id').notNull().references(()=>productBomItems.id,{onDelete:'cascade'}),fact:jsonb('fact').$type<BomFact>().notNull(),source:text('source').notNull(),confirmedBy:text('confirmed_by').notNull(),confirmedAt:integer('confirmed_at').notNull(),
},t=>[uniqueIndex('customer_bom_occurrence_uq').on(t.recordId,t.itemId)]);
