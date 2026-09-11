import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {createCustomerAnalysisJobs}=require('../services/customer-analysis-jobs.ts');
const {CustomerDataError}=require('../lib/customer-data-contract.ts');
const scope={companyId:'c',projectId:'p',userId:'u',systemRoles:['ADMIN']};
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('analysis returns before AI finishes, deduplicates and survives a new service instance',async()=>{
 let finish,calls=0;
 const raw={access:async()=>({canReview:true}),get:async()=>({})},review={analyze:()=>{calls++;return new Promise(resolve=>{finish=resolve})}},store=new Map();
 const service=createCustomerAnalysisJobs(raw,review,store);
 const job=await service.start(scope,'doc','분석');assert.equal(job.status,'queued');
 assert.equal((await service.start(scope,'doc','분석')).id,job.id);
 await tick();assert.equal(calls,1);
 const reopened=createCustomerAnalysisJobs(raw,review,store);
 assert.equal((await reopened.list(scope))[0].status,'running');
 assert.deepEqual(await reopened.list({...scope,projectId:'other'}),[]);
 finish();await tick();assert.equal((await reopened.list(scope))[0].status,'completed');
});
test('failed jobs expose safe failure and allow explicit retry',async()=>{
 const raw={access:async()=>({canReview:true}),get:async()=>({})};
 const service=createCustomerAnalysisJobs(raw,{analyze:async()=>{throw new CustomerDataError('분석 응답 미완료',422)}},new Map());
 const first=await service.start(scope,'doc','분석');await tick();
 assert.equal((await service.list(scope))[0].status,'failed');assert.equal((await service.list(scope))[0].error,'분석 응답 미완료');
 const retry=await service.start(scope,'doc','다시 분석');assert.notEqual(first.id,retry.id);await tick();
});
test('unauthorized user cannot launch analysis',async()=>{
 const service=createCustomerAnalysisJobs({access:async()=>({canReview:false})},{analyze:()=>assert.fail()},new Map());
 await assert.rejects(service.start(scope,'doc','분석'),e=>e.status===403);
});
