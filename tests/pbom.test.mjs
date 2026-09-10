import test from 'node:test';
import assert from 'node:assert/strict';
import {collapsedBomIdsAtDepth,buildBomRows,formatPartNumber,validateBomFacts} from '../lib/pbom-contract.ts';
const fact=(patch={})=>({parentId:null,section:'Bottom',itemDescription:'MAST ASSY',position:'',customerItemNumber:'ASSY-1',drawingNumber:'D-1',componentRevision:'R00',quantity:2,unit:'EA',weight:null,weightUnit:'kg',weightSource:'Not Available',drawingAvailability:'Drawing Found',partType:'ASSEMBLY',childrenComplete:true,...patch});
const item=(id,bom)=>({id,recordId:'raw-1',source:'test.pdf R00 p1 Parts List',bom});
const tree=()=>[item('root',fact()),item('assy',fact({parentId:'root',customerItemNumber:'SUB-1',quantity:3})),item('part',fact({parentId:'assy',customerItemNumber:'PART-1',partType:'PART',quantity:4,weight:2,weightSource:'Parts List',childrenComplete:false}))];
test('recursive quantities multiply per parent and weights remain per assembly',()=>{const rows=buildBomRows(tree());assert.deepEqual(rows.map(r=>r.level),[1,2,3]);assert.deepEqual(rows.map(r=>r.totalQuantity),[2,6,24]);assert.deepEqual(rows.map(r=>r.calculatedWeight),[24,8,2]);assert.equal(rows[0].calculatedWeightSource,'Calculated from Child BOM');});
test('unknown quantity, incomplete child list and incompatible units never produce fabricated totals',()=>{const items=tree();items[2].bom.quantity=null;assert.equal(buildBomRows(items)[0].calculatedWeight,null);assert.equal(buildBomRows(items)[2].totalQuantity,null);items[2].bom.quantity=4;items[1].bom.childrenComplete=false;assert.equal(buildBomRows(items)[0].calculatedWeight,null);items[1].bom.childrenComplete=true;items[2].bom.weightUnit='g';assert.equal(buildBomRows(items)[0].calculatedWeight,null);});
test('same customer part reuses internal identity; changed revision is visible',()=>{const rows=buildBomRows(tree(),[{key:'ITEM:PART-1',partId:'part-id',partNumber:'P-000007',revision:'R01'}]);assert.equal(rows[2].match,'EXISTING');assert.equal(rows[2].internalPartNumber,'P-000007');assert.equal(rows[2].changed,true);assert.equal(rows[0].match,'NEW');});
test('missing parent, cycle and inconsistent customer revisions block confirmation',()=>{const t=tree();t[1].bom.parentId='missing';assert.throws(()=>validateBomFacts(t));t[1].bom.parentId='root';t[0].bom.parentId='assy';assert.throws(()=>validateBomFacts(t));t[0].bom.parentId=null;t.push(item('duplicate',fact({parentId:'root',customerItemNumber:'PART-1',partType:'PART',componentRevision:'R03'})));assert.throws(()=>validateBomFacts(t));});
test('negative and nonfinite quantities are rejected and unknown identity remains reviewable',()=>{const t=tree();t[2].bom.quantity=-1;assert.throws(()=>buildBomRows(t));t[2].bom.quantity=Infinity;assert.throws(()=>buildBomRows(t));t[2].bom.quantity=1;t[2].bom.customerItemNumber='';t[2].bom.drawingNumber='';assert.equal(buildBomRows(t)[2].match,'NEED_REVIEW');});
test('company numbering is independent of role, hierarchy and customer revision',()=>{assert.equal(formatPartNumber({prefix:'P',separator:'-',digits:6},7),'P-000007');assert.equal(formatPartNumber({prefix:'CSW',separator:'',digits:4},38),'CSW0038');assert.throws(()=>formatPartNumber({prefix:'P',separator:'-',digits:3},1000));});
test('direct assembly mass takes precedence over a calculated sum',()=>{const t=tree();t[0].bom.weight=30;t[0].bom.weightSource='Direct from Drawing';const [root]=buildBomRows(t);assert.equal(root.calculatedWeight,30);assert.equal(root.calculatedWeightSource,'Direct from Drawing');});

test('document depth presets handle three levels and multiple root assemblies',()=>{
 const rows=buildBomRows([...tree(),item('root-2',fact({customerItemNumber:'ASSY-2'})),item('child-2',fact({parentId:'root-2',customerItemNumber:'PART-2',partType:'PART'}))]);
 const visible=depth=>{const collapsed=new Set(collapsedBomIdsAtDepth(rows,depth));return rows.filter(row=>{let parent=row.bom.parentId;while(parent){if(collapsed.has(parent))return false;parent=rows.find(r=>r.id===parent)?.bom.parentId??null}return true}).map(r=>r.id)};
 assert.deepEqual(visible(1),['root','root-2']);
 assert.deepEqual(visible(2),['root','assy','root-2','child-2']);
 assert.deepEqual(visible(Infinity),rows.map(r=>r.id));
 assert.deepEqual(rows.map(r=>r.level),[1,2,3,1,2]);
});

test('missing document root quantity defaults to one without mutating raw input',()=>{
 const t=tree();t[0].bom.quantity=null;
 const r=buildBomRows(t);
 assert.equal(r[0].bom.quantity,1);assert.equal(r[2].totalQuantity,12);
 assert.equal(t[0].bom.quantity,null);
});
test('explicit root quantities remain authoritative and missing child quantities remain unknown',()=>{
 const t=tree();t[0].bom.quantity=5;t[1].bom.quantity=null;
 const r=buildBomRows(t);assert.equal(r[0].bom.quantity,5);assert.equal(r[1].bom.quantity,null);assert.equal(r[2].totalQuantity,null);
 t[0].bom.quantity=0;assert.throws(()=>buildBomRows(t));
});
