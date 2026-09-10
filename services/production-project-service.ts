import { createProductionProjectRepository, type ProductionProjectInput, type ProductionScope } from '../db/repositories/production-project-repository';
import { CustomerDataError } from '../lib/customer-data-contract';

export function createProductionProjectService(repository = createProductionProjectRepository()) {
  return {
    installTemplate: (scope: ProductionScope) => repository.installTemplate(scope),
    async create(scope: ProductionScope, input: ProductionProjectInput) {
      if (!input.name?.trim() || input.name.length > 200 || !input.templateVersionId) throw new CustomerDataError('프로젝트명과 생산 템플릿을 선택하세요.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? '') || !Number.isFinite(Date.parse(input.startDate))) throw new CustomerDataError('시작일을 확인하세요.');
      if (input.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) || input.endDate < input.startDate)) throw new CustomerDataError('종료일을 확인하세요.');
      return repository.createProject(scope, { ...input, name: input.name.trim() });
    },
  };
}
