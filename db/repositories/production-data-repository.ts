import {randomUUID} from 'node:crypto';
import {and,eq} from 'drizzle-orm';
import {getDb} from '../index';
import {auditLogs,wbsTasks} from '../schema';
import {customerRawData} from '../customer-data-schema';
import {productionAssignments} from '../production-schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {CustomerDataError} from '../../lib/customer-data-contract';
export function createProductionDataRepository(db=getDb()) {
  return {
    async list(scope:CustomerDataScope) {
      await customerDataAccess(db,scope);
      const nodes=await db.select({id:wbsTasks.id,code:wbsTasks.wbsCode,name:wbsTasks.name,parentId:wbsTasks.parentId,kind:wbsTasks.kind,level:wbsTasks.level}).from(wbsTasks).where(eq(wbsTasks.projectId,scope.projectId)).orderBy(wbsTasks.sortOrder);
      const assignments=await db.select({recordId:productionAssignments.recordId,taskId:productionAssignments.taskId,wbsCode:wbsTasks.wbsCode,confirmedBy:productionAssignments.confirmedBy,confirmedAt:productionAssignments.confirmedAt}).from(productionAssignments).innerJoin(wbsTasks,eq(wbsTasks.id,productionAssignments.taskId)).where(and(eq(productionAssignments.projectId,scope.projectId),eq(productionAssignments.companyId,scope.companyId)));
      return {nodes,assignments};
    },
    async assign(scope:CustomerDataScope,recordId:string,codes:string[]) {
      return db.transaction(async tx=>{
        const access=await customerDataAccess(tx,scope,true);
        if(!access.canReview)throw new CustomerDataError('PM 또는 PL만 공정 할당을 확정할 수 있습니다.',403);
        const [record]=await tx.select().from(customerRawData).where(and(eq(customerRawData.id,recordId),eq(customerRawData.projectId,scope.projectId),eq(customerRawData.companyId,scope.companyId)));
        if(!record)throw new CustomerDataError('원본 자료를 찾을 수 없습니다.',404);
        const nodes=await tx.select().from(wbsTasks).where(eq(wbsTasks.projectId,scope.projectId));
        if(codes.some(code=>!nodes.some(node=>node.wbsCode===code&&node.kind==='summary')))throw new CustomerDataError('이 프로젝트의 공정 또는 ASSY를 선택하세요.');
        await tx.delete(productionAssignments).where(and(eq(productionAssignments.recordId,recordId),eq(productionAssignments.projectId,scope.projectId)));
        const now=Math.floor(Date.now()/1000);
        if(codes.length)await tx.insert(productionAssignments).values(codes.map(wbsCode=>({companyId:scope.companyId,projectId:scope.projectId,recordId,taskId:nodes.find(node=>node.wbsCode===wbsCode)!.id,confirmedBy:scope.userId,confirmedAt:now})));
        await tx.insert(auditLogs).values({id:randomUUID(),companyId:scope.companyId,actorUserId:scope.userId,action:'PRODUCTION_DATA_ASSIGNED',entityType:'CUSTOMER_RAW_DATA',entityId:recordId,detail:JSON.stringify({projectId:scope.projectId,wbsCodes:codes}),createdAt:now});
        return {ok:true};
      });
    },
  };
}
