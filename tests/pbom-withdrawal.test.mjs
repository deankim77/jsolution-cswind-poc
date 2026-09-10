import test from 'node:test';
import assert from 'node:assert/strict';
import {planPbomWithdrawal as plan} from '../lib/pbom-withdrawal.ts';
const edge=(id,parentPartId,childPartId,quantity=1)=>({id,parentPartId,childPartId,quantity,unit:'EA',sortOrder:0,note:null});
const tree=()=>[edge('a','top','assy'),edge('b','assy','sub'),edge('c','sub','part')];
const baseline=edges=>edges.map(e=>({edgeId:e.id,before:null,after:{...e}}));
test('sole-document new tree withdraws completely; repeated withdrawal is empty',()=>{
 const e=tree();assert.deepEqual(plan(e,e.map(e=>e.id),[],baseline(e)),{remove:['a','b','c'],restore:[],retained:[]});
 assert.deepEqual(plan([],[],[],[]),{remove:[],restore:[],retained:[]});
});
test('existing definition is restored instead of deleted',()=>{
 const e=[edge('a','top','assy',4)],before={...e[0],quantity:2};
 assert.deepEqual(plan(e,['a'],[],[{edgeId:'a',before,after:e[0]}]),{remove:[],restore:[before],retained:[]});
});
test('another document keeps its shared branch and attachment path',()=>{
 const e=tree(),r=plan(e,['a','b','c'],['b'],baseline(e));
 assert.deepEqual(r.remove,[]);assert.deepEqual(new Set(r.retained),new Set(['a','b','c']));
});
test('manual change preserves its path while unrelated owned siblings withdraw',()=>{
 const e=[...tree(),edge('d','assy','other')],b=baseline(e);e[2].quantity=9;
 const r=plan(e,['a','b','c','d'],[],b);
 assert.deepEqual(r.remove,['d']);assert.deepEqual(new Set(r.retained),new Set(['a','b','c']));
});
test('manually inserted descendant retains attachment without deleting manual edge',()=>{
 const e=tree(),b=baseline(e);e.push(edge('manual','sub','extra'));
 const r=plan(e,['a','b','c'],[],b);
 assert.deepEqual(r.remove,['c']);assert.deepEqual(new Set(r.retained),new Set(['a','b']));
});
test('legacy confirmations without rollback evidence preserve existing BOM',()=>{
 const e=tree(),r=plan(e,['a','b','c'],[],[]);
 assert.deepEqual(r.remove,[]);assert.deepEqual(r.restore,[]);assert.equal(r.retained.length,3);
});
test('external assembly reuse preserves its child definitions',()=>{
 const e=tree(),b=baseline(e);e.push(edge('external','other-top','assy'));
 const r=plan(e,['a','b','c'],[],b);
 assert.deepEqual(r.remove,[]);assert.deepEqual(new Set(r.retained),new Set(['a','b','c']));
});
