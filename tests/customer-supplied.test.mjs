import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
require.extensions['.ts']=(m,f)=>m._compile(compile(fs.readFileSync(f,'utf8')),f);
const contract=require('../lib/customer-supplied-contract.ts');
const {readCustomerSuppliedWorkbook}=require('../services/customer-supplied-xlsx.ts');
const {zipStore}=require('../lib/trr-zip.ts');
const xml=s=>new TextEncoder().encode(s);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function workbook(rows){return zipStore([
 {name:'xl/workbook.xml',data:xml('<workbook><sheets><sheet name="1234" r:id="r1"/></sheets></workbook>')},
 {name:'xl/_rels/workbook.xml.rels',data:xml('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')},
 {name:'xl/worksheets/sheet1.xml',data:xml('<worksheet><sheetData>'+[['1234 Vestas provided components'],['Component number','Object Description','Comp. Qty (CUn)'],...rows].map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`).join('')+'</sheetData></worksheet>')}
]);}
test('workbook reading preserves cells without requiring headers or SECTION',()=>{
 const sheets=readCustomerSuppliedWorkbook(workbook([['001','Bolt','4','CN1 - Item Added']]));
 assert.equal(sheets[0].cells.find(c=>c.ref==='A3').value,'001');assert.equal(sheets[0].cells.find(c=>c.ref==='D3').value,'CN1 - Item Added');
 assert.equal(contract.validateSuppliedFacts([{id:'1',section:'',itemNumber:'001',description:'Bolt',quantity:null,change:'listed',changeText:'',replacementChain:[],source:'A3'}]).length,1);
});
test('invalid workbook and conflicting raw change comments are identified',()=>{
 assert.throws(()=>readCustomerSuppliedWorkbook(Buffer.from('not xlsx')),/파일 구조/);
 assert.equal(contract.classifySuppliedChange('Item Added; Item Removed','1').change,'review');
});
function harness(){
 const names=['customerSuppliedItems','customerReviews','customerRawData','productionBomRoots','customerPartIdentities','customerBomOccurrences','productParts','productBomItems','bomEditLocks','bomRevisions','auditLogs'];
 const tables=Object.fromEntries(names.map(name=>[name,new Proxy({name},{get:(t,k)=>k==='name'?name:{table:name,key:k}})]));
 let state=Object.fromEntries(names.map(n=>[n,[]]));
 const fact={id:'row1',section:'SEC',itemNumber:'C1',description:'Cable',quantity:2,change:'added',changeText:'CN1 - Item Added',replacementChain:[],source:'SEC!A4:D4'};
 state.customerReviews=[{recordId:'doc',companyId:'c',projectId:'p',version:1,draft:{suppliedItems:[fact]}}];
 state.customerRawData=[{id:'doc',companyId:'c',projectId:'p',sourcePurpose:'supplied',receiptNumber:1,createdAt:1}];
 state.productionBomRoots=[{companyId:'c',projectId:'p',rootPartId:'root'}];
 state.productParts=[{id:'root',companyId:'c',partNumber:'TOP',name:'TOP',partType:'TOP_ITEM',unit:'PCS'},{id:'assy',companyId:'c',partNumber:'S',name:'Section',partType:'ASSEMBLY',unit:'PCS'}];
 state.productBomItems=[{id:'e0',companyId:'c',parentPartId:'root',childPartId:'assy',quantity:1,unit:'PCS',sortOrder:0}];
 state.customerPartIdentities=[{companyId:'c',projectId:'p',customerKey:'ITEM:SEC',partId:'assy'}];
 const eq=(c,v)=>r=>r[c.key]===v,and=(...f)=>r=>f.filter(Boolean).every(fn=>fn(r)),inArray=(c,values)=>r=>values.includes(r[c.key]);
 const sql=()=>({max:true});
 let permitted=true,blocked=false;
 const db={
  select(projection){let table,predicate=()=>true,sort=[];const q={from:t=>(table=t.name,q),where:p=>(predicate=p,q),orderBy:(...c)=>(sort=c,q),for:()=>q,then(resolve,reject){try{let result=state[table].filter(predicate).map(r=>({...r}));if(sort.length)result.sort((a,b)=>{for(const c of sort){const n=String(a[c.key]??'').localeCompare(String(b[c.key]??''));if(n)return n;}return 0;});if(projection)result=Object.values(projection).some(v=>v.max)?[{n:Math.max(0,...result.map(r=>r.revisionSeq))}]:result.map(r=>Object.fromEntries(Object.entries(projection).map(([k,v])=>[k,r[v.key]])));return Promise.resolve(result).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject);}}};return q;},
  insert(t){let values=[],conflict,ignore=false;const q={values:v=>(values=Array.isArray(v)?v:[v],q),onConflictDoUpdate:c=>(conflict=c,q),onConflictDoNothing:()=>(ignore=true,q),returning:()=>q,then(resolve,reject){try{const out=[];for(const v of values){const old=conflict?state[t.name].find(r=>conflict.target.every(c=>r[c.key]===v[c.key])):ignore?state[t.name].find(r=>r.companyId===v.companyId&&r.rootPartId===v.rootPartId):undefined;if(old){if(!ignore)Object.assign(old,conflict.set);}else{state[t.name].push({...v});out.push(v);}}return Promise.resolve(out).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject);}}};return q;},
  update(t){let values,predicate;const q={set:v=>(values=v,q),where:p=>(predicate=p,q),then(resolve,reject){state[t.name].filter(predicate).forEach(r=>Object.assign(r,values));return Promise.resolve([]).then(resolve,reject);}};return q;},
  delete(t){const q={where(p){state[t.name]=state[t.name].filter(r=>!p(r));return Promise.resolve([]);}};return q;},
  async transaction(fn){const before=structuredClone(state);try{return await fn(db);}catch(e){state=before;throw e;}}
 };
 const imports={
  'node:crypto':require('node:crypto'),'drizzle-orm':{and,eq,inArray,sql},'../index':{getDb:()=>db},
  '../customer-supplied-schema':tables,'../customer-review-schema':tables,'../customer-data-schema':tables,'../pbom-schema':tables,'../schema':tables,
  './customer-data-repository':{customerDataAccess:async()=>({canReview:permitted})},
  './pbom-repository':{lockPbomCompany:async()=>{},createNumberedPart:async(tx,s,name,partType,unit,spec)=>{const p={id:'part'+state.productParts.length,companyId:s.companyId,name,partType,unit,spec,partNumber:'P'+state.productParts.length,revision:'00'};state.productParts.push(p);return p;}},
  './production-bulk-lock':{assertNoProductionBulkLock:async()=>{if(blocked)throw Error('locked');}},
  '../../lib/customer-data-contract':require('../lib/customer-data-contract.ts'),'../../lib/customer-supplied-contract':contract,
 };
 const exports={};vm.runInNewContext(compile(fs.readFileSync('db/repositories/customer-supplied-repository.ts','utf8')),{exports,require:id=>{assert.ok(imports[id],id);return imports[id]},Buffer});
 const repo=exports.createCustomerSuppliedRepository(db),scope={companyId:'c',projectId:'p',userId:'u',systemRoles:['ADMIN']};
 const apply=async(area='supplied',extra={})=>repo.apply(scope,{recordId:'doc',version:1,area,choices:[{itemId:'row1',parentPartId:'assy',unit:'PCS'}],customerConfirmed:true,fingerprint:(await repo.list(scope)).fingerprint,...extra});
 return {repo,scope,apply,get state(){return state;},deny:()=>{permitted=false;},block:()=>{blocked=true;}};
}
function existing(h){h.state.productParts.push({id:'existing',companyId:'c',partNumber:'P-100',name:'Cable',partType:'PART',unit:'PCS'});h.state.productBomItems.push({id:'existing-edge',companyId:'c',parentPartId:'assy',childPartId:'existing',quantity:7,unit:'PCS'});h.state.customerPartIdentities.push({companyId:'c',projectId:'p',customerKey:'ITEM:C1',partId:'existing'});return h;}
test('customer confirmation is mandatory; analysis/list access never mutates the BOM',async()=>{
 const h=harness();await h.repo.list(h.scope);assert.equal(h.state.customerSuppliedItems.length,0);assert.equal(h.state.productBomItems.length,1);
 await assert.rejects(h.apply('supplied',{customerConfirmed:false}),/고객/);assert.equal(h.state.customerSuppliedItems.length,0);
 await assert.rejects(h.apply('bom'),/먼저 확정/);assert.equal(h.state.bomEditLocks.length,0);
});
test('confirmation and re-upload use stable keys; BOM reflection is separate and idempotent',async()=>{
 const h=existing(harness());await h.apply();assert.equal(h.state.customerSuppliedItems.length,1);assert.equal(h.state.productBomItems.length,2);
 assert.equal((await h.apply()).changed,0);
 await h.apply('bom');assert.equal(h.state.productBomItems.length,2);assert.equal(h.state.bomRevisions.length,1);assert.equal(h.state.customerSuppliedItems[0].bomApplied,true);
 assert.equal((await h.apply('bom')).changed,0);assert.equal(h.state.bomRevisions.length,1);
 h.state.customerRawData[0].id='doc2';h.state.customerRawData[0].receiptNumber=2;h.state.customerReviews[0].recordId='doc2';
 await h.apply('supplied',{recordId:'doc2'});assert.equal(h.state.customerSuppliedItems.length,1);assert.equal(h.state.customerSuppliedItems[0].bomApplied,true);
 await h.apply('bom',{recordId:'doc2'});assert.equal(h.state.productBomItems.length,2);assert.equal(h.state.bomRevisions.length,1);
});
test('explicit removal retires supply without removing the existing BOM or PART',async()=>{
 const h=existing(harness());await h.apply();await h.apply('bom');
 h.state.customerReviews[0].version=2;Object.assign(h.state.customerReviews[0].draft.suppliedItems[0],{change:'removed',changeText:'CN2 - Item Removed'});
 await h.apply('supplied',{version:2});assert.equal(h.state.customerSuppliedItems[0].status,'removed');assert.equal(h.state.productBomItems.length,2);
 await h.apply('bom',{version:2});assert.equal(h.state.productBomItems.length,2);assert.equal(h.state.productParts.length,3);assert.equal(h.state.bomRevisions.length,2);
});
test('unmatched customer number and stale state roll back without parts or BOM writes',async()=>{
 const h=harness();await h.apply();
 await assert.rejects(h.apply('bom',{choices:[{itemId:'row1',parentPartId:'assy'}]}),/고객품번/);assert.equal(h.state.productParts.length,2);assert.equal(h.state.bomEditLocks.length,0);
 await assert.rejects(h.apply('bom',{fingerprint:'stale'}),/변경/);
 h.deny();await assert.rejects(h.apply(),/PM/);
});
test('supply quantity updates preserve BOM quantities including shared assemblies',async()=>{
 const h=existing(harness());await h.apply();await h.apply('bom');
 h.state.customerReviews[0].version=2;h.state.customerReviews[0].draft.suppliedItems[0].quantity=5;
 await h.apply('supplied',{version:2});assert.equal(h.state.productBomItems[1].quantity,7);
 h.state.productionBomRoots.push({companyId:'c',projectId:'other',rootPartId:'assy'});
 await h.apply('bom',{version:2});assert.equal(h.state.productBomItems[1].quantity,7);
 h.state.productionBomRoots.pop();await h.apply('bom',{version:2});assert.equal(h.state.productBomItems[1].quantity,7);assert.equal(h.state.customerSuppliedItems[0].quantity,5);
});
test('replacement chains retire old identities and never invent the replacement description',async()=>{
 const h=existing(harness());await h.apply();await h.apply('bom');
 h.state.customerReviews[0].version=2;Object.assign(h.state.customerReviews[0].draft.suppliedItems[0],{change:'replaced',changeText:'CN2 - Item C1 is replaced by C2',replacementChain:['C1','C2']});
 await h.apply('supplied',{version:2});assert.equal(h.state.customerSuppliedItems.length,2);assert.equal(h.state.customerSuppliedItems[0].status,'removed');assert.equal(h.state.customerSuppliedItems[1].description,'');
 await assert.rejects(h.apply('bom',{version:2}),/고객품번/);assert.equal(h.state.productBomItems.length,2);assert.equal(h.state.bomRevisions.length,1);assert.equal(h.state.bomEditLocks.length,0);
});
test('a missing source row does not remove an existing confirmed item',async()=>{
 const h=harness();await h.apply();h.state.customerReviews[0].version=2;
 Object.assign(h.state.customerReviews[0].draft.suppliedItems[0],{itemNumber:'C2'});
 await h.apply('supplied',{version:2});assert.equal(h.state.customerSuppliedItems.length,2);assert.ok(h.state.customerSuppliedItems.every(e=>e.status==='active'));
});
test('Excel analysis invokes AI with raw cells and saves partial facts without confirmation',async()=>{
 const {createCustomerReviewService}=require('../services/customer-review-service.ts');
 const bytes=workbook([['001','Bolt','4','CN1 - Item Added']]);let saved;
 const raw={access:async()=>({canReview:true}),get:async()=>({fileName:'components.xlsx',fileSize:bytes.length,fileKey:'x',sourcePurpose:'supplied'})};
 const reviews={list:async()=>({reviews:[]}),save:async(s,id,v,d)=>{saved=d;return {recordId:id,version:1,draft:d}},confirm:()=>assert.fail('no confirmation during analysis')};
 const service=createCustomerReviewService(raw,reviews,{get:async()=>({body:new Blob([bytes]).stream()})},async(prompt,files,structured)=>{assert.equal(structured,true);assert.match(files[0].bytes.toString(),/CN1 - Item Added/);return {draft:{summary:'추출 완료',uncertainties:[],suppliedItems:[{itemNumber:'001',description:'Bolt',quantity:4,changeText:'CN1 - Item Added',source:'1234!A3:D3'},{itemNumber:'002',description:'',quantity:null,changeText:'',source:'1234!A4'}]}};});
 await service.analyze({companyId:'c',projectId:'p',userId:'u',systemRoles:['ADMIN']},'doc',['doc'],'분석');
 assert.equal(saved.suppliedItems[0].itemNumber,'001');assert.equal(saved.suppliedItems[0].quantity,4);assert.equal(saved.documentType,'supplied');assert.deepEqual(saved.items,[]);assert.equal(saved.suppliedItems[0].section,'');assert.equal(saved.suppliedItems[1].quantity,null);
});
test('upload database constraints admit every registered purpose and document type',()=>{
 const {CUSTOMER_SOURCE_PURPOSES,CUSTOMER_DOCUMENT_TYPES}=require('../lib/customer-data-contract.ts');
 const schema=fs.readFileSync('db/customer-data-schema.ts','utf8');
 const migration=fs.readFileSync('drizzle-postgres/0018_customer_supplied_upload_purpose.sql','utf8');
 for(const [constraint,values] of [['customer_raw_data_purpose_ck',CUSTOMER_SOURCE_PURPOSES],['customer_raw_data_type_ck',CUSTOMER_DOCUMENT_TYPES]]){
  for(const source of [schema,migration]){
   const line=source.split('\n').find(s=>s.includes(constraint)&&s.includes(' IN '));assert.ok(line,constraint);
   for(const key of Object.keys(values))assert.ok(line.includes(`'${key}'`),`${constraint} must accept ${key}`);
  }
 }
});
test('customer item number resolves existing BOM and supplies internal part information',async()=>{
 const h=harness();h.state.productParts.push({id:'existing',companyId:'c',partNumber:'P-100',name:'Existing cable',partType:'PART',unit:'PCS'});
 h.state.productBomItems.push({id:'existing-edge',companyId:'c',parentPartId:'assy',childPartId:'existing',quantity:1,unit:'PCS'});
 h.state.customerBomOccurrences.push({companyId:'c',projectId:'p',bomItemId:'existing-edge',fact:{customerItemNumber:'C1'}});
 await h.apply();const list=await h.repo.list(h.scope);assert.equal(list.entries[0].internalPartNumber,'P-100');assert.equal(list.entries[0].internalPartName,'Existing cable');
 await h.apply('bom');assert.equal(h.state.productParts.length,3);assert.equal(h.state.productBomItems.length,2);assert.equal(h.state.productBomItems[1].quantity,1);
});
test('one supplied part used by multiple assemblies needs no assembly choice or duplicated quantity',async()=>{
 const h=harness();h.state.productParts.push({id:'part',companyId:'c',partNumber:'P-200',name:'Common bolt',partType:'PART',unit:'PCS'},{id:'assy2',companyId:'c',partNumber:'A2',name:'Assembly2',partType:'ASSEMBLY',unit:'PCS'});
 h.state.productBomItems.push({id:'root2',companyId:'c',parentPartId:'root',childPartId:'assy2',quantity:1,unit:'PCS'},{id:'one',companyId:'c',parentPartId:'assy',childPartId:'part',quantity:4,unit:'PCS'},{id:'two',companyId:'c',parentPartId:'assy2',childPartId:'part',quantity:8,unit:'PCS'});
 h.state.customerPartIdentities.push({companyId:'c',projectId:'p',customerKey:'ITEM:C1',partId:'part'});
 await h.apply();await h.apply('bom',{choices:[{itemId:'row1',partId:'part'}]});assert.equal(h.state.customerSuppliedItems.length,1);assert.equal(h.state.customerSuppliedItems[0].partId,'part');assert.equal(h.state.customerSuppliedItems[0].parentPartId,null);assert.deepEqual(h.state.productBomItems.filter(e=>e.childPartId==='part').map(e=>e.quantity),[4,8]);
});

test('common confirmation cancellation preserves BOM and restores supply records',async()=>{
 const h=existing(harness()),edges=structuredClone(h.state.productBomItems);
 const cancel=async area=>h.repo.cancel(h.scope,{recordId:'doc',area,fingerprint:(await h.repo.list(h.scope)).fingerprint});
 await h.apply();await h.apply('bom');await assert.rejects(cancel('supplied'),/BOM/);
 await cancel('bom');assert.equal(h.state.customerSuppliedItems[0].bomApplied,false);assert.deepEqual(h.state.productBomItems,edges);assert.equal(h.state.bomRevisions.length,2);
 await cancel('supplied');assert.equal(h.state.customerSuppliedItems.length,0);assert.deepEqual(h.state.productBomItems,edges);
 await h.apply();await h.apply('bom');await cancel('bom');await cancel('supplied');assert.equal(h.state.customerSuppliedItems.length,0);
});

test('supplied BOM review shows exactly the source items, retaining unmatched items and deduplicating ASSY usage',()=>{
 const {suppliedBomRows}=require('../lib/supplied-bom-rows.ts');
 const facts=['C1','C2','C3','C4'].map((itemNumber,i)=>({id:`f${i}`,itemNumber,description:itemNumber,quantity:1,replacementChain:[]}));
 const row={id:'bom1',partId:'p1',internalPartNumber:'P1',level:2,bom:{parentId:null,section:'A',customerItemNumber:'C1',itemDescription:'Existing name',quantity:7},totalQuantity:7};
 const rows=suppliedBomRows(facts,[row,{...row,id:'bom2'},{...row,id:'unrelated',partId:'other',bom:{...row.bom,customerItemNumber:'OTHER'}}],[]);
 assert.equal(rows.length,4);assert.equal(rows[0].bom.quantity,7);assert.equal(rows[0].bom.itemDescription,'Existing name');assert.equal(rows[1].partId,undefined);assert.equal(rows[1].bom.customerItemNumber,'C2');assert.equal(rows[1].bom.quantity,null);
});
