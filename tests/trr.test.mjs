import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {createTrrService}=require('../services/trr-service.ts');
const {previewTrr,createTrrDocx}=require('../services/trr-document.ts');
const {validateTrrExtraction}=require('../lib/trr-contract.ts');
const scope={companyId:'c',projectId:'p',userId:'u',systemRoles:['ADMIN']};
const fact={kind:'current',summary:'조립 토크',facts:[{section:'조립',title:'체결 토크',detail:'320 Nm',reference:'p.1 §2'}]};
function fixture(){
 const state={versions:[],records:[],job:null,calls:0,fail:false,writeFail:false,locked:false};
 const files=new Map();
 const repo={list:async()=>({...state,canGenerate:true}),claim:async()=>state.locked?null:'token',heartbeat:async()=>{},finish:async(s,t,error)=>{state.job={status:error?'failed':'completed',error,updatedAt:0}},projectName:async()=> 'T800',save:async(s,t,data)=>{const row=structuredClone({...data,version:state.versions.length+1,createdAt:0,createdBy:'u'});state.versions.unshift(row);return {row,duplicate:false}},get:async(s,id)=>{const row=state.versions.find(v=>v.id===id);if(!row)throw Error('access denied');return row}};
 const storage={get:async key=>({body:new Blob([files.get(key)??'source']).stream()}),put:async(key,bytes)=>{if(state.writeFail)throw Error('storage failed');files.set(key,bytes)},delete:async key=>files.delete(key)};
 const service=createTrrService(repo,{list:async()=>({records:state.records})},storage,async()=>{state.calls++;if(state.fail)throw Error('AI failed');return structuredClone(fact)});
 const add=(id,purpose='ttr')=>state.records.push({id,rawDataId:id,fileName:id+'.pdf',sourcePurpose:purpose,fileSize:5,fileKey:id,checksum:id,revision:1});
 return {state,files,service,add};
}
test('new reports preserve previous snapshots and reuse unchanged source analysis',async()=>{
 const f=fixture();f.add('one');await f.service.generate(scope);const first=JSON.stringify(f.state.versions[0]);
 assert.equal(f.state.versions[0].document.version,1);assert.equal(f.files.size,1);
 await f.service.generate(scope);assert.equal(f.state.versions.length,1);assert.equal(f.state.calls,1);
 f.add('two');await f.service.generate(scope);assert.equal(f.state.versions.length,2);assert.equal(f.state.calls,2);assert.equal(f.files.size,2);assert.equal(JSON.stringify(f.state.versions[1]),first);assert.match(f.state.versions[0].summary,/1건 추가.*조립/);
 const comparison=await f.service.comparison(scope,f.state.versions.map(v=>v.id));assert.match(comparison.text,/V001/);assert.match(comparison.text,/320 Nm/);
});
test('analysis and file storage failures never advance or overwrite the last report',async()=>{
 const f=fixture();f.add('one');await f.service.generate(scope);const first=JSON.stringify(f.state.versions[0]);f.add('two');f.state.fail=true;
 await assert.rejects(f.service.generate(scope),/AI failed/);assert.equal(f.state.job.status,'failed');assert.equal(f.state.versions.length,1);assert.equal(JSON.stringify(f.state.versions[0]),first);
 f.state.fail=false;f.state.writeFail=true;await assert.rejects(f.service.generate(scope),/storage failed/);assert.equal(f.files.size,1);assert.equal(f.state.versions.length,1);
});
test('BOM-only reception does not create a TRR and active locks prevent generation',async()=>{
 const f=fixture();f.add('drawing','bom');await f.service.generate(scope);assert.equal(f.state.calls,0);f.add('spec');f.state.locked=true;await f.service.generate(scope);assert.equal(f.state.calls,0);
});
test('comparison rejects duplicate, excessive, and inaccessible versions',async()=>{
 const f=fixture();await assert.rejects(f.service.comparison(scope,['one','one']));await assert.rejects(f.service.comparison(scope,Array.from({length:6},(_,i)=>String(i))));await assert.rejects(f.service.comparison(scope,['foreign','other']),/access denied/);
});
test('source evidence is required and preview escapes source instructions and markup',()=>{
 assert.throws(()=>validateTrrExtraction({...fact,facts:[{...fact.facts[0],reference:''}]}));
 const doc={projectName:'T800',version:1,sources:[{id:'one',fileName:'sample.pdf',revision:1,kind:'historical',facts:[{...fact.facts[0],detail:'<script>alert(1)</script> 280 Nm'}]}]};
 const preview=previewTrr(doc,'V001');assert.ok(!preview.includes('<script>'));assert.match(preview,/과거 사례 참고/);assert.match(preview,/280 Nm/);assert.equal(Buffer.from(createTrrDocx(doc)).subarray(0,2).toString(),'PK');
});
