import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
import {ensureProjectDataFoundation,type RuntimeD1} from "../../../db/project-data-foundation";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";
import {ensureWorkflowFoundation} from "../../../db/workflow-foundation";

type D1=RuntimeD1;
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}

let compatibilityReady:Promise<void>|null=null;
async function ensureCompatibility(db:D1){
  await ensureProjectDataFoundation(db);await ensureWorkflowFoundation(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS deliverable_versions (id TEXT PRIMARY KEY NOT NULL,project_id TEXT NOT NULL,deliverable_id TEXT NOT NULL,task_id TEXT,revision INTEGER NOT NULL,file_key TEXT NOT NULL,file_name TEXT NOT NULL,file_size INTEGER NOT NULL DEFAULT 0,content_type TEXT,note TEXT,created_by TEXT,created_at INTEGER NOT NULL)`).run();
  for(const sql of ["ALTER TABLE deliverable_versions ADD COLUMN deleted_at INTEGER","ALTER TABLE deliverable_versions ADD COLUMN preview_file_key TEXT","ALTER TABLE deliverable_versions ADD COLUMN conversion_status TEXT","ALTER TABLE deliverable_versions ADD COLUMN conversion_error TEXT","ALTER TABLE deliverable_versions ADD COLUMN converted_at INTEGER","ALTER TABLE deliverables ADD COLUMN source TEXT NOT NULL DEFAULT 'planned'","ALTER TABLE deliverables ADD COLUMN document_kind TEXT NOT NULL DEFAULT 'document'","ALTER TABLE deliverables ADD COLUMN drawing_code TEXT","ALTER TABLE deliverables ADD COLUMN drawing_company_id TEXT","ALTER TABLE deliverables ADD COLUMN drawing_type TEXT","ALTER TABLE deliverables ADD COLUMN internal_drawing_number TEXT","ALTER TABLE deliverables ADD COLUMN customer_drawing_number TEXT","ALTER TABLE deliverables ADD COLUMN owner_department TEXT","ALTER TABLE deliverables ADD COLUMN owner_user_id TEXT"]){try{await db.prepare(sql).run()}catch{}}
  await db.prepare("DROP INDEX IF EXISTS deliverables_drawing_code_uq").run();
  await Promise.all([
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS deliverables_drawing_company_code_uq ON deliverables(drawing_company_id,drawing_code) WHERE drawing_code IS NOT NULL").run(),
    db.prepare("CREATE INDEX IF NOT EXISTS deliverable_versions_deliverable_revision_idx ON deliverable_versions(deliverable_id,revision DESC)").run(),
    db.prepare("CREATE INDEX IF NOT EXISTS deliverables_project_status_created_idx ON deliverables(project_id,status,created_at DESC)").run(),
    db.prepare("CREATE INDEX IF NOT EXISTS deliverables_project_category_idx ON deliverables(project_id,category)").run(),
    db.prepare("CREATE INDEX IF NOT EXISTS workflow_instances_main_deliverable_status_idx ON workflow_instances(main_deliverable_id,status,updated_at DESC)").run(),
  ]);
}
const ensureCompatibilityOnce=(db:D1)=>compatibilityReady??=(ensureCompatibility(db).catch(reason=>{compatibilityReady=null;throw reason}));
const positiveInt=(value:string|null,fallback:number)=>{const parsed=Number.parseInt(value||"",10);return Number.isFinite(parsed)&&parsed>=0?parsed:fallback};
const versionSelect=`SELECT v.id,v.project_id AS projectId,v.deliverable_id AS deliverableId,v.task_id AS taskId,v.revision,v.file_name AS fileName,v.file_size AS fileSize,v.content_type AS contentType,v.note,v.preview_file_key AS previewFileKey,v.conversion_status AS conversionStatus,v.conversion_error AS conversionError,v.converted_at AS convertedAt,v.created_at AS createdAt,u.name AS createdBy FROM deliverable_versions v JOIN projects p ON p.id=v.project_id LEFT JOIN users u ON u.id=v.created_by`;
const drawingIdentitySql="(COALESCE(d.document_kind,'document')='drawing' OR (COALESCE(d.drawing_code,'')<>'' AND COALESCE(d.category,'')='DESIGN_DRAWING'))";
const documentKindSelect=`CASE WHEN ${drawingIdentitySql} THEN 'drawing' ELSE 'document' END`;

export async function GET(request:Request){
  const db=await runtimeDb();await ensureCompatibilityOnce(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const url=new URL(request.url),deliverableId=url.searchParams.get("deliverableId")?.trim()||"";
  if(deliverableId){
    const [detail,versions]=await Promise.all([
      db.prepare(`SELECT d.id,d.project_id AS projectId,p.code AS projectCode,p.name AS projectName,d.task_id AS taskId,w.wbs_code AS taskCode,w.name AS taskName,d.name,d.category AS type,d.required,d.status,d.version,${documentKindSelect} AS documentKind,d.drawing_code AS drawingCode,d.drawing_type AS drawingType,d.internal_drawing_number AS internalDrawingNumber,d.customer_drawing_number AS customerDrawingNumber,d.owner_department AS ownerDepartment,d.owner_user_id AS ownerUserId,COALESCE(d.source,'planned') AS source,wf.id AS workflowId,wf.workflow_number AS workflowNumber,wf.title AS workflowTitle,wf.updated_at AS approvedAt,(SELECT u2.name FROM workflow_history h2 JOIN users u2 ON u2.id=h2.actor_user_id WHERE h2.workflow_id=wf.id AND h2.next_status='approved' ORDER BY h2.created_at DESC LIMIT 1) AS finalApprover,(SELECT COUNT(*) FROM deliverable_versions rv WHERE rv.deliverable_id=d.id AND rv.deleted_at IS NULL) AS revisionCount FROM deliverables d JOIN projects p ON p.id=d.project_id LEFT JOIN wbs_tasks w ON w.id=d.task_id LEFT JOIN workflow_instances wf ON wf.id=(SELECT wf2.id FROM workflow_instances wf2 WHERE wf2.main_deliverable_id=d.id AND wf2.status='approved' ORDER BY wf2.updated_at DESC LIMIT 1) WHERE p.company_id=? AND d.id=?`).bind(context.companyId,deliverableId).first(),
      db.prepare(`${versionSelect} WHERE p.company_id=? AND v.deliverable_id=? AND v.deleted_at IS NULL ORDER BY v.revision DESC`).bind(context.companyId,deliverableId).all(),
    ]);
    if(!detail)return Response.json({error:"문서를 찾을 수 없습니다."},{status:404});
    return Response.json({deliverable:detail,versions:versions.results??[]});
  }

  const projectId=url.searchParams.get("projectId")?.trim()||"",q=(url.searchParams.get("q")||"").trim().toLowerCase(),registration=url.searchParams.get("registration")||"all",review=url.searchParams.get("review")||"",required=url.searchParams.get("required")||"",source=url.searchParams.get("source")||"",category=url.searchParams.get("category")||"",documentKind=url.searchParams.get("documentKind")||"";
  const paged=url.searchParams.has("limit")||url.searchParams.has("offset"),limit=Math.min(200,Math.max(10,positiveInt(url.searchParams.get("limit"),50))),offset=positiveInt(url.searchParams.get("offset"),0);
  const filters=["p.company_id=?"],binds:unknown[]=[context.companyId];
  if(projectId){filters.push("d.project_id=?");binds.push(projectId)}
  if(documentKind==="drawing")filters.push(drawingIdentitySql);else if(documentKind==="document")filters.push(`NOT ${drawingIdentitySql}`);
  if(registration==="planned")filters.push("d.status='planned'");else if(registration==="completed")filters.push("d.status<>'planned'");
  if(review){filters.push(review==="pending"?`NOT ${drawingIdentitySql} AND d.status='submitted'`:`NOT ${drawingIdentitySql} AND d.status=?`);if(review!=="pending")binds.push(review)}
  if(required){filters.push("d.required=?");binds.push(required==="required"?1:0)}
  if(source){filters.push("COALESCE(d.source,'planned')=?");binds.push(source)}
  if(category){filters.push("COALESCE(d.category,'')=?");binds.push(category)}
  if(q){filters.push(`LOWER(COALESCE(p.code,'')||' '||COALESCE(p.name,'')||' '||COALESCE(w.wbs_code,'')||' '||COALESCE(w.name,'')||' '||COALESCE(d.name,'')||' '||COALESCE(d.category,'')||' '||COALESCE(d.drawing_code,'')||' '||COALESCE(d.internal_drawing_number,'')||' '||COALESCE(d.customer_drawing_number,'')) LIKE ?`);binds.push(`%${q}%`)}
  const where=filters.join(" AND ");
  const baseFrom="FROM deliverables d JOIN projects p ON p.id=d.project_id LEFT JOIN wbs_tasks w ON w.id=d.task_id";
  const orderSql="ORDER BY p.created_at DESC,CASE COALESCE(d.source,'planned') WHEN 'planned' THEN 0 ELSE 1 END,d.created_at DESC";
  const listSql=`SELECT d.id,d.project_id AS projectId,p.code AS projectCode,p.name AS projectName,d.task_id AS taskId,w.wbs_code AS taskCode,w.name AS taskName,d.name,d.category AS type,d.required,d.status,d.version,${documentKindSelect} AS documentKind,d.drawing_code AS drawingCode,d.drawing_type AS drawingType,d.internal_drawing_number AS internalDrawingNumber,d.customer_drawing_number AS customerDrawingNumber,d.owner_department AS ownerDepartment,d.owner_user_id AS ownerUserId,COALESCE(d.source,'planned') AS source,(SELECT COUNT(*) FROM deliverable_versions rv WHERE rv.deliverable_id=d.id AND rv.deleted_at IS NULL) AS revisionCount ${baseFrom} WHERE ${where} ${orderSql}${paged?" LIMIT ? OFFSET ?":""}`;
  const listBinds=paged?[...binds,limit,offset]:binds;
  const pageIdsSql=`SELECT d.id ${baseFrom} WHERE ${where} ${orderSql}${paged?" LIMIT ? OFFSET ?":""}`;
  const latestSql=`SELECT v.id,v.project_id AS projectId,v.deliverable_id AS deliverableId,v.task_id AS taskId,v.revision,v.file_name AS fileName,v.file_size AS fileSize,v.content_type AS contentType,v.note,v.preview_file_key AS previewFileKey,v.conversion_status AS conversionStatus,v.conversion_error AS conversionError,v.converted_at AS convertedAt,v.created_at AS createdAt,u.name AS createdBy FROM deliverable_versions v LEFT JOIN users u ON u.id=v.created_by WHERE v.deliverable_id IN (${pageIdsSql}) AND v.deleted_at IS NULL AND v.revision=(SELECT MAX(v2.revision) FROM deliverable_versions v2 WHERE v2.deliverable_id=v.deliverable_id AND v2.deleted_at IS NULL) ORDER BY v.deliverable_id`;
  const [slots,versions,countRow,facets]=await Promise.all([
    db.prepare(listSql).bind(...listBinds).all(),
    db.prepare(latestSql).bind(...listBinds).all(),
    db.prepare(`SELECT COUNT(*) AS total ${baseFrom} WHERE ${where}`).bind(...binds).first<{total:number}>(),
    db.prepare(`SELECT GROUP_CONCAT(DISTINCT d.category) AS categories FROM deliverables d JOIN projects p ON p.id=d.project_id WHERE p.company_id=?`).bind(context.companyId).first<{categories?:string}>(),
  ]);
  const total=Number(countRow?.total||0);
  const categories=String(facets?.categories||"").split(",").map(value=>value.trim()).filter(Boolean).sort();
  return Response.json({deliverables:slots.results??[],versions:versions.results??[],total,limit:paged?limit:total,offset:paged?offset:0,hasMore:paged?offset+(slots.results?.length||0)<total:false,categories});
}
