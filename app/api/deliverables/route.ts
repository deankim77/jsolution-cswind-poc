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
import {createDocumentLibraryService} from '../../../services/document-library-service';
export async function GET(request:Request){
 try{
  const db=await runtimeDb();await ensureCompatibilityOnce(db);
  const context=await resolveRequestContext(request,db);
  const data=await createDocumentLibraryService().list(context.companyId,new URL(request.url).searchParams);
  return data?Response.json(data,{headers:{'Cache-Control':'no-store'}}):Response.json({error:'문서를 찾을 수 없습니다.'},{status:404});
 }catch(reason){return contextErrorResponse(reason)??Response.json({error:'문서 정보를 불러오지 못했습니다.'},{status:500});}
}
