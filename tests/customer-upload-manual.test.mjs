import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
test('upload only registers a file and never invokes analysis or Word generation',async()=>{
 const source=fs.readFileSync(new URL('../app/api/projects/[projectId]/customer-data/route.ts',import.meta.url),'utf8');
 let uploads=0;
 const imports={
  '../../../../../services/customer-data-service':{createCustomerDataService:()=>({upload:async()=>{uploads++;return {id:'doc',sourcePurpose:'ttr'}}})},
  '../../../../../lib/customer-data-contract':{MAX_CUSTOMER_FILE_BYTES:50*1024*1024,CustomerDataError:Error},
  './context':{customerDataScope:async()=>({companyId:'c',projectId:'p',userId:'u'}),customerDataError:e=>{throw e}},
 };
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{assert.ok(imports[id],`Upload must not depend on an AI/generation service: ${id}`);return imports[id]},Response});
 const result=await exports.POST({headers:new Headers(),formData:async()=>new FormData()},{params:Promise.resolve({projectId:'p'})});
 assert.equal(result.status,201);assert.equal(uploads,1);assert.equal((await result.json()).record.id,'doc');
});
