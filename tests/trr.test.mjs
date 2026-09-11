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
 const state={versions:[],records:[],reviews:[],job:null,writeFail:false,locked:false,canReview:true};
 const files=new Map();
 const repo={list:async()=>({...state,canGenerate:true}),claim:async()=>state.locked?null:'token',heartbeat:async()=>{},finish:async(s,t,error)=>{state.job={status:error?'failed':'completed',error,updatedAt:0}},projectName:async()=> 'T800',save:async(s,t,data)=>{const row=structuredClone({...data,version:state.versions.length+1,createdAt:0,createdBy:'u'});state.versions.unshift(row);return {row,duplicate:false}},get:async(s,id)=>{const row=state.versions.find(v=>v.id===id);if(!row)throw Error('access denied');return row}};
 const storage={get:async key=>({body:new Blob([files.get(key)]).stream()}),put:async(key,bytes)=>{if(state.writeFail)throw Error('storage failed');files.set(key,bytes)},delete:async key=>files.delete(key)};
 const service=createTrrService(repo,{access:async()=>({canReview:state.canReview}),get:async(s,id)=>{const r=state.records.find(r=>r.id===id);if(!r)throw Error('access denied');return r}},storage,{list:async()=>({reviews:state.reviews})});
 const add=(id,purpose='ttr')=>{
  state.records.push({id,rawDataId:id,fileName:id+'.pdf',sourcePurpose:purpose,fileSize:5,fileKey:id,checksum:id,revision:1});
  state.reviews.push({recordId:id,version:1,draft:{documentType:'report',drawingNumber:'',revisionLabel:'',summary:'기술 검토',uncertainties:[],items:[{id:id+'-fact',recordId:id,area:'trr',trrSection:'조립',trrKind:'current',title:'체결 토크',detail:'320 Nm',source:'p.1 §2'}]}});
 };
 const apply=(id,version=1)=>service.generate(scope,{recordId:id,version});
 return {state,files,service,add,apply};
}
test('manual reflection uses only the requested review and preserves cumulative Word versions',async()=>{
 const f=fixture();f.add('one');f.add('two');
 assert.equal(f.state.versions.length,0);
 await f.apply('one');const first=JSON.stringify(f.state.versions[0]);
 assert.equal(f.state.versions[0].document.sources.length,1);
 assert.equal(f.state.versions[0].document.sources[0].reviewVersion,1);
 await f.apply('one');assert.equal(f.state.versions.length,1);assert.equal(f.files.size,1);
 await f.apply('two');assert.equal(f.state.versions.length,2);assert.equal(f.state.versions[0].document.sources.length,2);
 assert.equal(JSON.stringify(f.state.versions[1]),first);assert.match(f.state.versions[0].summary,/two.pdf.*1건 추가/);
 const result=await f.service.list(scope);assert.equal(result.appliedSources.length,2);
});
test('revised review replaces one source without duplicating facts or changing other sources',async()=>{
 const f=fixture();f.add('one');f.add('two');await f.apply('one');await f.apply('two');
 const previous=JSON.stringify(f.state.versions),review=f.state.reviews[0];
 review.version=2;review.draft.items[0].detail='280 Nm';review.draft.items[0].trrSection='품질·검사';
 // Merely editing/re-extracting a review does not alter Word.
 assert.equal(JSON.stringify(f.state.versions),previous);
 await f.apply('one',2);
 assert.equal(f.state.versions.length,3);assert.equal(f.state.versions[0].document.sources.length,2);
 const doc=f.state.versions[0].document;
 assert.equal(doc.sources.find(s=>s.id==='one').facts[0].detail,'280 Nm');
 assert.equal(doc.sources.find(s=>s.id==='two').facts[0].detail,'320 Nm');
 assert.match(f.state.versions[0].summary,/갱신.*품질·검사/);
 assert.equal(JSON.stringify(f.state.versions.slice(1)),previous);
 const compare=await f.service.comparison(scope,f.state.versions.slice(0,2).map(v=>v.id));assert.match(compare.text,/280 Nm/);assert.match(compare.text,/320 Nm/);
});
test('invalid or stale drafts, missing selection, unauthorized and locked requests cannot generate',async()=>{
 const f=fixture();f.add('one');
 await assert.rejects(f.service.generate(scope),/검토한 문서/);
 await assert.rejects(f.apply('one',0),/변경/);
 await assert.rejects(f.apply('foreign'),/access denied/);
 f.state.canReview=false;await assert.rejects(f.apply('one'),/PM/);f.state.canReview=true;
 f.state.locked=true;await assert.rejects(f.apply('one'),/진행 중/);f.state.locked=false;
 f.state.reviews[0].draft.items[0].source='';await assert.rejects(f.apply('one'),/근거/);
 assert.equal(f.files.size,0);assert.equal(f.state.versions.length,0);
});
test('Word storage failure never advances a version or overwrites the previous report',async()=>{
 const f=fixture();f.add('one');await f.apply('one');const first=JSON.stringify(f.state.versions[0]);f.add('two');f.state.writeFail=true;
 await assert.rejects(f.apply('two'),/storage failed/);assert.equal(f.state.job.status,'failed');assert.equal(f.files.size,1);assert.equal(f.state.versions.length,1);assert.equal(JSON.stringify(f.state.versions[0]),first);
});
test('raw-only inputs cannot be reflected without TRR review facts',async()=>{
 const f=fixture();f.add('one');f.state.reviews[0].draft.items=[];
 await assert.rejects(f.apply('one'),/추출 내용/);
 f.state.reviews=[];await assert.rejects(f.apply('one'),/분석 결과/);assert.equal(f.files.size,0);
});
test('comparison rejects duplicate, excessive, and inaccessible versions',async()=>{
 const f=fixture();await assert.rejects(f.service.comparison(scope,['one','one']));await assert.rejects(f.service.comparison(scope,Array.from({length:6},(_,i)=>String(i))));await assert.rejects(f.service.comparison(scope,['foreign','other']),/access denied/);
});
test('source evidence and known sections are required; preview escapes content and labels historical facts',()=>{
 assert.throws(()=>validateTrrExtraction({...fact,facts:[{...fact.facts[0],reference:''}]}),/reference/);
 assert.equal(validateTrrExtraction({...fact,facts:[{...fact.facts[0],section:'제작 / 용접 / NDT'}]}).facts[0].section,'제작·용접·NDT');
 const doc={projectName:'T800',version:1,sources:[{id:'one',fileName:'sample.pdf',revision:1,kind:'current',facts:[{...fact.facts[0],kind:'historical',detail:'<script>alert(1)</script> 280 Nm'}]}]};
 const preview=previewTrr(doc,'V001');assert.ok(!preview.includes('<script>'));assert.match(preview,/과거 사례 참고/);assert.match(preview,/5. 조립/);assert.equal(Buffer.from(createTrrDocx(doc)).subarray(0,2).toString(),'PK');
});
