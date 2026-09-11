import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const contract=require('../lib/pbom-contract.ts'), quantities=require('../lib/bom-quantities.ts');
const source=fs.readFileSync(new URL('../db/repositories/pbom-repository.ts',import.meta.url),'utf8');
const code=source.slice(source.indexOf('export async function applyConfirmedPbom'),source.indexOf('/** The review repository owns'));
const scope={companyId:'company',projectId:'project',userId:'user'};
function setup(){
 const names=['productParts','productBomItems','customerBomOccurrences','projectsDb','bomEditLocks','auditLogs','bomRevisions','customerPartIdentities'];
 const tables=Object.fromEntries(names.map(name=>[name,{name,...Object.fromEntries(['id','companyId','projectId','recordId','rootPartId','customerKey'].map(k=>[k,k]))}]));
 const state=Object.fromEntries(names.map(n=>[n,[]]));state.projectsDb=[{id:'project',companyId:'company',name:'Project'}];
 const known=[];let seq=0;
 const query=(table,mode,values,projection)=>{let filter=()=>true;
  const execute=()=>{const all=state[table.name];if(mode==='select')return projection&&'n' in projection?[{n:0}]:all.filter(filter);
   if(mode==='insert'){const list=Array.isArray(values)?values:[values];all.push(...list);return list;}
   if(mode==='delete'){state[table.name]=all.filter(r=>!filter(r));return [];}
   return all.filter(filter).map(row=>Object.assign(row,values));};
  const q={where(fn){filter=fn;return q},returning(){return Promise.resolve(execute())},onConflictDoNothing(){return q},then(resolve,reject){return Promise.resolve().then(execute).then(resolve,reject)}};return q;
 };
 const tx={select:projection=>({from:t=>query(t,'select',null,projection)}),insert:t=>({values:v=>query(t,'insert',v)}),update:t=>({set:v=>query(t,'update',v)}),delete:t=>query(t,'delete')};
 const module={exports:{}};
 const numberApprovedPbom=async(tx,s,items)=>{for(const item of items){const key=contract.bomIdentity(item.bom),alias=`APPROVED:${item.recordId}:${item.id}`;let match=known.find(i=>i.key===key||i.key===alias);if(!match){match={partId:'part-'+item.id,partNumber:'P-'+item.id,revision:item.bom.componentRevision};state.productParts.push({id:match.partId,partNumber:match.partNumber,companyId:'company',partType:item.bom.partType,spec:item.bom.itemDescription});}for(const k of [key,alias].filter(Boolean))if(!known.some(i=>i.key===k))known.push({...match,key:k});}};
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,...tables,...contract,...quantities,Map,Set,Number,JSON,Math,Boolean,Error,randomUUID:()=>`id-${++seq}`,now:()=>1,assertNoProductionBulkLock:async()=>{},CustomerDataError:Error,identityRows:async()=>known,numberApprovedPbom,ensureProductionBomRoot:async()=>({rootPartId:'TOP'}),scoped:()=>r=>r.companyId==='company'&&r.projectId==='project',eq:(k,v)=>r=>r[k]===v,and:(...f)=>r=>f.every(fn=>fn(r)),inArray:(k,v)=>r=>v.includes(r[k]),sql:()=>0});
 return {state,apply:(recordId,items)=>module.exports.applyConfirmedPbom(tx,scope,recordId,1,items)};
}
const item=(id,parentId,recordId='doc',extra={})=>({id,recordId,area:'pbom',source:'drawing',bom:{parentId,section:'',itemDescription:id,position:'',customerItemNumber:id,drawingNumber:'D-'+id,componentRevision:'R00',quantity:null,unit:'',weight:null,weightUnit:'',weightSource:'Not Available',drawingAvailability:'Need Review',partType:parentId?'PART':'ASSEMBLY',childrenComplete:false,...extra}});
test('conditional approval persists TOP to assembly to part, preserving unknown quantity and unit',async()=>{
 const h=setup(),items=[item('assy',null),item('part','assy')];const result=await h.apply('doc',items);
 assert.equal(result.conditional,true);assert.equal(h.state.productBomItems.length,2);
 assert.deepEqual(h.state.productBomItems.map(e=>[e.parentPartId,e.childPartId,e.quantity,e.unit]),[['TOP','part-assy',1,''],['part-assy','part-part',null,'']]);
 assert.equal(h.state.customerBomOccurrences.length,2);assert.equal(h.state.bomEditLocks.length,0);
 await h.apply('doc',items);assert.equal(h.state.productBomItems.length,2);
});
test('a standalone part stays under TOP when later reused by an assembly',async()=>{
 const h=setup();await h.apply('single',[item('part',null,'single',{partType:'PART',quantity:1})]);
 await h.apply('assembly',[item('assy',null,'assembly'),item('part','assy','assembly',{quantity:2})]);
 assert.equal(h.state.productBomItems.length,3);
 assert.equal(h.state.productBomItems.filter(e=>e.childPartId==='part-part').length,2);
});
test('missing customer identity still receives a stable internal alias and structure',async()=>{
 const h=setup();await h.apply('doc',[item('root',null,'doc',{customerItemNumber:'',drawingNumber:''})]);
 assert.equal(h.state.productBomItems[0].childPartId,'part-root');
});
test('unknown quantities propagate through sums and comparisons',()=>{
 assert.equal(quantities.sumBomQuantities([2,null]),null);assert.equal(quantities.sameBomQuantity(null,0),false);assert.equal(quantities.sameBomQuantity(null,null),true);
});
test('shared known quantities cannot be overwritten by conflicting documents',async()=>{
 const h=setup();await h.apply('doc',[item('assy',null),item('part','assy','doc',{quantity:2,unit:'PCS'})]);
 await assert.rejects(h.apply('other',[item('assy',null,'other'),item('part','assy','other',{quantity:3,unit:'PCS'})]),/다릅니다/);
 assert.equal(h.state.productBomItems.find(e=>e.childPartId==='part-part').quantity,2);
});
test('missing incoming values preserve known quantities and units on shared edges',async()=>{
 const h=setup();await h.apply('doc',[item('assy',null),item('part','assy','doc',{quantity:2,unit:'PCS'})]);
 await h.apply('other',[item('assy',null,'other'),item('part','assy','other')]);
 const edge=h.state.productBomItems.find(e=>e.childPartId==='part-part');assert.equal(edge.quantity,2);assert.equal(edge.unit,'PCS');
});
test('cost rollup does not turn unknown quantities into zero or one',()=>{
 const route=fs.readFileSync(new URL('../app/api/product-data/route.ts',import.meta.url),'utf8');
 const start=route.indexOf('function rollup('),end=route.indexOf('\n}\n',start)+3;
 const context={Map,Set,Object,Math,Number};vm.createContext(context);
 vm.runInContext(ts.transpileModule(route.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const parts=[{id:'root',standardCost:0},{id:'part',standardCost:10}];
 assert.equal(context.rollup(parts,[{parentPartId:'root',childPartId:'part',quantity:null}]).root,null);
 assert.equal(context.rollup(parts,[{parentPartId:'root',childPartId:'part',quantity:2}]).root,20);
});
