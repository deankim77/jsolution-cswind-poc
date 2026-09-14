import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {PGlite}=require('@electric-sql/pglite'),{drizzle}=require('drizzle-orm/pglite');
let pg,db;
const indexPath=require.resolve('../db/index.ts');require.cache[indexPath]={id:indexPath,filename:indexPath,loaded:true,exports:{getDb:()=>db}};
const scope={companyId:'c',projectId:'p',userId:'u',systemRoles:['ADMIN']};
const migration=fs.readFileSync('drizzle-postgres/0019_customer_deliverables.sql','utf8');
const raw=(id)=>({id,title:'customer drawing',documentType:'other',impactTarget:'unclassified',fileKey:`files/${id}.pdf`,fileName:`${id}.pdf`,fileSize:20,checksum:id,note:null,intakeGroup:'unclassified',sourcePurpose:'bom'});
const {createCustomerDataRepository}=require('../db/repositories/customer-data-repository.ts');
const {createCustomerDocumentRepository}=require('../db/repositories/customer-document-repository.ts');
const {createDocumentLibraryRepository}=require('../db/repositories/document-library-repository.ts');
const {createCustomerDataDeleteRepository}=require('../db/repositories/customer-data-delete-repository.ts');
const {syncCustomerDocumentType}=require('../db/repositories/customer-document-link.ts');
const draft={documentType:'drawing',documentTypeConfirmed:true,drawingNumber:'C-100',revisionLabel:'R02',summary:'',items:[],uncertainties:[]};
async function seed(){
 await pg.exec(`INSERT INTO companies(id,name,code,created_at,updated_at) VALUES('c','C','C',1,1);
 INSERT INTO users(id,company_id,email,name,created_at,updated_at) VALUES('u','c','u@test.local','U',1,1);
 INSERT INTO templates(id,company_id,code,name,created_at,updated_at) VALUES('t','c','T','T',1,1);
 INSERT INTO template_versions(id,template_id,version,definition,created_by,created_at,updated_at) VALUES('tv','t','1','{}','u',1,1);
 INSERT INTO project_types(id,company_id,code,name,created_at,updated_at) VALUES('pt','c','PRODUCTION','Production',1,1);
 INSERT INTO projects(id,company_id,template_version_id,code,name,start_date,end_date,template_snapshot,project_type_id,created_at,updated_at) VALUES('p','c','tv','P','Project','2026-01-01','2026-12-31','{}','pt',1,1);`);
}
test('customer formal documents: migration, shared revision, classification, scope and deletion',async t=>{
 const initial=new PGlite();await initial.exec('CREATE DATABASE jsolution_cswind_poc');const dump=await initial.dumpDataDir();await initial.close();
 pg=new PGlite({database:'jsolution_cswind_poc',loadDataDir:dump});db=drizzle(pg);
 try{
 const entries=JSON.parse(fs.readFileSync('drizzle-postgres/meta/_journal.json')).entries;
 for(const e of entries.filter(e=>e.idx<19))await pg.exec(fs.readFileSync(`drizzle-postgres/${e.tag}.sql`,'utf8'));
 await seed();
 await pg.exec(`INSERT INTO customer_raw_data(id,company_id,project_id,raw_data_id,revision,title,document_type,impact_target,file_key,file_name,file_size,checksum,created_by,created_at)
 VALUES('old1','c','p','raw-old',1,'Original','other','unclassified','old1.pdf','old1.pdf',20,'a','u',1),('old2','c','p','raw-old',2,'Original','other','unclassified','old2.pdf','old2.pdf',20,'b','u',2);
 INSERT INTO customer_reviews(record_id,company_id,project_id,version,draft,messages,updated_by,updated_at) VALUES('old2','c','p',1,'${JSON.stringify(draft)}','[]','u',2);`);
 await pg.exec(migration);
 const repo=createCustomerDataRepository(db),library=createDocumentLibraryRepository(db),documents=createCustomerDocumentRepository(db),deletion=createCustomerDataDeleteRepository(db);
 await t.test('backfill preserves source IDs and analysis, groups revisions under one document',async()=>{
  const rows=(await repo.list(scope)).records;assert.equal(rows.length,2);assert.equal(rows[0].deliverableId,rows[1].deliverableId);assert.notEqual(rows[0].deliverableVersionId,rows[1].deliverableVersionId);
  const detail=await library.list('c',new URLSearchParams({deliverableId:rows[0].deliverableId}));assert.equal(detail.versions.length,2);assert.equal(detail.deliverable.origin,'customer');assert.equal(detail.deliverable.documentKind,'drawing');assert.equal(detail.versions[0].sourceRevision,'R02');assert.equal((await pg.query('SELECT count(*)::int n FROM customer_reviews')).rows[0].n,1);
 });
 let first,second;
 await t.test('upload creates one formal document; repeat import is idempotent; revision reuses document',async()=>{
  first=await repo.create(scope,raw('new1'),undefined,undefined,true);
  const duplicate=await repo.create(scope,{...raw('duplicate'),checksum:'new1'},undefined,undefined,true);assert.equal(duplicate.id,first.id);
  second=await repo.create(scope,raw('new2'),first.id);
  assert.equal(second.deliverableId,first.deliverableId);assert.equal(second.revision,2);
  const detail=await library.list('c',new URLSearchParams({deliverableId:first.deliverableId}));assert.equal(detail.versions.length,2);
  await assert.rejects(repo.create(scope,raw('stale'),first.id),/최신/);
 });
 await t.test('confirmed drawing type updates same formal document and does not duplicate it',async()=>{
  await db.transaction(tx=>syncCustomerDocumentType(tx,scope,second.id,draft));
  const detail=await library.list('c',new URLSearchParams({deliverableId:first.deliverableId}));assert.equal(detail.deliverable.documentKind,'drawing');assert.equal(detail.deliverable.customerDrawingNumber,'C-100');assert.match(detail.deliverable.drawingCode,/DWG-/);assert.equal(detail.versions[0].sourceRevision,'R02');
  await db.transaction(tx=>syncCustomerDocumentType(tx,scope,first.id,{...draft,documentType:'other'}));
  assert.equal((await library.list('c',new URLSearchParams({deliverableId:first.deliverableId}))).deliverable.documentKind,'drawing');
 });
 await t.test('shared metadata can save without WBS; foreign company cannot read document',async()=>{
  await documents.update(scope,first.deliverableId,{name:'Updated name',taskId:'',category:'',required:false});
  assert.equal((await repo.list(scope)).records.find(r=>r.id===first.id).title,'Updated name');
  assert.equal(await library.list('foreign',new URLSearchParams({deliverableId:first.deliverableId})),null);
  assert.equal((await library.list('c',new URLSearchParams({origin:'internal'}))).total,0);
 });
 await t.test('applied source cannot be deleted from either entrypoint',async()=>{
  await pg.query(`INSERT INTO customer_confirmed_data(id,company_id,project_id,record_id,version,item_id,item,confirmed_by,confirmed_at) VALUES('cf','c','p',$1,1,'i','{}','u',1)`,[second.id]);
  await assert.rejects(deletion.remove(scope,[second.id]),/반영을 취소/);
  assert.equal((await library.list('c',new URLSearchParams({deliverableId:first.deliverableId}))).versions.length,2);
  await pg.exec("DELETE FROM customer_confirmed_data WHERE id='cf'");
 });
 await t.test('unapplied revision deletion restores earlier file and removes final empty document',async()=>{
  await deletion.remove(scope,[second.id]);const detail=await library.list('c',new URLSearchParams({deliverableId:first.deliverableId}));assert.equal(detail.versions.length,1);assert.equal(detail.versions[0].fileName,'new1.pdf');
  await deletion.remove(scope,[first.id]);assert.equal(await library.list('c',new URLSearchParams({deliverableId:first.deliverableId})),null);
 });
 }finally{await pg.close();}
});
