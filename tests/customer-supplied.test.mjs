import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
require.extensions['.ts']=(m,f)=>m._compile(compile(fs.readFileSync(f,'utf8')),f);
const contract=require('../lib/customer-supplied-contract.ts');
const {extractCustomerSuppliedXlsx}=require('../services/customer-supplied-xlsx.ts');
const {zipStore}=require('../lib/trr-zip.ts');
const xml=s=>new TextEncoder().encode(s);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function workbook(rows){return zipStore([
 {name:'xl/workbook.xml',data:xml('<workbook><sheets><sheet name="1234" r:id="r1"/></sheets></workbook>')},
 {name:'xl/_rels/workbook.xml.rels',data:xml('<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')},
 {name:'xl/worksheets/sheet1.xml',data:xml('<worksheet><sheetData>'+[['1234 Vestas provided components'],['Component number','Object Description','Comp. Qty (CUn)'],...rows].map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`).join('')+'</sheetData></worksheet>')}
]);}
test('source extraction preserves IDs, quantities, source cells and multi-step CN replacements',()=>{
 const rows=extractCustomerSuppliedXlsx(workbook([['001','Bolt','4','CN1 - Item Added'],['2','Plate','1','CN2 - Item Removed'],['3','Old kit','2','CN1 - Item 3 is replaced by 4\nCN2 - Item 4 is replaced by 5']]));
 assert.equal(rows[0].itemNumber,'001');assert.equal(rows[0].section,'1234');assert.equal(rows[0].quantity,4);assert.equal(rows[1].change,'removed');assert.deepEqual(rows[2].replacementChain,['3','4','5']);assert.match(rows[2].source,/1234!A5:D5/);assert.ok(!('requiredDate' in rows[0]));
});
test('duplicate keys, unsupported files and ambiguous change instructions are not silently accepted',()=>{
 assert.throws(()=>extractCustomerSuppliedXlsx(Buffer.from('not xlsx')));
 assert.throws(()=>extractCustomerSuppliedXlsx(workbook([['1','one','1'],['1','one','2']])),/중복/);
 assert.equal(contract.classifySuppliedChange('Item Added; Item Removed','1').change,'review');
 assert.equal(contract.classifySuppliedChange('Item 1 is replaced by 2; Item 2 is replaced by 1','1').change,'review');
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
test('customer confirmation is mandatory; analysis/list access never mutates the BOM',async()=>{
 const h=harness();await h.repo.list(h.scope);assert.equal(h.state.customerSuppliedItems.length,0);assert.equal(h.state.productBomItems.length,1);
 await assert.rejects(h.apply('supplied',{customerConfirmed:false}),/고객/);assert.equal(h.state.customerSuppliedItems.length,0);
 await assert.rejects(h.apply('bom'),/먼저 확정/);assert.equal(h.state.bomEditLocks.length,0);
});
test('confirmation and re-upload use stable keys; BOM reflection is separate and idempotent',async()=>{
 const h=harness();await h.apply();assert.equal(h.state.customerSuppliedItems.length,1);assert.equal(h.state.productBomItems.length,1);
 assert.equal((await h.apply()).changed,0);
 await h.apply('bom');assert.equal(h.state.productBomItems.length,2);assert.equal(h.state.bomRevisions.length,1);assert.equal(h.state.customerSuppliedItems[0].bomApplied,true);
 assert.equal((await h.apply('bom')).changed,0);assert.equal(h.state.bomRevisions.length,1);
 h.state.customerRawData[0].id='doc2';h.state.customerRawData[0].receiptNumber=2;h.state.customerReviews[0].recordId='doc2';
 await h.apply('supplied',{recordId:'doc2'});assert.equal(h.state.customerSuppliedItems.length,1);assert.equal(h.state.customerSuppliedItems[0].bomApplied,true);
 await h.apply('bom',{recordId:'doc2'});assert.equal(h.state.productBomItems.length,2);assert.equal(h.state.bomRevisions.length,1);
});
test('explicit removal retires supply first, then only its BOM connection, retaining PART and revision history',async()=>{
 const h=harness();await h.apply();await h.apply('bom');
 h.state.customerReviews[0].version=2;Object.assign(h.state.customerReviews[0].draft.suppliedItems[0],{change:'removed',changeText:'CN2 - Item Removed'});
 await h.apply('supplied',{version:2});assert.equal(h.state.customerSuppliedItems[0].status,'removed');assert.equal(h.state.productBomItems.length,2);
 await h.apply('bom',{version:2});assert.equal(h.state.productBomItems.length,1);assert.equal(h.state.productParts.length,3);assert.equal(h.state.bomRevisions.length,2);
});
test('unknown unit and changed review state roll back without parts or BOM writes',async()=>{
 const h=harness();await h.apply();
 await assert.rejects(h.apply('bom',{choices:[{itemId:'row1',parentPartId:'assy'}]}),/단위/);assert.equal(h.state.productParts.length,2);assert.equal(h.state.bomEditLocks.length,0);
 await assert.rejects(h.apply('bom',{fingerprint:'stale'}),/변경/);
 h.deny();await assert.rejects(h.apply(),/PM/);
});
test('BOM quantity updates require selection and cannot modify a shared project assembly',async()=>{
 const h=harness();await h.apply();await h.apply('bom');
 h.state.customerReviews[0].version=2;h.state.customerReviews[0].draft.suppliedItems[0].quantity=5;
 await h.apply('supplied',{version:2});assert.equal(h.state.productBomItems[1].quantity,2);
 h.state.productionBomRoots.push({companyId:'c',projectId:'other',rootPartId:'assy'});
 await assert.rejects(h.apply('bom',{version:2}),/공유/);assert.equal(h.state.productBomItems[1].quantity,2);
 h.state.productionBomRoots.pop();await h.apply('bom',{version:2});assert.equal(h.state.productBomItems[1].quantity,5);
});
test('replacement chains retire old identities and never invent the replacement description',async()=>{
 const h=harness();await h.apply();await h.apply('bom');
 h.state.customerReviews[0].version=2;Object.assign(h.state.customerReviews[0].draft.suppliedItems[0],{change:'replaced',changeText:'CN2 - Item C1 is replaced by C2',replacementChain:['C1','C2']});
 await h.apply('supplied',{version:2});assert.equal(h.state.customerSuppliedItems.length,2);assert.equal(h.state.customerSuppliedItems[0].status,'removed');assert.equal(h.state.customerSuppliedItems[1].description,'');
 await assert.rejects(h.apply('bom',{version:2}),/품명/);assert.equal(h.state.productBomItems.length,2);assert.equal(h.state.bomRevisions.length,1);assert.equal(h.state.bomEditLocks.length,0);
});
test('a missing source row does not remove an existing confirmed item',async()=>{
 const h=harness();await h.apply();h.state.customerReviews[0].version=2;
 Object.assign(h.state.customerReviews[0].draft.suppliedItems[0],{itemNumber:'C2'});
 await h.apply('supplied',{version:2});assert.equal(h.state.customerSuppliedItems.length,2);assert.ok(h.state.customerSuppliedItems.every(e=>e.status==='active'));
});
test('Excel analysis saves exact source facts as a draft without invoking confirmation or generative extraction',async()=>{
 const {createCustomerReviewService}=require('../services/customer-review-service.ts');
 const bytes=workbook([['001','Bolt','4','CN1 - Item Added']]);let saved;
 const raw={access:async()=>({canReview:true}),get:async()=>({fileName:'components.xlsx',fileSize:bytes.length,fileKey:'x',sourcePurpose:'supplied'})};
 const reviews={list:async()=>({reviews:[]}),save:async(s,id,v,d)=>{saved=d;return {recordId:id,version:1,draft:d}},confirm:()=>assert.fail('no confirmation during analysis')};
 const service=createCustomerReviewService(raw,reviews,{get:async()=>({body:new Blob([bytes]).stream()})},()=>assert.fail('use exact Excel cells'));
 await service.analyze({companyId:'c',projectId:'p',userId:'u',systemRoles:['ADMIN']},'doc',['doc'],'분석');
 assert.equal(saved.suppliedItems[0].itemNumber,'001');assert.equal(saved.suppliedItems[0].quantity,4);assert.equal(saved.documentType,'supplied');assert.deepEqual(saved.items,[]);
});
