import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
function load(path,require){const exports={};const out=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});assert.equal(out.diagnostics.length,0);vm.runInNewContext(out.outputText,{exports,require});return exports;}
const {productionStages,productionProgress}=load('app/v2/production-dashboard-data.ts');
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
const {GateProjectDashboard}=load('app/v2/gate-dashboards.tsx',name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsxRuntime;if(name==='./production-dashboard-data')return {productionStages,productionProgress};if(name.includes('dashboard-data-store'))return {useSharedProjectDashboard:()=>({issues:[],deliverables:[],gates:[]}),useSharedDashboard:()=>null};if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});if(name.endsWith('.css'))return {};throw Error(name);});
for(const production of [true,false])test(production?'production renders P stages without Gate approvals':'development retains G1–G6',()=>{const html=renderToStaticMarkup(React.createElement(GateProjectDashboard,{project:{id:'p',name:'Demo',projectTypeCode:production?'PRODUCTION':'RD'},tasks,onOpenTask(){},onNavigate(){},onEdit(){},onAi(){}}));assert.ok(html.includes(production?'P1~P6 생산 진행 현황':'G1~G6 Stage-Gate 진행 현황'));if(production){assert.ok(!html.includes('Gate 통과'));assert.ok(!html.includes('Review 일정'));assert.ok(html.includes('생산준비'));}});
const scheduled=(progress=20)=>[{id:'p',wbsCode:'1',kind:'summary',name:'P1 준비',status:'active',progress:0},{id:'t',wbsCode:'1.1',parentId:'p',kind:'task',name:'작업',status:progress===100?'completed':'active',progress,plannedStart:'2026-09-01',plannedEnd:'2026-09-10',durationDays:10}];
test('calendar baseline boundaries and schedule gap',()=>{assert.equal(productionStages(scheduled(),'2026-08-31')[0].plannedProgress,0);const mid=productionStages(scheduled(),'2026-09-05')[0];assert.equal(mid.plannedProgress,50);assert.equal(mid.delay,30);assert.equal(productionStages(scheduled(),'2026-09-10')[0].plannedProgress,100);assert.equal(productionStages(scheduled(),'2026-09-11')[0].plannedProgress,100);});
test('early completion preserves current plan rather than forcing 100',()=>{const s=productionStages(scheduled(100),'2026-09-08')[0];assert.equal(s.progress,100);assert.equal(s.plannedProgress,80);assert.equal(s.delay,0);});
test('missing or invalid dates do not invent a baseline',()=>{assert.equal(productionStages(tasks)[0].plannedProgress,null);const input=scheduled();input[1].plannedEnd='2026-08-30';assert.equal(productionStages(input)[0].delay,null);});

test('overall uses leaf duration weights, not an average of stage percentages',()=>{const input=scheduled(100);input.push({...input[1],id:'second',wbsCode:'2.1',parentId:'other',progress:0,durationDays:30});const result=productionProgress(input,'2026-09-05');assert.equal(result.progress,25);assert.equal(result.plannedProgress,50);assert.equal(result.delay,25);});
