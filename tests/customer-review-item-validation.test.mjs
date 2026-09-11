import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {validateReviewDraft}=require('../lib/customer-review-contract.ts');
const item={id:'one',recordId:'doc',area:'extract',title:'제목',detail:'본문',source:'원본 근거',useTargets:['기타']};
const draft=items=>({documentType:'drawing',drawingNumber:'D1',revisionLabel:'R00',summary:'요약',uncertainties:[],items});
test('invalid item identifies its index and field without accepting missing evidence',()=>{
 for(const [patch,field] of [[{id:''},'id'],[{recordId:'other'},'recordId'],[{area:'invalid'},'area'],[{title:''},'title'],[{detail:null},'detail'],[{source:' '},'source']]){
  assert.throws(()=>validateReviewDraft(draft([item,{...item,id:'two',...patch}]),['doc']),error=>error.message.includes(`items[2].${field}`));
 }
 assert.throws(()=>validateReviewDraft(draft([item,item]),['doc']),/items\[2\]\.id.*중복/);
 assert.throws(()=>validateReviewDraft(draft([null]),['doc']),/items\[1\]/);
 assert.equal(validateReviewDraft(draft([item]),['doc']).items[0].source,'원본 근거');
});
