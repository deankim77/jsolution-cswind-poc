import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../index';
import { auditLogs, calendarHolidays, companies, deliverables, partners, projectMembers, projectProfiles, projectRoles, projectShares, projectsDb, projectTypes, templates, templateVersions, workCalendars, wbsTasks, organizations, users } from '../schema';
import template from '../../lib/production/tc800-template.json';
import { productionSchedule, type ProductionTask } from '../../lib/production/schedule';
import { CustomerDataError } from '../../lib/customer-data-contract';

export type ProductionScope = { companyId: string; userId: string; systemRoles: string[] };
export type ProductionProjectInput = { name: string; startDate: string; endDate?: string; templateVersionId: string; customerName?: string; partnerId?: string; description?: string; referenceCode?: string; visibility?: 'company' | 'restricted'; sharedOrganizationIds?: string[]; members?: { userId: string; projectRole: string }[]; demo?: boolean };
const templateCode = 'TC800-PRODUCTION';
const demoReference = 'TC800-POC-V4';
const admin = (scope: ProductionScope) => scope.systemRoles.some(role => ['SUPER_ADMIN','ADMIN','SYSTEM_ADMIN'].includes(role));

export function createProductionProjectRepository(db = getDb()) {
  return {
    async installTemplate(scope: ProductionScope) {
      const check = await db.execute(sql`SELECT current_database() AS name`);
      if (check.rows[0]?.name !== 'jsolution_cswind_poc') throw new CustomerDataError('CS WIND 전용 DB에서만 시연 템플릿을 등록할 수 있습니다.',409);
      if (!admin(scope)) throw new CustomerDataError('관리자가 생산 표준 템플릿을 등록해 주세요.', 403);
      return db.transaction(async tx => {
        await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, scope.companyId)).for('update');
        const now = Math.floor(Date.now()/1000);
        let [item] = await tx.select().from(templates).where(and(eq(templates.companyId, scope.companyId), eq(templates.code, templateCode)));
        if (!item) {
          [item] = await tx.insert(templates).values({ id: randomUUID(), companyId: scope.companyId, code: templateCode, name: 'TC800 생산 표준', status: 'active', createdAt: now, updatedAt: now }).returning();
          await tx.insert(templateVersions).values({ id: randomUUID(), templateId: item.id, version: 'v1.0', definition: JSON.stringify(template), publishedAt: now, createdBy: scope.userId, createdAt: now, updatedAt: now });
          await tx.insert(auditLogs).values({ id: randomUUID(), companyId: scope.companyId, actorUserId: scope.userId, action: 'TEMPLATE_CREATED', entityType: 'TEMPLATE', entityId: item.id, detail: JSON.stringify({ source: templateCode }), createdAt: now });
        }
        const [version] = await tx.select().from(templateVersions).where(eq(templateVersions.templateId, item.id)).orderBy(sql`${templateVersions.updatedAt} DESC`, sql`${templateVersions.createdAt} DESC`).limit(1);
        if (!version || item.status !== 'active') throw new CustomerDataError('기존 TC800 템플릿을 사용 중으로 설정하세요.', 409);
        if (JSON.parse(version.definition).projectTypeCode !== 'PRODUCTION') throw new CustomerDataError('기존 TC800 템플릿의 생산 유형을 확인하세요.', 409);
        let [type] = await tx.select().from(projectTypes).where(and(eq(projectTypes.companyId, scope.companyId), eq(projectTypes.code, 'PRODUCTION')));
        if (!type) [type] = await tx.insert(projectTypes).values({ id: randomUUID(), companyId: scope.companyId, code: 'PRODUCTION', name: '생산', status: 'active', createdAt: now, updatedAt: now }).returning();
        if (type.status !== 'active') throw new CustomerDataError('생산 프로젝트 유형을 활성화해 주세요.', 409);
        return { template: { ...item, versionId: version.id, version: version.version, definition: JSON.parse(version.definition) }, projectType: type };
      });
    },
    async createProject(scope: ProductionScope, input: ProductionProjectInput) {
      return db.transaction(async tx => {
        // Serializes project number allocation and demo retry per company.
        await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, scope.companyId)).for('update');
        if (input.demo) {
          const existing = await tx.select({ project: projectsDb }).from(projectsDb).innerJoin(projectProfiles, eq(projectProfiles.projectId, projectsDb.id))
            .where(and(eq(projectsDb.companyId, scope.companyId), eq(projectProfiles.referenceCode, demoReference)));
          if (existing.length) {
            const p = existing[0].project;
            if (!admin(scope)) {
              const [member] = await tx.select().from(projectMembers).where(and(eq(projectMembers.projectId, p.id),eq(projectMembers.userId,scope.userId)));
              if (!member) throw new CustomerDataError('기존 시연 프로젝트의 참여자에게 문의하세요.',403);
            }
            return { ...p, projectTypeCode: 'PRODUCTION', reused: true };
          }
        }
        const [version] = await tx.select({ id: templateVersions.id, definition: templateVersions.definition, version: templateVersions.version, name: templates.name }).from(templateVersions).innerJoin(templates, eq(templates.id, templateVersions.templateId))
          .where(and(eq(templateVersions.id, input.templateVersionId), eq(templates.companyId, scope.companyId), eq(templates.status, 'active')));
        if (!version) throw new CustomerDataError('사용 가능한 생산 템플릿을 선택하세요.');
        const definition = JSON.parse(version.definition) as { projectTypeCode?: string; roles: string[]; wbs: ProductionTask[] };
        if (definition.projectTypeCode !== 'PRODUCTION') throw new CustomerDataError('생산용 템플릿을 선택하세요.');
        if (!definition.wbs?.length) throw new CustomerDataError('템플릿에 WBS가 없습니다.');
        const [type] = await tx.select().from(projectTypes).where(and(eq(projectTypes.companyId, scope.companyId), eq(projectTypes.code, 'PRODUCTION'), eq(projectTypes.status,'active')));
        if (!type) throw new CustomerDataError('생산 프로젝트 유형을 먼저 등록하세요.');
        if (input.partnerId) {
          const [partner] = await tx.select().from(partners).where(and(eq(partners.id,input.partnerId),eq(partners.companyId,scope.companyId),eq(partners.status,'active')));
          if (!partner) throw new CustomerDataError('거래처를 확인하세요.');
        }
        const shareIds = [...new Set(input.visibility === 'restricted' ? input.sharedOrganizationIds ?? [] : [])];
        if (input.visibility === 'restricted' && !shareIds.length) throw new CustomerDataError('공유 조직을 선택하세요.');
        for (const id of shareIds) {
          const [org] = await tx.select().from(organizations).where(and(eq(organizations.id,id),eq(organizations.companyId,scope.companyId)));
          if (!org) throw new CustomerDataError('공유 조직을 확인하세요.');
        }
        const members = new Map((input.members ?? []).map(member => [member.userId,member.projectRole]));
        members.set(scope.userId, 'PM');
        for (const id of members.keys()) {
          const [user] = await tx.select().from(users).where(and(eq(users.id,id),eq(users.companyId,scope.companyId),eq(users.status,'active')));
          if (!user) throw new CustomerDataError('참여자를 확인하세요.');
        }
        const [calendar] = await tx.select().from(workCalendars).where(and(eq(workCalendars.companyId, scope.companyId), eq(workCalendars.isDefault, 1)));
        const holidays = calendar ? await tx.select().from(calendarHolidays).where(eq(calendarHolidays.calendarId, calendar.id)) : [];
        const planned = productionSchedule(definition.wbs, input.startDate, JSON.parse(calendar?.workingDays ?? '[1,2,3,4,5]'), holidays.map(row => row.holidayDate));
        const plannedEnd = planned.map(row=>row.plannedEnd).filter((s):s is string=>Boolean(s)).sort().at(-1)!;
        if (input.endDate && input.endDate < plannedEnd) throw new CustomerDataError(`템플릿 계획 종료일 ${plannedEnd} 이후로 종료일을 설정하세요.`);
        const year = new Date().getUTCFullYear();
        const [{ number }] = await tx.select({ number: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${projectsDb.code} FROM 10) AS INTEGER)),0)+1` }).from(projectsDb)
          .where(and(eq(projectsDb.companyId,scope.companyId),sql`${projectsDb.code} ~ ${`^PRD-${year}-[0-9]+$`}`));
        const now = Math.floor(Date.now()/1000), projectId = randomUUID();
        const [project] = await tx.insert(projectsDb).values({ id: projectId, companyId: scope.companyId, templateVersionId: version.id, code: `PRD-${year}-${String(number).padStart(4,'0')}`, name: input.name, customerName: input.customerName || null, partnerId: input.partnerId || null, projectTypeId: type.id, startDate: input.startDate, endDate: input.endDate || plannedEnd, status: 'preparing', templateSnapshot: JSON.stringify({ templateName: version.name, version: version.version, definition }), createdAt: now, updatedAt: now }).returning();
        await tx.insert(projectProfiles).values({ projectId, description: input.description || (input.demo ? 'TC800 V4 시연 프로젝트. 일정은 시연용 가정이며 진행 실적과 AI 분석 결과는 입력되지 않았습니다.' : null), referenceCode: input.demo ? demoReference : input.referenceCode || null, visibility: input.visibility || 'company', updatedAt: now });
        if (shareIds.length) await tx.insert(projectShares).values(shareIds.map(organizationId=>({projectId,organizationId,createdAt:now})));
        await tx.insert(projectMembers).values([...members].map(([userId,projectRole])=>({projectId,userId,projectRole,createdAt:now,updatedAt:now})));
        const roles = [...new Set(['PM',...(definition.roles ?? [])])];
        await tx.insert(projectRoles).values(roles.map((code,sortOrder)=>({id:randomUUID(),projectId,code,name:code,sortOrder,createdAt:now,updatedAt:now})));
        const ids = new Map(planned.map(row=>[row.id,randomUUID()]));
        await tx.insert(wbsTasks).values(planned.map((row,sortOrder)=>({ id: ids.get(row.id)!, projectId, wbsCode:row.id, parentId:row.parentId?ids.get(row.parentId):null, level:row.level||1, sortOrder, kind:row.kind||'task', name:row.name, durationDays:row.kind==='summary'?0:Math.max(1,row.durationDays), plannedStart:row.plannedStart, plannedEnd:row.plannedEnd, predecessorId:row.predecessor?ids.get(row.predecessor):null, roleCode:row.kind==='summary'?null:row.role||null, assigneeUserId:row.role==='PM'&&row.kind!=='summary'?scope.userId:null, progress:0,status:'planned',completionActor:row.completionActor||'assignee',completionCriteria:row.completionCriteria||'PROGRESS',createdAt:now,updatedAt:now })));
        const outputs = planned.flatMap(row=>row.kind==='summary'?[]:(row.deliverables??[]).map(output=>({id:randomUUID(),projectId,taskId:ids.get(row.id),name:output.name,category:output.type||'GENERAL',required:output.required===false?0:1,status:'planned',documentKind:output.documentKind==='drawing'?'drawing':'document',createdAt:now,updatedAt:now})));
        if (outputs.length) await tx.insert(deliverables).values(outputs);
        await tx.insert(auditLogs).values({id:randomUUID(),companyId:scope.companyId,actorUserId:scope.userId,action:'PROJECT_CREATED',entityType:'PROJECT',entityId:projectId,detail:JSON.stringify({templateVersionId:version.id,demo:Boolean(input.demo),taskCount:planned.length}),createdAt:now});
        return {...project,projectTypeCode:'PRODUCTION',projectTypeName:type.name,templateName:version.name,templateVersion:version.version,reused:false};
      });
    },
  };
}
