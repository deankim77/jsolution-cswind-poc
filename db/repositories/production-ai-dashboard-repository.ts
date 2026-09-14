import {and,eq,inArray} from 'drizzle-orm';
import {getDb} from '../index';
import {projectsDb,projectTypes,projectMembers,productBomItems} from '../schema';
import {customerRawData} from '../customer-data-schema';
import {customerReviews,customerConfirmedData} from '../customer-review-schema';
import {customerSuppliedItems} from '../customer-supplied-schema';
import {productionBomRoots,customerPartIdentities} from '../pbom-schema';
import {trrVersions} from '../trr-schema';
import {calculateAiMetrics,type AiProjectMetrics} from '../../lib/production-ai-metrics';
import type {CustomerDataScope} from './customer-data-repository';
export function createProductionAiDashboardRepository(db=getDb()){return {async list(s:CustomerDataScope):Promise<AiProjectMetrics[]>{
 const admin=s.systemRoles.some(r=>['SUPER_ADMIN','ADMIN','SYSTEM_ADMIN'].includes(r));
 const members=admin?[]:await db.select({id:projectMembers.projectId}).from(projectMembers).where(eq(projectMembers.userId,s.userId));
 if(!admin&&!members.length)return [];
 const projects=await db.select({id:projectsDb.id,name:projectsDb.name,code:projectsDb.code}).from(projectsDb).innerJoin(projectTypes,eq(projectsDb.projectTypeId,projectTypes.id)).where(and(eq(projectsDb.companyId,s.companyId),eq(projectTypes.companyId,s.companyId),eq(projectTypes.code,'PRODUCTION'),s.projectId?eq(projectsDb.id,s.projectId):undefined,admin?undefined:inArray(projectsDb.id,members.map(m=>m.id))));
 if(!projects.length)return [];const ids=projects.map(p=>p.id);
 const [records,reviews,confirmed,supplied,roots,identities,edges,reports]=await Promise.all([
 db.select().from(customerRawData).where(and(eq(customerRawData.companyId,s.companyId),inArray(customerRawData.projectId,ids))),
 db.select().from(customerReviews).where(and(eq(customerReviews.companyId,s.companyId),inArray(customerReviews.projectId,ids))),
 db.select().from(customerConfirmedData).where(and(eq(customerConfirmedData.companyId,s.companyId),inArray(customerConfirmedData.projectId,ids))),
 db.select().from(customerSuppliedItems).where(and(eq(customerSuppliedItems.companyId,s.companyId),inArray(customerSuppliedItems.projectId,ids))),
 db.select().from(productionBomRoots).where(and(eq(productionBomRoots.companyId,s.companyId),inArray(productionBomRoots.projectId,ids))),
 db.select().from(customerPartIdentities).where(and(eq(customerPartIdentities.companyId,s.companyId),inArray(customerPartIdentities.projectId,ids))),
 db.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId)),
 db.select().from(trrVersions).where(and(eq(trrVersions.companyId,s.companyId),inArray(trrVersions.projectId,ids))),
 ]);
 return projects.map(p=>{const root=roots.find(r=>r.projectId===p.id),parts=new Set<string>(),visited=new Set<string>();const walk=(id:string)=>{if(visited.has(id))return;visited.add(id);for(const edge of edges.filter(e=>e.parentPartId===id)){if(edge.childPartId!==root?.rootPartId)parts.add(edge.childPartId);walk(edge.childPartId);}};if(root)walk(root.rootPartId);const versions=reports.filter(r=>r.projectId===p.id).sort((a,b)=>b.version-a.version);return {...p,metrics:calculateAiMetrics({records:records.filter(r=>r.projectId===p.id),reviews:reviews.filter(r=>r.projectId===p.id),confirmed:confirmed.filter(r=>r.projectId===p.id),supplied:supplied.filter(r=>r.projectId===p.id),report:versions[0]?.document,reports:versions.length,newParts:identities.filter(r=>r.projectId===p.id).map(r=>r.partId),parts:[...parts]})};});
 }};}
