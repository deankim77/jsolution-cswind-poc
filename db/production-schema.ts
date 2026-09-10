import { foreignKey, pgTable, text, integer, primaryKey } from 'drizzle-orm/pg-core';
import { customerRawData } from './customer-data-schema';
import { users, wbsTasks } from './schema';

export const productionAssignments = pgTable('production_data_assignments',{
  companyId:text('company_id').notNull(),projectId:text('project_id').notNull(),
  recordId:text('record_id').notNull(),taskId:text('task_id').notNull().references(()=>wbsTasks.id,{onDelete:'restrict'}),
  confirmedBy:text('confirmed_by').notNull().references(()=>users.id),confirmedAt:integer('confirmed_at').notNull(),
},t=>[
  primaryKey({columns:[t.recordId,t.taskId]}),
  foreignKey({columns:[t.companyId,t.projectId,t.recordId],foreignColumns:[customerRawData.companyId,customerRawData.projectId,customerRawData.id]}),
]);
