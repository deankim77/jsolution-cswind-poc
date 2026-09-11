import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';

const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {requestCustomerReview}=require('../services/customer-review-provider.ts');
const {CustomerDataError}=require('../lib/customer-data-contract.ts');

function setup(t){
 const previous=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='test-key';
 t.after(()=>{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;});
 const controller=new AbortController();
 t.mock.method(AbortSignal,'timeout',ms=>{assert.equal(ms,300000);return controller.signal;});
 return controller;
}
const isTimeout=error=>error instanceof CustomerDataError&&error.status===504&&error.message.includes('5분')&&error.message.includes('저장되지 않았습니다');

test('analysis accepts a completed response with a five-minute budget',async t=>{
 const controller=setup(t);
 const result={answer:'부품 연결 관계는 도면에서 명확하지 않습니다.'};
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.equal(init.signal,controller.signal);
  assert.equal(JSON.parse(init.body).max_output_tokens,4000);
  return Response.json({output:[{content:[{type:'output_text',text:result.answer}]}]});
 });
 assert.deepEqual(await requestCustomerReview('분석',[]),result);
});
test('request timeout reports an actionable 504 instead of a generic 500',async t=>{
 const controller=setup(t);
 t.mock.method(globalThis,'fetch',async()=>{controller.abort(new DOMException('Timeout','TimeoutError'));throw controller.signal.reason;});
 await assert.rejects(requestCustomerReview('분석',[]),isTimeout);
});
test('timeout while reading the response body also reports 504',async t=>{
 const controller=setup(t);
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>{controller.abort(new DOMException('Timeout','TimeoutError'));throw new DOMException('Aborted','AbortError');}}));
 await assert.rejects(requestCustomerReview('분석',[]),isTimeout);
});
test('unrelated connection errors are not mislabeled as timeouts',async t=>{
 setup(t);
 const error=new Error('connection failed');
 t.mock.method(globalThis,'fetch',async()=>{throw error;});
 await assert.rejects(requestCustomerReview('분석',[]),value=>value===error);
});
test('empty and incomplete AI responses remain rejected',async t=>{
 setup(t);
 const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({status:'incomplete'}));
 await assert.rejects(requestCustomerReview('분석',[]),error=>error.status===422);
 fetch.mock.mockImplementation(async()=>Response.json({output_text:''}));
 await assert.rejects(requestCustomerReview('분석',[]),error=>error.status===422);
});

test('PBOM analysis parses JSON while ordinary explanations stay plain text',async t=>{
 setup(t);
 const draft={documentType:'drawing',revisionLabel:'V02',items:[]};
 t.mock.method(globalThis,'fetch',async(url,init)=>{const body=JSON.parse(init.body);assert.equal(body.max_output_tokens,10000);assert.equal(body.reasoning.effort,'minimal');return Response.json({output_text:JSON.stringify({answer:'추출',draft})});});
 assert.deepEqual(await requestCustomerReview('파트리스트',[],true),{answer:'추출',draft});
});
