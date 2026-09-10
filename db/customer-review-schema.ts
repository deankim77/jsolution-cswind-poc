import {foreignKey,integer,jsonb,pgTable,text,uniqueIndex} from 'drizzle-orm/pg-core';
import {customerRawData} from './customer-data-schema';
import type {ReviewDraft,ReviewItem,ReviewMessage} from '../lib/customer-review-contract';
export const customerReviews=pgTable('customer_reviews',{
 recordId:text('record_id').primaryKey(),companyId:text('company_id').notNull(),projectId:text('project_id').notNull(),version:integer('version').notNull(),draft:jsonb('draft').$type<ReviewDraft>().notNull(),messages:jsonb('messages').$type<ReviewMessage[]>().notNull(),updatedBy:text('updated_by').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[foreignKey({columns:[t.companyId,t.projectId,t.recordId],foreignColumns:[customerRawData.companyId,customerRawData.projectId,customerRawData.id]})]);
export const customerConfirmedData=pgTable('customer_confirmed_data',{
 id:text('id').primaryKey(),companyId:text('company_id').notNull(),projectId:text('project_id').notNull(),recordId:text('record_id').notNull(),version:integer('version').notNull(),itemId:text('item_id').notNull(),item:jsonb('item').$type<ReviewItem>().notNull(),confirmedBy:text('confirmed_by').notNull(),confirmedAt:integer('confirmed_at').notNull(),
},t=>[foreignKey({columns:[t.companyId,t.projectId,t.recordId],foreignColumns:[customerRawData.companyId,customerRawData.projectId,customerRawData.id]}),uniqueIndex('customer_confirmed_item_uq').on(t.recordId,t.version,t.itemId)]);
