import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
function load(path,dependencies,extra=''){
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8')+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name=>{if(name in dependencies)return dependencies[name];throw Error(name)},m,m.exports);
 return m.exports;
}
const {translateSql,restoreLegacyAliases}=load('../db/postgres-d1-compat.ts',{'./index':{}},'\nexport {translateSql,restoreLegacyAliases};');
function route(db){return load('../app/api/search/route.ts',{
 '../../../db/postgres-d1-compat':{getLegacyDbCompat:()=>db},
 '../../../db/project-data-foundation':{ensureProjectDataFoundation:async()=>{}},
 '../../../db/request-context':{resolveRequestContext:async()=>({companyId:'company',userId:'user'}),contextErrorResponse:()=>null},
});}
test('PostgreSQL search executes every scope and finds project, stage, owner and document file',async()=>{
 const pg=new PGlite();
 try{
  const schema=require('../db/schema.ts'),{getTableConfig}=require('drizzle-orm/pg-core');
  // Match production column names/types; fixtures omit unrelated required values.
  for(const table of Object.values(schema)){
   const config=getTableConfig(table);
   await pg.exec(`CREATE TABLE "${config.name}" (${config.columns.map(c=>`"${c.name}" ${c.getSQLType()}`).join(',')})`);
  }
  await pg.exec(`INSERT INTO projects(id,company_id,code,name,status) VALUES ('p','company','T800','T800 생산 프로젝트','active'),('other','other-company','T800','T800 hidden','active');
   INSERT INTO users(id,company_id,name,email,status) VALUES ('user','company','Dean Kim','dean@example.test','active');
   INSERT INTO project_members(project_id,user_id,project_role) VALUES ('p','user','PM');
   INSERT INTO wbs_tasks(id,project_id,wbs_code,task_type,kind,name,progress,status) VALUES ('task','p','P1-REVIEW','gate','task','Assembly',0,'active');
   INSERT INTO deliverables(id,project_id,name,status) VALUES ('doc','p','Drawing','submitted');
   INSERT INTO deliverable_versions(id,deliverable_id,file_name) VALUES ('v','doc','JIB-ASSY.png');`);
  const db={prepare:sql=>({bind:(...values)=>({all:async()=>({results:restoreLegacyAliases(sql,(await pg.query(translateSql(sql,values),values)).rows)})})})};
  const {GET}=route(db);
  for(const [q,kind,id] of [['T800','project','p'],['P1','project','p'],['Dean','project','p'],['JIB-ASSY','document','doc']]){
   const response=await GET(new Request(`http://localhost/api/search?q=${encodeURIComponent(q)}`));
   assert.equal(response.status,200);
   const data=await response.json();
   assert.ok(data.results.some(r=>r.kind===kind&&r.id===id),q);
   assert.ok(!data.results.some(r=>r.id==='other'));
   if(q==='T800')assert.equal(data.results.find(r=>r.id==='p').projectId,'p');
  }
  const empty=await (await GET(new Request('http://localhost/api/search?q=nonexistent-xyz'))).json();
  assert.deepEqual(empty.results,[]);
 }finally{await pg.close()}
});
test('database failure returns HTTP 500 rather than empty successful results',async()=>{
 const {GET}=route({prepare:()=>{throw Error('unavailable')}});
 const original=console.error;console.error=()=>{};
 try{
  const response=await GET(new Request('http://localhost/api/search?q=T800'));
  assert.equal(response.status,500);
  assert.deepEqual(await response.json(),{error:'검색 중 오류가 발생했습니다.'});
 }finally{console.error=original}
});
