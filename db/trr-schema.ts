import {integer,jsonb,pgTable,text,uniqueIndex} from 'drizzle-orm/pg-core';
import type {TrrDocument} from '../lib/trr-contract';
export const trrVersions=pgTable('trr_versions',{
 id:text('id').primaryKey(),companyId:text('company_id').notNull(),projectId:text('project_id').notNull(),version:integer('version').notNull(),fingerprint:text('fingerprint').notNull(),summary:text('summary').notNull(),document:jsonb('document').$type<TrrDocument>().notNull(),fileKey:text('file_key').notNull(),createdBy:text('created_by').notNull(),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('trr_version_scope_uq').on(t.companyId,t.projectId,t.version),uniqueIndex('trr_fingerprint_scope_uq').on(t.companyId,t.projectId,t.fingerprint)]);
export const trrJobs=pgTable('trr_jobs',{
 id:text('id').primaryKey(),companyId:text('company_id').notNull(),projectId:text('project_id').notNull(),status:text('status').notNull(),token:text('token'),error:text('error'),updatedAt:integer('updated_at').notNull(),
},t=>[uniqueIndex('trr_job_scope_uq').on(t.companyId,t.projectId)]);
