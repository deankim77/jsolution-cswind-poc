import { getLegacyDbCompat } from '../../../../db/postgres-d1-compat';
import { resolveRequestContext } from '../../../../db/request-context';
import { createProductionProjectService } from '../../../../services/production-project-service';
import { customerDataError } from '../../projects/[projectId]/customer-data/context';
import { CustomerDataError } from '../../../../lib/customer-data-contract';

export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request, getLegacyDbCompat());
    const input = await request.json() as { action?: string; startDate?: string };
    if (!['template','demo'].includes(input.action ?? '')) throw new CustomerDataError('등록 작업을 선택하세요.');
    const service = createProductionProjectService();
    const installed = await service.installTemplate(context);
    if (input.action === 'template') return Response.json(installed);
    const project = await service.create(context, { name: 'T800 생산 시연 프로젝트', templateVersionId: installed.template.versionId, startDate: input.startDate || new Date().toISOString().slice(0,10), customerName:'TC800 샘플 고객', demo:true });
    return Response.json({ ...installed, project });
  } catch (error) { return customerDataError(error); }
}
