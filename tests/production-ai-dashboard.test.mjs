import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {calculateAiMetrics,sumAiMetrics}=require('../lib/production-ai-metrics.ts');
const base=()=>({records:[],reviews:[],confirmed:[],supplied:[],reports:0,newParts:[],parts:[]});
const record=(id,revision=1,rawDataId=id,sourcePurpose='analysis')=>({id,revision,rawDataId,sourcePurpose});
test('latest revision only; legacy TRR purpose remains included; unanalyzed documents pending',()=>{
 const m=calculateAiMetrics({...base(),records:[record('old',1,'doc'),record('new',2,'doc'),record('template',1,'template','template'),record('pending')],reviews:[{recordId:'old',version:1,draft:{items:[{id:'old-item',area:'pbom'}]}},{recordId:'new',version:2,draft:{items:[{id:'new-item',area:'pbom'}]}}]});
 assert.equal(m.registered,3);assert.equal(m.analyzed,1);assert.equal(m.pending,2);assert.equal(m.bom,1);
});
test('current analysis confirmations determine applied counts; canceled report has no applied facts',()=>{
 const item={id:'t',area:'trr',title:'Torque',detail:'10',source:'A1',trrSection:'general'};
 const input={...base(),records:[record('doc')],reviews:[{recordId:'doc',version:2,draft:{items:[item,{id:'e',area:'extract'}],suppliedItems:[{id:'s'},{id:'deleted'}]}}],confirmed:[{recordId:'doc',version:1,item:{id:'e'}}],supplied:[{recordId:'doc',version:2,itemId:'deleted'}],report:{sources:[{id:'doc',facts:[{section:'general',title:'Torque',detail:'10',reference:'A1'}]}]}};
 let m=calculateAiMetrics(input);assert.equal(m.technicalApplied,0);assert.equal(m.technicalPending,1);assert.equal(m.trrApplied,1);assert.equal(m.suppliedApplied,1);assert.equal(m.suppliedPending,1);
 m=calculateAiMetrics({...input,confirmed:[{recordId:'doc',version:2,item:{id:'e'}}],report:{sources:[]}});assert.equal(m.technicalApplied,1);assert.equal(m.trrApplied,0);assert.equal(m.trrPending,1);
});
test('global aggregation counts shared internal parts once across assemblies and projects',()=>{
 const a=calculateAiMetrics({...base(),parts:['p1','p1','p2'],newParts:['p1','p1']}),b=calculateAiMetrics({...base(),parts:['p2','p3'],newParts:['p1','p3']});
 const total=sumAiMetrics([a,b]);assert.deepEqual(total.parts,['p1','p2','p3']);assert.deepEqual(total.newParts,['p1','p3']);
});
