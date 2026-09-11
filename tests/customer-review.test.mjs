import test from 'node:test';
import assert from 'node:assert/strict';

// Compile service imports in-memory so tests use the existing TS dependency, without a new runner.
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {validateReviewDraft}=require('../lib/customer-review-contract.ts');
const draft=()=>({documentType:'drawing',drawingNumber:'TC800-MAST',revisionLabel:'R00',summary:'원본 분석',uncertainties:[],items:[{id:'part-1',area:'pbom',title:'연결판',detail:'수량 2 EA',source:'MAST.pdf p1 Parts List 1행',recordId:'raw-1'}]});
test('review requires source references and a selected source id',()=>{assert.equal(validateReviewDraft(draft(),['raw-1']).items.length,1);const d=draft();d.items[0].recordId='other-project';assert.throws(()=>validateReviewDraft(d,['raw-1']));d.items[0].recordId='raw-1';d.items[0].source='';assert.throws(()=>validateReviewDraft(d,['raw-1']));});
test('review rejects unknown types, destinations and duplicate item ids',()=>{const d=draft();d.documentType='invented';assert.throws(()=>validateReviewDraft(d,['raw-1']));d.documentType='drawing';d.items[0].area='direct-production';assert.throws(()=>validateReviewDraft(d,['raw-1']));d.items[0].area='pbom';d.items.push({...d.items[0]});assert.throws(()=>validateReviewDraft(d,['raw-1']));});
test('a document without extracted facts may remain unresolved',()=>{const d=draft();d.documentType='unclassified';d.items=[];d.uncertainties=['도면 글자 판독 불가'];assert.equal(validateReviewDraft(d,['raw-1']).items.length,0);});

const {createCustomerReviewService}=require('../services/customer-review-service.ts');
const {createCustomerDataService}=require('../services/customer-data-service.ts');
const scope={companyId:'c',projectId:'p',userId:'u',systemRoles:['ADMIN']};
test('AI analysis saves only a draft; no confirmation is invoked',async()=>{
 let saved=0,confirmed=0;const raw={access:async()=>({canReview:true}),get:async()=>({fileName:'test.pdf',fileSize:4,fileKey:'x'})};
 const reviews={list:async()=>({reviews:[]}),save:async(s,id,v,d,m)=>{saved++;assert.equal(v,0);return {recordId:id,version:1,draft:d,messages:m}},confirm:()=>{confirmed++}};
 const storage={get:async()=>({body:new Blob(['%PDF']).stream()})};
 const service=createCustomerReviewService(raw,reviews,storage,async()=>{const d=draft();d.items[0].area='trr';return {answer:'초안',draft:d}});
 const r=await service.analyze(scope,'raw-1',['raw-1'],'분석');assert.equal(r.review.version,1);assert.equal(saved,1);assert.equal(confirmed,0);
});
test('AI failures and invalid source citations never overwrite saved draft',async()=>{
 let saved=0;const raw={access:async()=>({canReview:true}),get:async()=>({fileName:'test.pdf',fileSize:4,fileKey:'x'})};const reviews={list:async()=>({reviews:[]}),save:async()=>{saved++}};const storage={get:async()=>({body:new Blob(['%PDF']).stream()})};
 await assert.rejects(createCustomerReviewService(raw,reviews,storage,async()=>{throw Error('unavailable')}).analyze(scope,'raw-1',['raw-1'],'분석'));
 const bad=draft();bad.items[0].recordId='not-selected';await assert.rejects(createCustomerReviewService(raw,reviews,storage,async()=>({draft:bad})).analyze(scope,'raw-1',['raw-1'],'분석'));assert.equal(saved,0);
});
test('bulk reception needs only file and reports duplicates while cleaning extra storage',async()=>{
 const deleted=[];const repository={access:async()=>({canUpload:true}),create:async(s,d,p,r,once)=>{assert.equal(d.title,'drawing.png');assert.equal(d.documentType,'other');assert.equal(d.impactTarget,'unclassified');assert.equal(once,true);return {...d,id:'existing',companyId:'c'}}};
 const storage={put:async()=>{},delete:async key=>deleted.push(key)};const form=new FormData();form.set('file',new File(['same bytes'],'drawing.png'));
 const result=await createCustomerDataService(repository,storage).upload(scope,form,true);assert.equal(result.duplicate,true);assert.equal(deleted.length,1);assert.equal(result.fileKey,undefined);
});

test('new AI responses cannot save unstructured BOM facts or use output examples as technical input',async()=>{
 let saved=0;const reviews={list:async()=>({reviews:[]}),save:async()=>{saved++}};
 const storage={get:async()=>({body:new Blob(['%PDF']).stream()})};
 const raw={access:async()=>({canReview:true}),get:async()=>({fileName:'test.pdf',fileSize:4,fileKey:'x',sourcePurpose:'input'})};
 await assert.rejects(createCustomerReviewService(raw,reviews,storage,async()=>({draft:draft()})).analyze(scope,'raw-1',['raw-1'],'분석'));
 raw.get=async()=>({fileName:'answer.pdf',fileSize:4,fileKey:'x',sourcePurpose:'example'});
 await assert.rejects(createCustomerReviewService(raw,reviews,storage,async()=>{throw Error('must not call provider')}).analyze(scope,'raw-1',['raw-1'],'분석'));
 assert.equal(saved,0);
});

test('chat prepares authorized original files without analyzing or modifying drafts',async()=>{
 const accessed=[],existing={recordId:'raw-1',draft:draft()};
 const raw={get:async(s,id)=>{accessed.push(id);if(id!=='raw-1')throw Error('access denied');return {fileName:'drawing.png',fileSize:3,fileKey:'image'}}};
 const reviews={list:async()=>({reviews:[existing,{recordId:'hidden',draft:draft()}]}),save:()=>assert.fail('chat must not save a draft')};
 const storage={get:async()=>({body:new Blob(['png']).stream()})};
 const service=createCustomerReviewService(raw,reviews,storage,()=>assert.fail('chat must not invoke analysis'));
 const result=await service.prepareChat(scope,'raw-1',['raw-1'],'도면 설명');
 assert.equal(result.files[0].mime,'image/png');assert.equal(result.files[0].bytes.toString(),'png');assert.deepEqual(result.drafts,[existing]);
 await assert.rejects(service.prepareChat(scope,'raw-1',['raw-1','hidden'],'비교'),/access denied/);
 assert.deepEqual(accessed,['raw-1','raw-1','hidden']);
});
test('analysis rejects multiple originals before loading files',async()=>{
 const service=createCustomerReviewService({access:async()=>({canReview:true}),get:()=>assert.fail('must reject before file read')},{},{},()=>assert.fail('must not call AI'));
 await assert.rejects(service.analyze(scope,'raw-1',['raw-1','raw-2'],'분석'),error=>error.status===400);
});
test('compact reanalysis prompt keeps identity references but omits prior long answers',()=>{
 const {buildCustomerAnalysisPrompt}=require('../services/customer-review-prompts.ts');
 const d=draft();d.summary='old-summary-marker';d.items[0].detail='old-detail-marker';
 const prompt=buildCustomerAnalysisPrompt('raw-1',d,'분석');
 assert.ok(prompt.includes('part-1'));assert.ok(!prompt.includes('old-summary-marker'));assert.ok(!prompt.includes('old-detail-marker'));
 assert.ok(prompt.includes('componentRevision'));assert.ok(prompt.includes('useTargets'));
});
