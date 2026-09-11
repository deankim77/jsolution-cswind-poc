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
