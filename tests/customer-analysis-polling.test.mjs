import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual hook with controlled hooks, requests and timers.
function harness(responses){
 const slots=[],effects=[],timers=new Map(),requests=[];let cursor=0,nextTimer=0,result,dirty=false;
 const changed=(a,b)=>!a||a.length!==b.length||a.some((v,i)=>v!==b[i]);
 const react={
  useRef(value){const i=cursor++;return slots[i]??= {current:value};},
  useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],v=>{const next=typeof v==='function'?v(slots[i]):v;if(next!==slots[i]){slots[i]=next;dirty=true;}}];},
  useCallback(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps))slots[i]={fn,deps};return slots[i].fn;},
  useEffect(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 let completed=0;
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../app/v2/use-customer-analysis-jobs.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports:module.exports,require(name){if(name==='react')return react;if(name.includes('read-api-json'))return {readApiJson:async r=>r.data};if(name.includes('customer-analysis-job'))return {isAnalysisPending:j=>j?.status==='queued'||j?.status==='running'};throw Error(name);},Error,AbortController,Date,fetch:async(url,options={})=>{requests.push(options.method||'GET');const next=responses.shift();if(next instanceof Error)throw next;assert.ok(next,'Unexpected request');return {ok:true,data:next};},setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)});
 const render=()=>{cursor=0;dirty=false;result=module.exports.useCustomerAnalysisJobs('/doc',()=>{completed++;});while(effects.length)effects.shift()();};
 const flush=async()=>{for(let i=0;i<12;i++){await Promise.resolve();if(dirty)render();}};
 render();
 return {requests,timers,flush,get result(){return result;},get completed(){return completed;},async tick(){const work=[...timers.values()];timers.clear();for(const fn of work)fn();await flush();}};
}
const job=status=>({id:'job1',recordId:'doc1',status,startedAt:1});
test('idle mount checks once and does not keep polling',async()=>{
 const h=harness([{jobs:[]}]);await h.flush();assert.equal(h.requests.length,1);assert.equal(h.timers.size,0);
});
test('running job polls until completion then stops',async()=>{
 const h=harness([{jobs:[job('running')]},{jobs:[job('completed')]}]);await h.flush();assert.equal(h.timers.size,1);await h.tick();assert.equal(h.requests.length,2);assert.equal(h.timers.size,0);assert.equal(h.completed,1);
});
test('new analysis wakes an idle screen and failed job stops polling',async()=>{
 const h=harness([{jobs:[]},{job:job('running')},{jobs:[job('failed')]}]);await h.flush();await h.result.start('doc1','analyze');await h.flush();assert.equal(h.timers.size,1);await h.tick();assert.deepEqual(h.requests,['GET','POST','GET']);assert.equal(h.timers.size,0);
});
test('idle connection error does not create an endless retry loop',async()=>{
 const h=harness([new Error('offline')]);await h.flush();assert.equal(h.timers.size,0);assert.equal(h.result.pollError,'offline');
});

test('temporary connection failure retries only while a job is pending',async()=>{
 const h=harness([{jobs:[job('running')]},new Error('offline'),{jobs:[job('completed')]}]);await h.flush();await h.tick();assert.equal(h.timers.size,1);await h.tick();assert.equal(h.timers.size,0);assert.equal(h.result.pollError,'');
});
