import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {prepareReviewResponse}=require('../services/customer-review-response.ts');
const {validateReviewDraft}=require('../lib/customer-review-contract.ts');
test('optional absent metadata does not reject technical document and never confirms it',()=>{
 const input={documentType:'작업기준서',documentTypeConfirmed:true,drawingNumber:null,revisionLabel:null,summary:'원본 요약',missingData:null,uncertainties:null,items:[]};
 const result=validateReviewDraft(prepareReviewResponse(input),['doc']);
 assert.equal(result.documentType,'work_instruction');assert.equal(result.documentTypeConfirmed,false);assert.equal(result.drawingNumber,'');assert.deepEqual(result.missingData,[]);assert.equal(input.drawingNumber,null);
});
test('malformed substantive data is rejected with its field instead of being discarded',()=>{
 const base={documentType:'report',summary:'요약',items:[]};
 for(const [patch,field] of [[{summary:null},'summary'],[{items:{}},'items'],[{missingData:[{field:'조건',reason:null}]},'missingData[1].reason'],[{uncertainties:[{}]},'uncertainties[1]'],[{documentType:'made-up'},'documentType']]){
  assert.throws(()=>validateReviewDraft(prepareReviewResponse({...base,...patch}),['doc']),error=>error.message.includes(field));
 }
});
const fact=(customerItemNumber,partType='PART',parentId=null)=>({parentId,section:'',itemDescription:customerItemNumber,position:'',customerItemNumber,drawingNumber:'D',componentRevision:'R00',quantity:1,unit:'PCS',weight:null,weightUnit:'',weightSource:'Not Available',drawingAvailability:'Drawing Found',partType,childrenComplete:false});
const row=(id,bom)=>({id,recordId:'doc',area:'pbom',title:id,detail:id,source:'Parts List',bom});
const drawing=items=>({documentType:'drawing',drawingTitle:'HOIST SUB ASSEMBLY',drawingNumber:'D',revisionLabel:'R00',summary:'drawing',uncertainties:[],items});
test('six orphan parts cannot be saved as a successful drawing BOM',()=>{
 assert.throws(()=>validateReviewDraft(drawing(Array.from({length:6},(_,n)=>row('p'+n,fact('ITEM'+n)))),['doc']),/대표 ASSY/);
});
test('evidenced title-block assembly wraps all six parts without converting the first part',()=>{
 const parts=Array.from({length:6},(_,n)=>row('p'+n,fact('ITEM'+n)));
 const input={...drawing(parts),drawingRoot:row('root',fact('CUST-TC8-SUB02','ASSEMBLY'))};
 const result=validateReviewDraft(prepareReviewResponse(input),['doc']);
 assert.equal(result.items.length,7);assert.equal(result.items[0].bom.partType,'ASSEMBLY');
 for(const child of result.items.slice(1)){assert.equal(child.bom.parentId,'root');assert.equal(child.bom.partType,'PART');}
 assert.equal(parts[0].bom.parentId,null);
});
test('existing title-block root is not duplicated and ambiguous root identity is rejected',()=>{
 const root=row('assy',fact('ASSY','ASSEMBLY'));
 const result=validateReviewDraft(prepareReviewResponse({...drawing([root,row('child',fact('CHILD','PART','assy'))]),drawingRoot:{...root,id:'metadata'}}),['doc']);
 assert.equal(result.items.length,2);
 assert.throws(()=>prepareReviewResponse({...drawing([row('part',fact('ASSY'))]),drawingRoot:root}),/충돌/);
});
