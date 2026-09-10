"use client";
import {useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,Layers3} from 'lucide-react';
import {useColumnPreferences} from './use-column-preferences';
import PbomEditDialog from './pbom-edit-dialog';
import {ColumnVisibilityMenu,HierarchyActions} from './table-view-controls';
import {DRAWING_AVAILABILITY_LABELS,collapsedBomIdsAtDepth,type BomFact,type BomRow} from '../../lib/pbom-contract';

const show=(n:number|null)=>n===null?'미확인':Number(n.toFixed(6)).toLocaleString();
const labels={NEW:'NEW · 신규',EXISTING:'기존 부품',NEED_REVIEW:'확인 필요',MANUAL:'내부 추가'};
const columns=[
 {key:'part',label:'품번',locked:true},
 {key:'status',label:'구분 / 변경'},
 {key:'section',label:'Section',full:true},
 {key:'level',label:'LEVEL',full:true},
 {key:'description',label:'Item Description'},
 {key:'position',label:'Pos.'},
 {key:'item',label:'Item No.'},
 {key:'drawing',label:'Drawing No.'},
 {key:'revision',label:'CompRev'},
 {key:'quantity',label:'Qty Per Unit'},
 {key:'total',label:'Total Qty / Section',full:true},
 {key:'weight',label:'Weight'},
 {key:'weightSource',label:'Weight Source / Calculation Basis',full:true},
 {key:'availability',label:'Drawing Availability',full:true},
 {key:'source',label:'출처 자료',full:true},
] as const;
type ColumnKey=typeof columns[number]['key'];
const defaultColumnKeys:readonly ColumnKey[]=columns.map(c=>c.key);
const lockedColumnKeys:readonly ColumnKey[]=['part'];

export default function PbomTable({rows,root,toolbarContainer,variant="full",editable=false,onEdit,onOpenEditor,renderSource}:{toolbarContainer?:HTMLElement|null;rows:BomRow[];renderSource?:(recordIds:string[])=>ReactNode;variant?:"full"|"review";root?:{id:string;partNumber:string;name:string}|null;editable?:boolean;onEdit?:(id:string,fact:BomFact)=>void|Promise<void>;onOpenEditor?:(id:string)=>void}){
 const [collapsed,setCollapsed]=useState<string[]>([]),[editing,setEditing]=useState(''),[rootCollapsed,setRootCollapsed]=useState(false);
 const [columnMenuOpen,setColumnMenuOpen]=useState(false);
 const {visible:visibleColumns,change:setVisibleColumns,ready:columnsReady,error:columnsError,retry:retryColumns}=useColumnPreferences(`v2-pbom-columns:${variant}`,defaultColumnKeys,lockedColumnKeys);
 const review=variant==='review';
 const options=columns.filter(c=>!review||!('full' in c)).map(c=>({...c,label:review&&c.key==='description'?'품명 / ASSY 구조':review&&c.key==='item'?'고객 Item No.':c.label}));
 const shown=options.filter(c=>c.key==='part'||visibleColumns.has(c.key));
 const selected=rows.find(r=>r.id===editing);
 const hidden=(r:BomRow):boolean=>{let p=r.bom.parentId;const seen=new Set<string>();while(p&&!seen.has(p)){if(collapsed.includes(p))return true;seen.add(p);p=rows.find(x=>x.id===p)?.bom.parentId??null;}return false;};
 const toggle=(id:string)=>setCollapsed(v=>v.includes(id)?v.filter(key=>key!==id):[...v,id]);
 const toggleSlot=(row:BomRow,children:boolean)=><span className="pbom-toggle-slot">{children&&<button type="button" aria-expanded={!collapsed.includes(row.id)} aria-label={`${row.bom.itemDescription} ${collapsed.includes(row.id)?'펼치기':'접기'}`} onClick={()=>toggle(row.id)}>{collapsed.includes(row.id)?<ChevronRight size={18}/>:<ChevronDown size={18}/>}</button>}</span>;
 const partLink=(row:BomRow)=>onOpenEditor&&row.partId?<button type="button" onClick={()=>onOpenEditor(row.partId!)}>{row.internalPartNumber}</button>:<strong>{row.internalPartNumber||'확정 시 자동채번'}</strong>;
 const rootCell=(key:ColumnKey):ReactNode=>{
  if(!root)return null;
  if(key==='part')return <span className="pbom-tree-label pbom-part-tree-label"><span className="pbom-toggle-slot"><button type="button" disabled={!rows.length} aria-expanded={!rootCollapsed} aria-label={`${root.name} ${rootCollapsed?'펼치기':'접기'}`} onClick={()=>setRootCollapsed(v=>!v)}>{rootCollapsed?<ChevronRight size={18}/>:<ChevronDown size={18}/>}</button></span><Layers3 size={18}/>{onOpenEditor?<button type="button" onClick={()=>onOpenEditor(root.id)}>{root.partNumber}</button>:<strong>{root.partNumber}</strong>}</span>;
  if(key==='status')return '프로젝트 TOP';
  if(key==='level')return 0;
  if(key==='description')return root.name;
  return '—';
 };
 const cell=(key:ColumnKey,row:BomRow,children:boolean):ReactNode=>{
  const b=row.bom;
  switch(key){
   case 'part':return review?partLink(row):<span className="pbom-tree-label pbom-part-tree-label" title={row.path} style={{paddingInlineStart:`${Math.max(0,row.level-(root?0:1))*20}px`}}>{toggleSlot(row,children)}<span className={`pbom-part-dot ${b.partType==='ASSEMBLY'?'is-assembly':''}`} aria-hidden="true"/>{partLink(row)}</span>;
   case 'status':return <>{labels[row.match??'NEED_REVIEW']}{row.changed?` · ${row.changeLabel||'Revision 변경'}`:''}</>;
   case 'section':return b.section||'미확인';
   case 'level':return row.level;
   case 'description':return review?<span className="pbom-tree-label pbom-review-tree-label" style={{paddingInlineStart:`calc(${Math.max(0,row.level-1)} * var(--v2-action-height))`}}>{toggleSlot(row,children)}<span className="pbom-node-name">{b.itemDescription}</span></span>:b.itemDescription;
   case 'position':return b.position||'—';
   case 'item':return b.customerItemNumber||'—';
   case 'drawing':return b.drawingNumber||'—';
   case 'revision':return b.componentRevision||'미확인';
   case 'quantity':return `${show(b.quantity)} ${b.unit}`;
   case 'total':return `${show(row.totalQuantity)} ${b.unit}`;
   case 'weight':return `${show(review?b.weight:row.calculatedWeight)} ${b.weightUnit}`;
   case 'weightSource':return row.calculatedWeightSource;
   case 'availability':return DRAWING_AVAILABILITY_LABELS[b.drawingAvailability];
   case 'source':return renderSource?.(row.sourceRecordIds??[row.recordId])??(row.sourceRecordIds??[row.recordId]).join(', ');
  }
 };
 const controls=<div className="pbom-view-controls" role="group" aria-label={review?"문서 BOM 보기 설정":"프로젝트 BOM 보기 설정"}>
   <ColumnVisibilityMenu disabled={!columnsReady} options={options} visible={visibleColumns} onChange={setVisibleColumns} onReset={()=>setVisibleColumns(new Set(defaultColumnKeys))} open={columnMenuOpen} onOpenChange={setColumnMenuOpen}/>
   <HierarchyActions disabled={!rows.length} onCollapseAll={()=>{setRootCollapsed(Boolean(root&&!review));setCollapsed(collapsedBomIdsAtDepth(rows,1));}} onExpandAll={()=>{setRootCollapsed(false);setCollapsed([]);}}/>
  </div>;
 return <>
  {toolbarContainer?createPortal(controls,toolbarContainer):toolbarContainer===undefined?controls:null}
  {columnsError&&<p role="status" className="production-help">{columnsError} <button type="button" onClick={retryColumns}>다시 시도</button></p>}
  <div className="pbom-table-scroll cswind-data-table"><table className="production-table pbom-tree-table">
   <thead><tr>{shown.map(c=><th key={c.key}>{c.label}</th>)}{editable&&<th>검토</th>}</tr></thead>
   <tbody>
    {root&&!review&&<tr>{shown.map(c=><td key={c.key}>{rootCell(c.key)}</td>)}{editable&&<td/>}</tr>}
    {rows.filter(r=>!(root&&!review&&rootCollapsed)&&!hidden(r)).map(row=>{const children=rows.some(r=>r.bom.parentId===row.id);return <tr key={row.id}>
     {shown.map(c=><td key={c.key} title={c.key==='description'?row.bom.itemDescription:c.key==='source'?row.source:undefined}>{cell(c.key,row,children)}</td>)}
     {editable&&<td><button type="button" onClick={()=>setEditing(row.id)}>수정</button></td>}
    </tr>;})}
    {!rows.length&&<tr><td colSpan={shown.length+(editable?1:0)}>표시할 구조화 BOM이 없습니다.</td></tr>}
   </tbody>
  </table></div>
  {selected&&onEdit&&<PbomEditDialog key={selected.id} row={selected} rows={rows} onSave={onEdit} onClose={()=>setEditing('')}/>}
 </>;
}
