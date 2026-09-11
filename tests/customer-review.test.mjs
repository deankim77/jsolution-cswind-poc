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
test('failed or empty analysis never overwrites existing data',async()=>{
 let saved=0;const raw={access:async()=>({canReview:true}),get:async()=>({fileName:'test.pdf',fileSize:4,fileKey:'x'})},reviews={list:async()=>({reviews:[]}),save:async()=>saved++},storage={get:async()=>({body:new Blob(['pdf']).stream()})};
 for(const provider of [async()=>{throw Error('failed')},async()=>({answer:''})])await assert.rejects(createCustomerReviewService(raw,reviews,storage,provider).analyze(scope,'raw-1',['raw-1'],'분석'));
 assert.equal(saved,0);
});
test('bulk reception needs only file and reports duplicates while cleaning extra storage',async()=>{
 const deleted=[];const repository={access:async()=>({canUpload:true}),create:async(s,d,p,r,once)=>{assert.equal(d.title,'drawing.png');assert.equal(d.documentType,'other');assert.equal(d.impactTarget,'unclassified');assert.equal(once,true);return {...d,id:'existing',companyId:'c'}}};
 const storage={put:async()=>{},delete:async key=>deleted.push(key)};const form=new FormData();form.set('file',new File(['same bytes'],'drawing.png'));
 const result=await createCustomerDataService(repository,storage).upload(scope,form,true);assert.equal(result.duplicate,true);assert.equal(deleted.length,1);assert.equal(result.fileKey,undefined);
});

test('analysis rejects empty answers and output examples as technical input',async()=>{
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
test('part list is saved using the existing PBOM contract without revision correction',async()=>{
 const bom={parentId:null,section:'',itemDescription:'JIB',position:'',customerItemNumber:'JIB-A',drawingNumber:'JIB-01',componentRevision:'V02',quantity:1,unit:'EA',weight:null,weightUnit:'',weightSource:'Not Available',drawingAvailability:'Drawing Found',partType:'ASSEMBLY',childrenComplete:false};
 const result=draft();result.revisionLabel='V02';result.items[0].bom=bom;
 const raw={access:async()=>({canReview:true}),get:async()=>({fileName:'test.pdf',fileSize:4,fileKey:'x'})};
 const reviews={list:async()=>({reviews:[]}),save:async(s,id,v,d)=>{assert.deepEqual(d.items[0].bom,bom);assert.equal(d.revisionLabel,'V02');return {draft:d}}};
 const service=createCustomerReviewService(raw,reviews,{get:async()=>({body:new Blob(['pdf']).stream()})},async(prompt,files,structured)=>{assert.equal(structured,true);assert.ok(prompt.includes('Rev/Revision'));assert.ok(prompt.includes('Ver/Version'));return {answer:'추출',draft:result}});
 await service.analyze(scope,'raw-1',['raw-1'],'분석');
});
test('validation errors retain their reason and do not overwrite prior data',async()=>{
 const bad=draft();bad.items[0].recordId='other';
 const service=createCustomerReviewService({access:async()=>({canReview:true}),get:async()=>({fileName:'test.pdf',fileSize:4,fileKey:'x'})},{list:async()=>({reviews:[]}),save:()=>assert.fail('must not save')},{get:async()=>({body:new Blob(['pdf']).stream()})},async()=>({answer:'추출',draft:bad}));
 await assert.rejects(service.analyze(scope,'raw-1',['raw-1'],'분석'),e=>e.status===422&&e.message.includes('분석 항목의 분류·근거'));
});

test('new PBOM parts carry source material into the existing specification field',async()=>{
 const {createNumberedPart}=require('../db/repositories/pbom-repository.ts');
 const {productParts}=require('../db/schema.ts');
 let created;
 const tx={
  insert:table=>({values:value=>({onConflictDoNothing:()=>({returning:async()=>{if(table===productParts){created=value;return [value]}return []}})})}),
  update:()=>({set:()=>({where:()=>({returning:async()=>[{prefix:'P',separator:'-',digits:6,nextSequence:2}]})})}),
  select:()=>({from:()=>({where:()=>({limit:async()=>[]})})})
 };
 await createNumberedPart(tx,scope,'PLATE','PART','EA','S355J2');
 assert.equal(created.spec,'S355J2');assert.equal(created.name,'PLATE');
});

test('missing or unreadable optional numbers preserve the extracted parts list',async()=>{
 const {prepareReviewNumbers}=require('../services/customer-review-numbers.ts');
 const root={parentId:null,section:'',itemDescription:'JIB',position:'',customerItemNumber:'JIB-A',drawingNumber:'JIB-01',componentRevision:'R00',quantity:'1',unit:'EA',weight:'',weightUnit:null,weightSource:null,partType:'ASSEMBLY',drawingAvailability:'Drawing Found',childrenComplete:true};
 const original=draft();original.items=[{...original.items[0],id:'root',bom:root},{...original.items[0],id:'part',bom:{...root,parentId:'root',partType:'PART',customerItemNumber:'PART-1',quantity:'2',weight:'판독불가'}}];
 const prepared=validateReviewDraft(prepareReviewNumbers(original),['raw-1']);
 assert.equal(prepared.items.length,2);assert.equal(prepared.items[1].bom.quantity,2);assert.equal(prepared.items[1].bom.weight,null);assert.equal(prepared.items[0].bom.weight,null);
 assert.ok(prepared.uncertainties.some(s=>s.includes('판독불가')));assert.equal(original.items[0].bom.weight,'');
 for(const weight of ['1,260',1260]){const d=draft();d.items[0].bom={...root,weight,weightUnit:'kg',weightSource:'Parts List'};assert.equal(validateReviewDraft(prepareReviewNumbers(d),['raw-1']).items[0].bom.weight,1260);}
 const d=draft();d.items[0].bom={...root,weight:85};const normalized=prepareReviewNumbers(d);assert.equal(validateReviewDraft(normalized,['raw-1']).items[0].bom.weight,85);assert.ok(normalized.uncertainties[0].includes('85'));
});

test('conditional confirmation numbers PARTs and preserves missing fields without fabricating BOM quantities',async()=>{
 const access=require('../db/repositories/customer-data-repository.ts');
 const oldAccess=access.customerDataAccess;access.customerDataAccess=async()=>({canReview:true});
 try{
  const {createCustomerReviewRepository}=require('../db/repositories/customer-review-repository.ts');
  const {customerReviews,customerConfirmedData}=require('../db/customer-review-schema.ts');
  const {auditLogs,productParts,partNumberSettings,partNumberHistory}=require('../db/schema.ts');
  const {customerPartIdentities}=require('../db/pbom-schema.ts');
  const d=draft();d.items[0].bom={parentId:null,section:'',itemDescription:'PLATE',position:'1',customerItemNumber:'',drawingNumber:'',componentRevision:'',quantity:null,unit:'',weight:18.5,weightUnit:'kg',weightSource:'Parts List',drawingAvailability:'Need Review',partType:'PART',childrenComplete:false};
  d.items.push({...d.items[0],id:'root',bom:{...d.items[0].bom,partType:'ASSEMBLY',customerItemNumber:'ROOT',quantity:1,unit:'PCS'}});d.items[0].bom.parentId='root';
  const writes=[];
  const tx={select:()=>({from:table=>{
   const rows=table===customerReviews?[{version:1,draft:d}]:[];
   const chain={where:()=>chain,innerJoin:()=>chain,for:()=>chain,limit:()=>chain,then:resolve=>Promise.resolve(rows).then(resolve)};return chain;
  }}),update:table=>({set:()=>({where:()=>({returning:async()=>[{prefix:'P',separator:'-',digits:6,nextSequence:writes.filter(w=>w.table===productParts).length+2}]})})}),insert:table=>{assert.ok([customerConfirmedData,auditLogs,productParts,partNumberSettings,partNumberHistory,customerPartIdentities].includes(table),'must not fabricate BOM edges');return {values:value=>{writes.push({table,value});const chain={onConflictDoUpdate:async()=>{},onConflictDoNothing:()=>chain,returning:async()=>[value]};return chain}}}};
  const repo=createCustomerReviewRepository({transaction:fn=>fn(tx)});
  const result=await repo.confirm(scope,'raw-1',1,['part-1','root']);
  assert.equal(writes.filter(w=>w.table===productParts).length,2);
  assert.equal(result.conditional,true);assert.match(result.issues[0],/식별번호.*수량.*단위/);
  const saved=writes.find(w=>w.table===customerConfirmedData).value[0];
  assert.equal(saved.item.approval.status,'conditional');assert.equal(saved.item.bom.quantity,null);assert.equal(saved.item.bom.weight,18.5);assert.equal(saved.item.bom.unit,'');
  assert.equal(writes.find(w=>w.table===auditLogs).value.action,'CUSTOMER_DATA_CONDITIONALLY_APPROVED');
  const {normalizeReviewItem}=require('../lib/customer-review-contract.ts');assert.equal(normalizeReviewItem(saved.item).approval.status,'conditional');
  writes.length=0;await assert.rejects(repo.confirm(scope,'raw-1',0,['part-1','root']),e=>e.status===409);assert.equal(writes.length,0);
 }finally{access.customerDataAccess=oldAccess;}
});

test('approval checks clear after required fields are supplied; optional weight is not a blocker',()=>{
 const {buildBomRows,pbomApprovalIssues}=require('../lib/pbom-contract.ts');
 const item={id:'one',recordId:'raw-1',source:'Parts List',bom:{parentId:null,section:'',itemDescription:'PLATE',position:'1',customerItemNumber:'PLATE-1',drawingNumber:'',componentRevision:'',quantity:2,unit:'PCS',weight:null,weightUnit:'',weightSource:'Not Available',drawingAvailability:'Need Review',partType:'ASSEMBLY',childrenComplete:false}};
 assert.deepEqual(pbomApprovalIssues(buildBomRows([item],[])),[]);
 const missing={...item,bom:{...item.bom,quantity:null,unit:''}};
 assert.equal(pbomApprovalIssues(buildBomRows([missing],[])).length,1);
 assert.equal(missing.bom.quantity,null);
});



test('list counts retain actual approvals after reanalysis, deduplicate snapshots and include conditional approvals',()=>{
 const {reviewAreaCounts}=require('../lib/customer-review-contract.ts');
 const review={recordId:'raw-1',version:3,draft:{...draft(),items:['new-a','new-b'].map(id=>({...draft().items[0],id}))}};
 const row=(id,version,status='approved',area='pbom',recordId='raw-1')=>({id,recordId,version,item:{...draft().items[0],id,area,approval:{status,issues:[]}}});
 const old=row('old-a',1);delete old.item.approval;
 assert.deepEqual(reviewAreaCounts(review,[old,old],'pbom'),{analyzed:2,approved:1,conditional:0});
 assert.deepEqual(reviewAreaCounts(review,[row('new-a',3,'conditional'),row('new-b',3,'conditional')],'pbom'),{analyzed:2,approved:2,conditional:2});
 assert.deepEqual(reviewAreaCounts(review,[old,row('new-a',3,'conditional')],'pbom'),{analyzed:2,approved:1,conditional:1});
 const records=[old,row('b',2),row('c',2),row('b',2),row('new-a',3,'conditional'),row('new-b',3,'conditional'),row('foreign',3,'approved','pbom','other')];
 assert.deepEqual(reviewAreaCounts(review,records,'pbom'),{analyzed:2,approved:2,conditional:2});
 assert.deepEqual(reviewAreaCounts(review,[...records,row('new-a',4),row('new-b',4)],'pbom'),{analyzed:2,approved:2,conditional:0});
 assert.deepEqual(reviewAreaCounts(review,[],'pbom'),{analyzed:2,approved:0,conditional:0});
 const extracts=[row('a',1,'approved','extract'),row('a',2,'approved','extract'),row('b',2,'approved','extract')];
 assert.deepEqual(reviewAreaCounts(review,extracts,'extract'),{analyzed:0,approved:2,conditional:0});
 assert.deepEqual(reviewAreaCounts(undefined,records,'pbom'),{analyzed:null,approved:0,conditional:0});
});
