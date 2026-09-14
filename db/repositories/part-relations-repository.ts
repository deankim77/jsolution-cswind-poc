import {and,eq,inArray} from 'drizzle-orm';
import {getDb} from '../index';
import {productParts,productBomItems,projectsDb,projectMembers} from '../schema';
import {productionBomRoots,customerBomOccurrences,customerPartIdentities} from '../pbom-schema';
import {customerRawData} from '../customer-data-schema';
import {customerReviews} from '../customer-review-schema';
import {buildPartRelations} from '../../lib/part-relations';
import {CustomerDataError} from '../../lib/customer-data-contract';
type Scope={companyId:string;userId:string;systemRoles:string[]};
export function createPartRelationsRepository(db=getDb()){return {async list(s:Scope,partId:string){
 const [part]=await db.select({id:productParts.id}).from(productParts).where(and(eq(productParts.companyId,s.companyId),eq(productParts.id,partId)));if(!part)throw new CustomerDataError('부품을 찾을 수 없습니다.',404);
 const members=await db.select({projectId:projectMembers.projectId}).from(projectMembers).where(eq(projectMembers.userId,s.userId));
 const admin=s.systemRoles.some(r=>['ADMIN','SUPER_ADMIN','SYSTEM_ADMIN'].includes(r));
 const projects=await db.select({id:projectsDb.id,name:projectsDb.name,code:projectsDb.code}).from(projectsDb).where(and(eq(projectsDb.companyId,s.companyId),admin?undefined:inArray(projectsDb.id,members.map(m=>m.projectId))));
 const ids=projects.map(p=>p.id);if(!ids.length)return {drawings:[],projects:[]};
 const [edges,roots,records,reviews,occurrences,identities]=await Promise.all([
 db.select().from(productBomItems).where(eq(productBomItems.companyId,s.companyId)),
 db.select().from(productionBomRoots).where(and(eq(productionBomRoots.companyId,s.companyId),inArray(productionBomRoots.projectId,ids))),
 db.select({id:customerRawData.id,projectId:customerRawData.projectId,fileName:customerRawData.fileName}).from(customerRawData).where(and(eq(customerRawData.companyId,s.companyId),inArray(customerRawData.projectId,ids))),
 db.select().from(customerReviews).where(and(eq(customerReviews.companyId,s.companyId),inArray(customerReviews.projectId,ids))),
 db.select().from(customerBomOccurrences).where(and(eq(customerBomOccurrences.companyId,s.companyId),inArray(customerBomOccurrences.projectId,ids))),
 db.select().from(customerPartIdentities).where(and(eq(customerPartIdentities.companyId,s.companyId),inArray(customerPartIdentities.projectId,ids)))
 ]);
 return buildPartRelations({partId,edges,roots,records,reviews,occurrences,identities,projects});
}};}
