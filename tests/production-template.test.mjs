import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import template from '../lib/production/tc800-template.json' with {type:'json'};
import {productionSchedule} from '../lib/production/schedule.ts';
import {readTc800InitialPackage} from '../services/tc800-zip.mjs';

test('TC800 has six stages, four main assemblies and twelve subassemblies with real output slots',()=>{
  const roots=template.wbs.filter(row=>row.level===1);
  assert.equal(roots.length,6);assert.equal(roots[0].name,'P1 생산준비단계');assert.equal(roots[5].name,'P6 FAT 및 출하');
  assert.equal(template.wbs.filter(row=>row.assemblyCode).length,12);
  const ids=new Set(template.wbs.map(row=>row.id));assert.equal(ids.size,template.wbs.length);
  for(const row of template.wbs){if(row.parentId)assert.ok(ids.has(row.parentId));if(row.kind==='task')assert.ok(row.deliverables.length>0);}
});
test('production schedule honors holidays and weekends and keeps assembly work parallel',()=>{
  const tasks=productionSchedule(template.wbs,'2026-09-11',[1,2,3,4,5],['2026-09-14']);
  assert.equal(tasks.find(r=>r.id==='1.2').plannedStart,'2026-09-15');
  const starts=['2.1.1','3.1.1','4.1.1','5.1.1'].map(id=>tasks.find(r=>r.id===id).plannedStart);
  assert.equal(new Set(starts).size,1);
  for(const row of tasks){assert.ok(!['2026-09-12','2026-09-13','2026-09-14'].includes(row.plannedStart));}
  assert.ok(tasks.find(r=>r.id==='6').plannedStart>tasks.find(r=>r.id==='5').plannedEnd);
});
test('invalid calendars and missing predecessors fail instead of looping or inventing dates',()=>{
  assert.throws(()=>productionSchedule(template.wbs,'2026-09-10',[],[]));
  assert.throws(()=>productionSchedule(template.wbs,'2026-02-30',[1],[]));
  assert.throws(()=>productionSchedule([{id:'a',name:'test',durationDays:1,predecessor:'missing'}],'2026-09-10',[1,2,3,4,5],[]));
});
test('ZIP importer rejects corrupt archives before any file registration',()=>{
  assert.throws(()=>readTc800InitialPackage(Buffer.from('not zip')));
  const empty=Buffer.alloc(22);empty.writeUInt32LE(0x06054b50);assert.throws(()=>readTc800InitialPackage(empty));
});
const archive=process.env.TC800_TEST_ZIP;
test('V4 imports exactly thirty original inputs and excludes change, history and answer data',{skip:!archive},()=>{
  const bytes=fs.readFileSync(archive);const files=readTc800InitialPackage(bytes);
  assert.equal(files.length,30);assert.equal(files.filter(f=>f.documentType==='drawing').length,24);
  assert.ok(files.every(f=>!/04_Change|05_Historical|06_Validation|Raw_Data_Master/.test(f.path)));
  const corrupt=Buffer.from(bytes);const nameAt=bytes.indexOf(Buffer.from(files[0].path));const local=nameAt-30;const payload=nameAt+Buffer.byteLength(files[0].path)+bytes.readUInt16LE(local+28);corrupt[payload+100]^=255;assert.throws(()=>readTc800InitialPackage(corrupt));
});
