import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {bulkCell,updateBulkCell,mergeBulkEdits,parseGridClipboard,activeBulkRows}=require('../lib/production-bulk-edit.ts');
const item=(id='i')=>({id,recordId:'raw',area:'extract',title:'Note',detail:'Original',source:'page 1 notes',useTargets:['기타'],assy:'',part:'',itemNumber:'',itemName:''});
const source=()=>({id:'confirmed',companyId:'c',projectId:'p',recordId:'raw',version:1,item:item(),confirmedBy:'u',confirmedAt:1});
test('TRR display and editing preserve legacy target identity',()=>{
 const row={...source(),item:{...item(),useTargets:['TTR','기타']}};
 assert.equal(bulkCell(row,'extract','useTargets'),'TRR / 기타');
 assert.deepEqual(updateBulkCell(row,'extract','useTargets','TRR / 기타').item.useTargets,['TTR','기타']);
 assert.deepEqual(mergeBulkEdits([row],[row],'extract'),[row]);
});
test('clipboard handles Excel tabs, CRLF and quoted multiline cells',()=>{
 assert.deepEqual(parseGridClipboard('A\t"line1\nline2"\r\nB\t"say ""yes"""\r\n'),[['A','line1\nline2'],['B','say "yes"']]);
 assert.throws(()=>parseGridClipboard('"unfinished'));
});
test('bulk edits preserve provenance and hierarchy, accept blanks, and reject invalid values atomically',()=>{
 const row={...source(),item:{...item(),area:'pbom',bom:{parentId:'root',quantity:1,weight:18.5,unit:'PCS'}}};
 assert.equal(updateBulkCell(row,'pbom','quantity','').item.bom.quantity,null);
 assert.equal(updateBulkCell(row,'pbom','weight','1,260').item.bom.weight,1260);
 assert.throws(()=>updateBulkCell(row,'pbom','quantity','-1'));
 assert.throws(()=>updateBulkCell(row,'pbom','parentId','other'));
 assert.deepEqual(mergeBulkEdits([row],[row],'pbom'),[row]);
 const base=[source()],input=[{...source(),recordId:'attacker',item:{...item(),recordId:'attacker',source:'fake',detail:'Changed',useTargets:['TTR','기타']}}];
 const edited=mergeBulkEdits(base,input,'extract');assert.equal(edited[0].recordId,'raw');assert.equal(edited[0].item.source,'page 1 notes');assert.equal(edited[0].item.detail,'Changed');assert.equal(base[0].item.detail,'Original');
 assert.throws(()=>mergeBulkEdits(base,[],'extract'));
 assert.throws(()=>mergeBulkEdits(base,[{...source(),item:{...item(),useTargets:['INVALID']}}],'extract'));
});
test('PBOM rows retain parent-first hierarchy and latest conditional snapshot',()=>{
 const root={...source(),id:'root-row',item:{...item('root'),area:'pbom',bom:{parentId:null,position:''}}};
 const child={...source(),id:'child-row',item:{...item('child'),area:'pbom',bom:{parentId:'root',position:'1'}}};
 assert.deepEqual(activeBulkRows([child,root],'pbom').map(row=>[row.item.id,row.level]),[['root',1],['child',2]]);
 assert.equal(activeBulkRows([root,{...root,version:2,item:{...root.item,approval:{status:'conditional',issues:[]}}}],'pbom').length,1);
});
function harness(apply=async()=>{}){
 let data={customerConfirmedData:[source()],productionBulkLocks:[],auditLogs:[],bomEditLocks:[],productBomItems:[],productParts:[],customerPartIdentities:[],productionBomRoots:[],customerBomOccurrences:[]};
 const tables=Object.fromEntries(Object.keys(data).map(name=>[name,new Proxy({name},{get:(target,key)=>key==='name'?name:`${name}.${String(key)}`})]));
 const evaluate=(condition,row)=>!condition||condition.kind==='and'?(!condition||condition.args.every(c=>evaluate(c,row))):condition.kind==='eq'?row[condition.col.split('.')[1]]===condition.value:condition.values.includes(row[condition.col.split('.')[1]]);
 const db={
  select:()=>({from:table=>{let condition;const chain={where:c=>{condition=c;return chain},then:resolve=>Promise.resolve(data[table.name].filter(row=>evaluate(condition,row)).map(row=>structuredClone(row))).then(resolve)};return chain;}}),
  insert:table=>({values:input=>{let done=false,result=[];const execute=()=>{if(!done){done=true;for(const v of Array.isArray(input)?input:[input]){data[table.name].push(structuredClone(v));result.push(v)}}return result};const chain={then:resolve=>Promise.resolve(execute()).then(resolve),onConflictDoNothing:()=>chain,returning:async()=>execute()};return chain;}}),
  update:table=>({set:values=>({where:async condition=>{for(const row of data[table.name])if(evaluate(condition,row))Object.assign(row,structuredClone(values))}})}),
  delete:table=>({where:async condition=>{data[table.name]=data[table.name].filter(row=>!evaluate(condition,row))}}),
  transaction:async fn=>{const before=structuredClone(data);try{return await fn(db)}catch(e){data=before;throw e}}
 };
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL('../db/repositories/production-bulk-repository.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mocks={
 'drizzle-orm':{eq:(col,value)=>({kind:'eq',col,value}),and:(...args)=>({kind:'and',args}),inArray:(col,values)=>({kind:'in',col,values})},
 '../index':{getDb:()=>db},'../customer-review-schema':tables,'../schema':tables,'../pbom-schema':tables,
 './customer-data-repository':{customerDataAccess:async(db,s)=>{if(s.projectId!=='p')throw Error('denied');return {canReview:s.userId!=='viewer'}}},
 './pbom-repository':{lockPbomCompany:async()=>{},numberApprovedPbom:async()=>{},applyConfirmedPbom:apply}
 };
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>mocks[name]??require(name.startsWith('../../lib/')?'../lib/'+name.slice('../../lib/'.length)+'.ts':name)});
 return {repo:module.exports.createProductionBulkRepository(db),data:()=>data};
}
const scope={companyId:'c',projectId:'p',userId:'u',systemRoles:['ADMIN']};
test('checkout ownership, rollback on validation failure, successful checkin and cancellation',async()=>{
 const h=harness(),r=h.repo;
 await assert.rejects(r.mutate({...scope,userId:'viewer'},'extract','checkout','',null),e=>e.status===403);
 const checkout=await r.mutate(scope,'extract','checkout','',null);assert.ok(checkout.lock.token);
 await assert.rejects(r.mutate({...scope,userId:'other'},'extract','checkout','',null),e=>e.status===409);
 const other=await r.read({...scope,userId:'other'},'extract');assert.equal(other.lock.token,undefined);assert.equal(other.lock.mine,false);
 await assert.rejects(r.mutate({...scope,userId:'other'},'extract','cancel',checkout.lock.token,null),e=>e.status===409);
 const invalid=checkout.rows.map(row=>({...row,item:{...row.item,useTargets:['invalid']}}));
 await assert.rejects(r.mutate(scope,'extract','checkin',checkout.lock.token,invalid),e=>e.status===422);
 assert.equal(h.data().productionBulkLocks.length,1);assert.equal(h.data().customerConfirmedData[0].item.detail,'Original');
 const changed=checkout.rows.map(row=>({...row,item:{...row.item,detail:'Edited'}}));
 const saved=await r.mutate(scope,'extract','checkin',checkout.lock.token,changed);assert.equal(saved.changed,1);
 assert.equal(h.data().customerConfirmedData[0].item.detail,'Edited');assert.equal(h.data().productionBulkLocks.length,0);assert.equal(h.data().auditLogs.length,1);
 const second=await r.mutate(scope,'extract','checkout','',null);await r.mutate(scope,'extract','cancel',second.lock.token,null);assert.equal(h.data().customerConfirmedData[0].item.detail,'Edited');assert.equal(h.data().productionBulkLocks.length,0);
});
test('stale snapshot and foreign project access cannot overwrite data',async()=>{
 const h=harness(),checkout=await h.repo.mutate(scope,'extract','checkout','',null);
 h.data().customerConfirmedData[0].item.detail='Concurrent change';
 await assert.rejects(h.repo.mutate(scope,'extract','checkin',checkout.lock.token,checkout.rows),e=>e.status===409);
 assert.equal(h.data().customerConfirmedData[0].item.detail,'Concurrent change');assert.equal(h.data().productionBulkLocks.length,1);
 await assert.rejects(h.repo.read({...scope,projectId:'other'},'extract'),/denied/);
});
test('PBOM checkin restores both locks on application failure and retains conditional approval',async()=>{
 let fail=true;
 const h=harness(async(tx,s,record,version,items,force)=>{assert.equal(force,true);if(fail)throw Error('application failed');return {issues:['단위 확인 필요']}});
 h.data().customerConfirmedData[0].item={...item(),area:'pbom',bom:{parentId:null,section:'',itemDescription:'Bracket',position:'',customerItemNumber:'BR-1',drawingNumber:'D-1',componentRevision:'R00',quantity:1,unit:'',weight:18.5,weightUnit:'kg',weightSource:'Direct from Drawing',drawingAvailability:'Drawing Found',partType:'ASSEMBLY',childrenComplete:false}};
 h.data().productionBomRoots.push({companyId:'c',projectId:'p',rootPartId:'root'});
 const checkout=await h.repo.mutate(scope,'pbom','checkout','',null);
 assert.equal(h.data().bomEditLocks.length,1);
 const edited=checkout.rows.map(row=>updateBulkCell(row,'pbom','weight','19'));
 await assert.rejects(h.repo.mutate(scope,'pbom','checkin',checkout.lock.token,edited),/application failed/);
 assert.equal(h.data().bomEditLocks.length,1);assert.equal(h.data().productionBulkLocks.length,1);
 fail=false;await h.repo.mutate(scope,'pbom','checkin',checkout.lock.token,edited);
 assert.equal(h.data().bomEditLocks.length,0);assert.equal(h.data().productionBulkLocks.length,0);
 assert.equal(h.data().customerConfirmedData[0].item.bom.weight,19);
 assert.equal(h.data().customerConfirmedData[0].item.approval.status,'conditional');
});

const {approvedPbomView}=require('../lib/production-pbom-view.ts');
const {buildBomRows}=require('../lib/pbom-contract.ts');
const bom=(id,parentId=null)=>({parentId,section:'',itemDescription:id,position:id,customerItemNumber:id,drawingNumber:'',componentRevision:'R00',quantity:1,unit:'PCS',weight:null,weightUnit:'kg',weightSource:'Not Available',drawingAvailability:'Need Review',partType:parentId?'PART':'ASSEMBLY',childrenComplete:false});
function approvedDoc(doc,count,version=1){return Array.from({length:count},(_,i)=>({id:`${doc}-${version}-${i}`,recordId:doc,version,confirmedBy:'u',confirmedAt:1,item:{...item(`${version}-${i}`),recordId:doc,area:'pbom',bom:bom(`${doc}-${i}`,i?`${version}-0`:null),approval:{status:'conditional',issues:['unit']}}}));}
test('all 46 approved rows including conditional rows appear, with durable edit bindings',()=>{
 const docs=[...approvedDoc('a',13),...approvedDoc('b',1),...approvedDoc('c',16),...approvedDoc('d',16)];
 docs[14].item.bom.unit='';docs[15].item.bom.quantity=null;
 const old=buildBomRows(approvedDoc('a',13).map(r=>r.item)).map(r=>({...r,sourceItemId:'outdated-id'}));
 const view=approvedPbomView({root:null,rows:old,identities:[]},docs);
 assert.equal(view.rows.length,46);assert.equal(new Set(view.rows.map(r=>r.confirmationId)).size,46);
 assert.equal(view.rows.find(r=>r.confirmationId===docs[14].id).bom.unit,'');
 assert.equal(view.rows.find(r=>r.confirmationId===docs[15].id).bom.quantity,null);
 assert.ok(view.rows.every(r=>docs.some(d=>d.id===r.confirmationId)));
});
test('latest approved version replaces earlier approval, preserves manual child and original facts',()=>{
 const first=approvedDoc('a',2),latest=approvedDoc('a',2,2);
 const applied=buildBomRows(first.map(r=>r.item)).map(r=>({...r,sourceItemId:r.id}));
 const manual={...applied[1],id:'manual',recordId:'',sourceItemId:undefined,bom:{...applied[1].bom,parentId:applied[0].id},match:'MANUAL'};
 const view=approvedPbomView({root:null,rows:[...applied,manual],identities:[]},[...first,...latest]);
 assert.equal(view.rows.length,3);assert.equal(view.rows[0].confirmationId,latest[0].id);
 assert.equal(view.rows[2].bom.parentId,view.rows[0].id);
 assert.equal(latest[1].item.bom.parentId,'2-0');
});
test('approval numbering accepts missing quantity/unit, is idempotent, and survives identity completion',async()=>{
 const sourceCode=fs.readFileSync(new URL('../db/repositories/pbom-repository.ts',import.meta.url),'utf8');
 const functionCode=sourceCode.slice(sourceCode.indexOf('export async function numberApprovedPbom'),sourceCode.indexOf('/** Called in the review'));
 const module={exports:{}},identities=[],parts=[];
 vm.runInNewContext(ts.transpileModule(functionCode,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  module,exports:module.exports,Map,Set,identityRows:async()=>identities,
  bomIdentity:b=>b.customerItemNumber?`ITEM:${b.customerItemNumber}`:'',randomUUID:()=>String(identities.length),
  createNumberedPart:async(tx,s,name,partType,unit,spec)=>{const part={id:`p${parts.length}`,partNumber:`P-${parts.length}`,name,unit,spec};parts.push(part);return part},
  productParts:{id:'id'},customerPartIdentities:{},eq:(col,value)=>value
 });
 const tx={update:()=>({set:values=>({where:async id=>Object.assign(parts.find(p=>p.id===id),values)})}),insert:()=>({values:async value=>identities.push({...value,key:value.customerKey,partNumber:parts.find(p=>p.id===value.partId).partNumber})})};
 const items=approvedDoc('missing',1).map(r=>({...r.item,bom:{...r.item.bom,customerItemNumber:'',quantity:null,unit:''}}));
 await module.exports.numberApprovedPbom(tx,scope,items);await module.exports.numberApprovedPbom(tx,scope,items);
 assert.equal(parts.length,1);assert.equal(parts[0].unit,'');assert.equal(parts[0].revision,'00');assert.equal(parts[0].spec,items[0].bom.itemDescription.trim());
 items[0].bom.customerItemNumber='CUSTOMER-1';await module.exports.numberApprovedPbom(tx,scope,items);
 assert.equal(parts.length,1);assert.equal(identities.find(i=>i.key==='ITEM:CUSTOMER-1').partId,parts[0].id);
});
