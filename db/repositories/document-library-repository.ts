import {and,desc,eq,inArray,isNull,ne,sql,type SQL} from 'drizzle-orm';
import {getDb} from '../index';
import {deliverableReviews,deliverables as d,deliverableVersions as v,projectsDb as p,users,wbsTasks as w} from '../schema';
import {customerRawData} from '../customer-data-schema';
export function createDocumentLibraryRepository(db=getDb()){
 const drawingIdentity=sql`(${d.documentKind}='drawing' OR (coalesce(${d.drawingCode},'')<>'' AND ${d.category}='DESIGN_DRAWING'))`;
 const fields={id:d.id,projectId:d.projectId,projectCode:p.code,projectName:p.name,taskId:d.taskId,taskCode:w.wbsCode,taskName:w.name,name:d.name,type:d.category,required:d.required,status:d.status,version:d.version,origin:d.origin,documentKind:sql<string>`CASE WHEN ${drawingIdentity} THEN 'drawing' ELSE 'document' END`,drawingCode:d.drawingCode,drawingType:d.drawingType,internalDrawingNumber:d.internalDrawingNumber,customerDrawingNumber:d.customerDrawingNumber,ownerDepartment:d.ownerDepartment,ownerUserId:d.ownerUserId,source:d.source,revisionCount:sql<number>`(SELECT count(*)::int FROM deliverable_versions rv WHERE rv.deliverable_id=${d.id} AND rv.deleted_at IS NULL)`};
 const versionFields={id:v.id,projectId:v.projectId,deliverableId:v.deliverableId,taskId:v.taskId,revision:v.revision,fileName:v.fileName,fileSize:v.fileSize,contentType:v.contentType,note:v.note,sourceDocumentNumber:v.sourceDocumentNumber,sourceRevision:v.sourceRevision,documentType:v.documentType,previewFileKey:v.previewFileKey,conversionStatus:v.conversionStatus,conversionError:v.conversionError,convertedAt:v.convertedAt,createdAt:v.createdAt,createdBy:users.name};
 return {async project(companyId:string,projectId:string,taskId:string|null){
  const rows=await db.select(fields).from(d).innerJoin(p,eq(p.id,d.projectId)).leftJoin(w,eq(w.id,d.taskId)).where(and(eq(p.companyId,companyId),eq(d.projectId,projectId),taskId?eq(d.taskId,taskId):undefined)).orderBy(desc(d.createdAt));
  const ids=rows.map(r=>r.id);
  const versions=ids.length?await db.select(versionFields).from(v).leftJoin(users,eq(users.id,v.createdBy)).where(and(inArray(v.deliverableId,ids),isNull(v.deletedAt))).orderBy(desc(v.revision)):[];
  const r=deliverableReviews;
  const reviews=ids.length?await db.select({id:r.id,deliverableId:r.deliverableId,versionId:r.versionId,action:r.action,note:r.note,reviewedAt:r.reviewedAt,reviewedBy:users.name}).from(r).leftJoin(users,eq(users.id,r.reviewedBy)).where(inArray(r.deliverableId,ids)).orderBy(desc(r.reviewedAt)):[];
  return {deliverables:rows,versions,reviews};
 },async list(companyId:string,params:URLSearchParams){
  const id=params.get('deliverableId');
  if(id){
   const [detail]=await db.select({...fields,
    workflowId:sql<string>`(SELECT id FROM workflow_instances WHERE main_deliverable_id=${d.id} AND status='approved' ORDER BY updated_at DESC LIMIT 1)`,
    workflowNumber:sql<string>`(SELECT workflow_number FROM workflow_instances WHERE main_deliverable_id=${d.id} AND status='approved' ORDER BY updated_at DESC LIMIT 1)`,
    workflowTitle:sql<string>`(SELECT title FROM workflow_instances WHERE main_deliverable_id=${d.id} AND status='approved' ORDER BY updated_at DESC LIMIT 1)`,
    approvedAt:sql<number>`(SELECT updated_at FROM workflow_instances WHERE main_deliverable_id=${d.id} AND status='approved' ORDER BY updated_at DESC LIMIT 1)`,
    finalApprover:sql<string>`(SELECT u.name FROM workflow_history h JOIN users u ON u.id=h.actor_user_id WHERE h.workflow_id=(SELECT id FROM workflow_instances WHERE main_deliverable_id=${d.id} AND status='approved' ORDER BY updated_at DESC LIMIT 1) AND h.next_status='approved' ORDER BY h.created_at DESC LIMIT 1)`
   }).from(d).innerJoin(p,eq(p.id,d.projectId)).leftJoin(w,eq(w.id,d.taskId)).where(and(eq(p.companyId,companyId),eq(d.id,id)));
   if(!detail)return null;
   const versions=await db.select(versionFields).from(v).leftJoin(users,eq(users.id,v.createdBy)).where(and(eq(v.projectId,detail.projectId),eq(v.deliverableId,id),isNull(v.deletedAt))).orderBy(desc(v.revision));
   const [raw]=await db.select({id:customerRawData.id,sourcePurpose:customerRawData.sourcePurpose}).from(customerRawData).where(and(eq(customerRawData.companyId,companyId),eq(customerRawData.deliverableId,id))).orderBy(desc(customerRawData.revision)).limit(1);
   return {deliverable:{...detail,customerRecordId:raw?.id,sourcePurpose:raw?.sourcePurpose},versions};
  }
  const predicates:SQL[]=[eq(p.companyId,companyId)];
  for(const [key,column] of [['projectId',d.projectId],['source',d.source],['category',d.category],['origin',d.origin]] as const){const value=params.get(key);if(value)predicates.push(eq(column,value));}
  const kind=params.get('documentKind');if(kind==='drawing')predicates.push(drawingIdentity);if(kind==='document')predicates.push(sql`NOT ${drawingIdentity}`);
  const registration=params.get('registration');if(registration==='planned')predicates.push(eq(d.status,'planned'));if(registration==='completed')predicates.push(ne(d.status,'planned'));
  const review=params.get('review');if(review)predicates.push(sql`NOT ${drawingIdentity}`,eq(d.status,review==='pending'?'submitted':review));
  const required=params.get('required');if(required)predicates.push(eq(d.required,required==='required'?1:0));
  const q=params.get('q')?.trim().toLowerCase();if(q)predicates.push(sql`lower(concat_ws(' ',${p.code},${p.name},${w.wbsCode},${w.name},${d.name},${d.category},${d.drawingCode},${d.internalDrawingNumber},${d.customerDrawingNumber})) LIKE ${'%'+q+'%'}`);
  const paged=params.has('limit')||params.has('offset'),limit=Math.min(200,Math.max(10,parseInt(params.get('limit')||'50')||50)),offset=Math.max(0,parseInt(params.get('offset')||'0')||0);
  const query=db.select(fields).from(d).innerJoin(p,eq(p.id,d.projectId)).leftJoin(w,eq(w.id,d.taskId)).where(and(...predicates)).orderBy(desc(p.createdAt),sql`CASE ${d.source} WHEN 'planned' THEN 0 ELSE 1 END`,desc(d.createdAt));
  const rows=await (paged?query.limit(limit).offset(offset):query);
  const [count]=await db.select({total:sql<number>`count(*)::int`}).from(d).innerJoin(p,eq(p.id,d.projectId)).leftJoin(w,eq(w.id,d.taskId)).where(and(...predicates));
  const versions=rows.length?await db.select(versionFields).from(v).leftJoin(users,eq(users.id,v.createdBy)).where(and(inArray(v.deliverableId,rows.map(r=>r.id)),isNull(v.deletedAt),sql`${v.revision}=(SELECT max(v2.revision) FROM deliverable_versions v2 WHERE v2.deliverable_id=${v.deliverableId} AND v2.deleted_at IS NULL)`)):[];
  const categories=await db.selectDistinct({category:d.category}).from(d).innerJoin(p,eq(p.id,d.projectId)).where(eq(p.companyId,companyId));
  return {deliverables:rows,versions,total:count.total,limit:paged?limit:count.total,offset:paged?offset:0,hasMore:paged&&offset+rows.length<count.total,categories:categories.map(r=>r.category).filter(Boolean).sort()};
 }};
}
