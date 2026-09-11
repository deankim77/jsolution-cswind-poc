import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
require.extensions['.css']=()=>{};
const Component=require('../app/v2/trr-review-details.tsx').default;
const {renderToStaticMarkup}=require('react-dom/server');
const draft={documentType:'report',summary:'',uncertainties:[],drawingNumber:'',revisionLabel:'',items:[{id:'one',recordId:'doc',area:'trr',title:'조립 주의사항',detail:'원본 조건',source:'p.1',trrSection:'조립',trrKind:'current'}]};
const nodes=root=>!root||typeof root!=='object'?[]:Array.isArray(root)?root.flatMap(nodes):[root,...nodes(root.props?.children)];
test('review editor exposes numbered destinations and blocks reflection until changes are saved',()=>{
 let changed;const props={draft,version:2,disabled:false,dirty:false,onChange:d=>{changed=d},onApply:()=>{}};
 const tree=Component(props),html=renderToStaticMarkup(tree);assert.match(html,/5. 조립/);assert.match(html,/검토 대기/);assert.match(html,/출처/);
 nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'보완한 조건'}});
 assert.equal(changed.items[0].detail,'보완한 조건');assert.equal(draft.items[0].detail,'원본 조건');
 const edited=Component({...props,draft:changed,dirty:true});assert.equal(nodes(edited).find(n=>n.type==='button').props.disabled,true);
 const applied=Component({...props,appliedVersion:2,wordVersion:3});assert.match(renderToStaticMarkup(applied),/V003.*반영 완료/);assert.equal(nodes(applied).find(n=>n.type==='button').props.disabled,true);
});
