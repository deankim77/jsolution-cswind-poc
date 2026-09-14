import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';

function route(name,{role='PM',assignee='other',failure=false,denied=false}={}){
 const writes=[],errors=[];
 const db={prepare(sql){return {sql,values:[],bind(...values){this.values=values;return this;},async run(){},async first(){
  if(sql.includes('FROM projects'))return {id:'project',status:'active',companyId:'company'};
  if(sql.includes('FROM wbs_tasks'))return {id:'task',kind:'task',status:'active',progress:0,assigneeUserId:assignee};
  return null;
 },async all(){
  if(sql.includes('PRAGMA'))return {results:[{name:'avatar_key'}]};
  if(sql.includes('FROM project_members pm')){
   if(failure)throw Error('database unavailable');
   // PostgreSQL requires each selected non-aggregate column in GROUP BY.
   assert.match(sql,/GROUP BY pm.user_id,u.name,u.email,u.avatar_key,pm.project_role/);
   return {results:[{userId:'actor',projectRole:'PM',assignedTaskCount:2}]};
  }
  return {results:[]};
 }};},async batch(items){writes.push(...items);return [];}};
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../app/api/projects/[projectId]/${name}/route.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,Response,crypto:webcrypto,console:{error(...args){errors.push(args);}},require(path){
   if(path.includes('postgres-d1-compat'))return {getLegacyDbCompat:()=>db};
   if(path.includes('project-data-foundation'))return {ensureProjectDataFoundation:async()=>{}};
   if(path.includes('request-context'))return {resolveRequestContext:async()=>({userId:'actor',companyId:'company'}),requireProjectAccess:async()=>{if(denied)throw Error('forbidden');return {projectRole:role,isAdmin:false};},contextErrorResponse:reason=>reason.message==='forbidden'?Response.json({error:'forbidden'},{status:403}):null,canManageProject:()=>false};
   throw Error(path);
  }
 });
 return {exports,writes,errors};
}
const params={params:Promise.resolve({projectId:'project'})};
test('members retain PM and task count on successful lookup',async()=>{
 const h=route('members');const res=await h.exports.GET(new Request('http://local/members'),params);
 assert.equal(res.status,200);assert.equal((await res.json()).members[0].assignedTaskCount,2);
});
test('members database failure returns JSON error, never a successful empty list',async()=>{
 const h=route('members',{failure:true});const res=await h.exports.GET(new Request('http://local/members'),params);
 assert.equal(res.status,500);const body=await res.json();assert.ok(body.error);assert.equal(body.members,undefined);assert.equal(h.errors.length,1);
});
for(const [label,options,status] of [
 ['project PM',{role:'PM'},200],['assignee',{role:'MEMBER',assignee:'actor'},200],
 ['unassigned PL',{role:'PL'},403],['unassigned member',{role:'MEMBER'},403],['outside project',{denied:true},403],
])test(`actual update: ${label}`,async()=>{
 const h=route('actuals',options);const res=await h.exports.POST(new Request('http://local/actuals',{method:'POST',body:JSON.stringify({taskId:'task',progress:50})}),params);
 assert.equal(res.status,status);
 const actual=h.writes.find(item=>item.sql.startsWith('INSERT INTO task_actuals'));
 if(status===200){assert.equal(actual.values[3],'actor');assert.equal(actual.values[6],50);}
 else assert.equal(actual,undefined);
});
