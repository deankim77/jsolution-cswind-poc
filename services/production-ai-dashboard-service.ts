import {createProductionAiDashboardRepository} from '../db/repositories/production-ai-dashboard-repository';
import type {CustomerDataScope} from '../db/repositories/customer-data-repository';
export function createProductionAiDashboardService(repository=createProductionAiDashboardRepository()){return {async list(scope:CustomerDataScope){return {projects:await repository.list(scope)};}};}
