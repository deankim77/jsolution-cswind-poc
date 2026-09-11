"use client";
import {useState,isValidElement,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,Layers3} from 'lucide-react';
import {useColumnPreferences} from './use-column-preferences';
import PbomEditDialog from './pbom-edit-dialog';
import {ColumnVisibilityMenu,HierarchyActions,ColumnValueFilter} from './table-view-controls';
import {DRAWING_AVAILABILITY_LABELS,bomSectionName,collapsedBomIdsAtDepth,type BomFact,type BomRow} from '../../lib/pbom-contract';

const show=(n:number|null)=>n===null?'미확인':Number(n.toFixed(6)).toLocaleString();
const labels={NEW:'NEW · 신규',EXISTING:'기존 부품',NEED_REVIEW:'확인 필요',MANUAL:'내부 추가'};
const reviewLabels={NEW:'신규 부품',EXISTING:'기존 부품',NEED_REVIEW:'확인 필요',MANUAL:'내부 추가'};
const columns=[
 {key:'part',label:'품번',locked:true},
 {key:'status',label:'구분 / 변경'},
 {key:'section',label:'SECTION'},
 {key:'level',label:'LEVEL'},
 {key:'description',label:'Item Description'},
 {key:'position',label:'POS'},
 {key:'item',label:'Item No.'},
 {key:'drawing',label:'Drawing No.'},
 {key:'revision',label:'CompRev'},
 {key:'quantity',label:'Qty Per Unit'},
 {key:'unit',label:'수량 단위',locked:true},
 {key:'total',label:'Total Qty / Section'},
 {key:'weight',label:'Weight'},
 {key:'weightSource',label:'Weight Source / Calculation Basis'},
 {key:'availability',label:'Drawing Availability'},
 {key:'source',label:'출처 자료'},
] as const;
export type ColumnKey=typeof columns[number]['key'];
const defaultColumnKeys:readonly ColumnKey[]=columns.map(c=>c.key);
const reviewDefaultColumnKeys:readonly ColumnKey[]=['part','status','description','item','drawing','revision','quantity','unit'];
const lockedColumnKeys:readonly ColumnKey[]=['part','unit'];

const compactWidths:Record<ColumnKey,number>={part:170,status:120,section:190,level:60,description:260,position:60,item:200,drawing:200,revision:80,quantity:110,unit:80,total:150,weight:100,weightSource:240,availability:180,source:110};

export default function PbomTable({rows,root,compact=false,toolbarContainer,variant="full",editable=false,onEdit,onOpenEditor,renderSource,renderCell}:{compact?:boolean;renderCell?:(key:ColumnKey,row:BomRow,fallback:ReactNode)=>ReactNode;toolbarContainer?:HTMLElement|null;rows:BomRow[];renderSource?:(recordIds:string[])=>ReactNode;variant?:"full"|"review";root?:{id:string;partNumber:string;name:string}|null;editable?:boolean;onEdit?:(id:string,fact:BomFact)=>void|Promise<void>;onOpenEditor?:(id:string)=>void}){
 const [collapsed,setCollapsed]=useState<string[]>([]),[editing,setEditing]=useState(''),[rootCollapsed,setRootCollapsed]=useState(false);
 const [columnMenuOpen,setColumnMenuOpen]=useState(false);
 const review=variant==='review';
 const initialColumns=review?reviewDefaultColumnKeys:defaultColumnKeys;
 const {visible:visibleColumns,change:setVisibleColumns,ready:columnsReady,error:columnsError,retry:retryColumns}=useColumnPreferences(`v2-pbom-columns:${variant}`,initialColumns,lockedColumnKeys,defaultColumnKeys);
 const options=columns.map(column=>({...column,label:review&&column.key==='status'?'품목 구분':column.label}));
 const shown=options.filter(c=>c.key==='part'||visibleColumns.has(c.key));
 const [columnFilters,setColumnFilters]=useState<Partial<Record<ColumnKey,string>>>({});
 const filterKeys:ColumnKey[]=['part','status','section','description','item','drawing','revision','unit','availability','source'];
 const nodeText=(node:ReactNode):string=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(nodeText).join(' '):isValidElement<{children?:ReactNode}>(node)?nodeText(node.props.children):'';
 const filterValue=(row:BomRow,key:ColumnKey):string=>key==='part'?row.internalPartNumber??'':key==='status'?labels[row.match??'NEED_REVIEW']:key==='section'?bomSectionName(row,rows):key==='description'?row.bom.itemDescription:key==='source'?(renderSource?nodeText(renderSource(row.sourceRecordIds??[row.recordId])):(row.sourceRecordIds??[row.recordId]).join(', ')):key==='item'?row.bom.customerItemNumber:key==='drawing'?row.bom.drawingNumber:key==='revision'?row.bom.componentRevision:key==='unit'?row.bom.unit:key==='availability'?DRAWING_AVAILABILITY_LABELS[row.bom.drawingAvailability]:'';
 const filtering=shown.some(c=>Boolean(columnFilters[c.key]));
 const matching=rows.filter(row=>shown.every(c=>!columnFilters[c.key]||JSON.stringify(filterValue(row,c.key).trim())===columnFilters[c.key]));
 const included=new Set(matching.map(row=>row.id));
 if(filtering)for(const row of matching){let parent=row.bom.parentId;const visited=new Set<string>();while(parent&&!visited.has(parent)){visited.add(parent);included.add(parent);parent=rows.find(r=>r.id===parent)?.bom.parentId??null;}}

 const selected=rows.find(r=>r.id===editing);
 const hidden=(r:BomRow):boolean=>{let p=r.bom.parentId;const seen=new Set<string>();while(p&&!seen.has(p)){if(collapsed.includes(p))return true;seen.add(p);p=rows.find(x=>x.id===p)?.bom.parentId??null;}return false;};
 const displayed=filtering?rows.filter(row=>included.has(row.id)):rows.filter(row=>!(root&&!review&&rootCollapsed)&&!hidden(row));
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
   case 'part':return <span className="pbom-tree-label pbom-part-tree-label" title={row.path} style={{paddingInlineStart:`${Math.max(0,row.level-(root?0:1))*20}px`}}>{toggleSlot(row,children)}<span className={`pbom-part-dot ${b.partType==='ASSEMBLY'?'is-assembly':''}`} aria-hidden="true"/>{partLink(row)}</span>;
   case 'status':return review?reviewLabels[row.match??'NEED_REVIEW']: <>{labels[row.match??'NEED_REVIEW']}{row.changed?` · ${row.changeLabel||'Revision 변경'}`:''}</>;
   case 'section':return bomSectionName(row,rows)||'미확인';
   case 'level':return row.level;
   case 'description':return b.itemDescription;
   case 'position':return b.position||'—';
   case 'item':return b.customerItemNumber||'—';
   case 'drawing':return b.drawingNumber||'—';
   case 'revision':return b.componentRevision||'미확인';
   case 'quantity':return show(b.quantity);
   case 'unit':return b.unit.trim()||'미확인';
   case 'total':return show(row.totalQuantity);
   case 'weight':return `${show(review?b.weight:row.calculatedWeight)} ${b.weightUnit}`;
   case 'weightSource':return row.calculatedWeightSource;
   case 'availability':return DRAWING_AVAILABILITY_LABELS[b.drawingAvailability];
   case 'source':return renderSource?.(row.sourceRecordIds??[row.recordId])??(row.sourceRecordIds??[row.recordId]).join(', ');
  }
 };
 const controls=<div className="pbom-view-controls" role="group" aria-label={review?"문서 BOM 보기 설정":"프로젝트 BOM 보기 설정"}>
   <ColumnVisibilityMenu disabled={!columnsReady} options={options} visible={visibleColumns} onChange={setVisibleColumns} onReset={()=>setVisibleColumns(new Set(initialColumns))} open={columnMenuOpen} onOpenChange={setColumnMenuOpen}/>
   <HierarchyActions disabled={!rows.length} onCollapseAll={()=>{setRootCollapsed(Boolean(root&&!review));setCollapsed(collapsedBomIdsAtDepth(rows,1));}} onExpandAll={()=>{setRootCollapsed(false);setCollapsed([]);}}/>
  </div>;
 return <>
  {toolbarContainer?createPortal(controls,toolbarContainer):toolbarContainer===undefined?controls:null}
  {columnsError&&<p role="status" className="production-help">{columnsError} <button type="button" onClick={retryColumns}>다시 시도</button></p>}
  <div className="pbom-table-scroll cswind-data-table"><table className="production-table pbom-tree-table" style={compact?{tableLayout:"fixed",width:shown.reduce((sum,c)=>sum+compactWidths[c.key],0),minWidth:0}:undefined}>
   {compact&&<colgroup>{shown.map(c=><col key={c.key} style={{width:compactWidths[c.key]}}/>)}</colgroup>}
   <thead><tr>{shown.map(c=><th key={c.key}>{c.label}{filterKeys.includes(c.key)&&<ColumnValueFilter label={c.label} values={rows.map(row=>filterValue(row,c.key))} value={columnFilters[c.key]??''} onChange={value=>setColumnFilters(current=>({...current,[c.key]:value}))}/>}</th>)}{editable&&<th>검토</th>}</tr></thead>
   <tbody>
    {root&&!review&&<tr>{shown.map(c=><td key={c.key}>{rootCell(c.key)}</td>)}{editable&&<td/>}</tr>}
    {displayed.map(row=>{const children=rows.some(r=>r.bom.parentId===row.id);return <tr key={row.id}>
     {shown.map(c=><td key={c.key} data-column={c.key} title={c.key==='description'?row.bom.itemDescription:c.key==='source'?row.source:undefined}>{renderCell?renderCell(c.key,row,cell(c.key,row,children)):cell(c.key,row,children)}</td>)}
     {editable&&<td><button type="button" onClick={()=>setEditing(row.id)}>수정</button></td>}
    </tr>;})}
    {(!rows.length||(filtering&&!matching.length))&&<tr><td colSpan={shown.length+(editable?1:0)}>{rows.length?'필터에 맞는 BOM이 없습니다.':'표시할 구조화 BOM이 없습니다.'}</td></tr>}
   </tbody>
  </table></div>
  {selected&&onEdit&&<PbomEditDialog key={selected.id} row={selected} rows={rows} onSave={onEdit} onClose={()=>setEditing('')}/>}
 </>;
}
