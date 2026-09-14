import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
function load(path,require){const exports={};const out=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});assert.equal(out.diagnostics.length,0);vm.runInNewContext(out.outputText,{exports,require});return exports;}
const {productionStages}=load('app/v2/production-dashboard-data.ts');
const tasks=[
{id:'p1',wbsCode:'1',kind:'summary',name:'P1 생산준비',status:'active',progress:0},
{id:'sub',wbsCode:'1.1',parentId:'p1',kind:'summary',name:'조립',status:'active',progress:0},
{id:'a',wbsCode:'1.1.1',parentId:'sub',kind:'task',name:'A',status:'completed',progress:100,durationDays:1},
{id:'b',wbsCode:'1.2',parentId:'p1',kind:'task',name:'B',status:'active',progress:0,durationDays:3},
{id:'p2',wbsCode:'2',kind:'summary',name:'P2 제작',status:'active',progress:0},
{id:'c',wbsCode:'2.1',parentCode:'2',kind:'task',name:'C',status:'review',progress:100},
];
test('nested leaves count once, duration-weighted progress matches WBS rollup',()=>{const stages=productionStages(tasks);assert.equal(stages[0].total,2);assert.equal(stages[0].completed,1);assert.equal(stages[0].progress,25);assert.equal(stages[0].name,'생산준비');});
test('parallel stages remain active; review at 100 is not completed',()=>{assert.equal(productionStages(tasks).filter(s=>s.status==='active').length,2);assert.equal(productionStages(tasks)[1].completed,0);});
test('empty stages never count as completed; all children completed does',()=>{assert.equal(productionStages([]).filter(s=>s.status==='completed').length,0);assert.equal(productionStages(tasks.map(t=>t.kind==='task'?{...t,status:'completed',progress:100}:t))[0].status,'completed');});
const {GateProjectDashboard}=load('app/v2/gate-dashboards.tsx',name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsxRuntime;if(name==='./production-dashboard-data')return {productionStages};if(name.includes('dashboard-data-store'))return {useSharedProjectDashboard:()=>({issues:[],deliverables:[],gates:[]}),useSharedDashboard:()=>null};if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});if(name.endsWith('.css'))return {};throw Error(name);});
for(const production of [true,false])test(production?'production renders P stages without Gate approvals':'development retains G1–G6',()=>{const html=renderToStaticMarkup(React.createElement(GateProjectDashboard,{project:{id:'p',name:'Demo',projectTypeCode:production?'PRODUCTION':'RD'},tasks,onOpenTask(){},onNavigate(){},onEdit(){},onAi(){}}));assert.ok(html.includes(production?'P1~P6 생산 진행 현황':'G1~G6 Stage-Gate 진행 현황'));if(production){assert.ok(!html.includes('Gate 통과'));assert.ok(!html.includes('Review 일정'));assert.ok(html.includes('생산준비'));}});
