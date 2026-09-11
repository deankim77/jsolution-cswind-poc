"use client";
import {useState} from 'react';
import ReviewDecisionActions from './review-decision-actions';
import {createPortal} from 'react-dom';
import {ColumnValueFilter,ColumnVisibilityMenu} from './table-view-controls';
import {TRR_SECTIONS} from '../../lib/trr-contract';
import type {ReviewDraft,ReviewItem} from '../../lib/customer-review-contract';
import './trr-review-details.css';

export default function TrrReviewDetails({draft,version,disabled,dirty,onApply,onCancel,confirmedCount=0,documentName='',actionContainer}:{actionContainer?:HTMLElement|null;draft:ReviewDraft;version:number;disabled:boolean;dirty:boolean;onApply:(ids:string[])=>void;onCancel:()=>void;confirmedCount?:number;documentName?:string}){
 const items=draft.items.filter(i=>i.area==='trr');
 const [selected,setSelected]=useState<string[]>([]);
 const columns=[{key:'number',label:'순번',locked:true},{key:'section',label:'반영 목차'},{key:'kind',label:'자료 구분'},{key:'title',label:'추출 항목'},{key:'body',label:'본문',locked:true}];
 const [visible,setVisible]=useState(new Set(columns.map(c=>c.key))),[menuOpen,setMenuOpen]=useState(false);
 const [filters,setFilters]=useState({trrSection:'',trrKind:'',title:''});
 const kind=(value:string|undefined)=>value==='historical'?'과거 사례 참고':'현재 기술요구사항';
 const section=(value:string|undefined)=>`${TRR_SECTIONS.indexOf(value as typeof TRR_SECTIONS[number])+1}. ${value??''}`;
 const label=(item:ReviewItem,key:keyof typeof filters)=>key==='trrKind'?kind(item.trrKind):key==='trrSection'?section(item.trrSection):item.title;
 const rows=items.map((item,index)=>({item,index})).filter(({item})=>(Object.keys(filters) as (keyof typeof filters)[]).every(key=>!filters[key]||JSON.stringify(label(item,key).trim())===filters[key]));
 const filter=(key:keyof typeof filters,title:string)=><ColumnValueFilter label={title} values={items.map(item=>label(item,key))} value={filters[key]} onChange={value=>setFilters(current=>({...current,[key]:value}))}/>;
 const selectedIds=rows.filter(({item})=>selected.includes(item.id)).map(({item})=>item.id);
 const apply=<ReviewDecisionActions selectedCount={selectedIds.length} totalCount={rows.length} confirmedCount={confirmedCount} documentName={documentName} areaLabel="TRR" selectionDisabled={disabled||dirty||!rows.length} confirmDisabled={disabled||dirty||!selectedIds.length} cancelDisabled={disabled||dirty||!confirmedCount} onSelectAll={checked=>setSelected(checked?rows.map(({item})=>item.id):[])} onConfirm={()=>onApply(selectedIds)} onCancel={onCancel}/>;
 return <section className="trr-review-details">
  <p role="status">분석 v{version} · 확정 {confirmedCount}건</p>
  <div className="trr-review-toolbar">
   <ColumnVisibilityMenu options={columns} visible={visible} onChange={next=>{setVisible(next);setFilters({trrSection:'',trrKind:'',title:''})}} onReset={()=>setVisible(new Set(columns.map(c=>c.key)))} open={menuOpen} onOpenChange={setMenuOpen}/>
   <button type="button" className="table-view-action" onClick={()=>setFilters({trrSection:'',trrKind:'',title:''})}>필터 초기화</button>
   <span>{rows.length} / {items.length}건</span>
   {actionContainer?createPortal(apply,actionContainer):apply}
  </div>
  <div className="trr-review-scroll"><table className="production-table trr-review-table">
   <colgroup><col className="trr-col-check"/><col className="trr-col-number"/>{visible.has('section')&&<col className="trr-col-section"/>}{visible.has('kind')&&<col className="trr-col-kind"/>}{visible.has('title')&&<col className="trr-col-title"/>}<col/></colgroup>
   <thead><tr><th>검토</th><th>순번</th>{visible.has('section')&&<th>반영 목차{filter('trrSection','반영 목차')}</th>}{visible.has('kind')&&<th>자료 구분{filter('trrKind','자료 구분')}</th>}{visible.has('title')&&<th>추출 항목{filter('title','추출 항목')}</th>}<th>본문</th></tr></thead>
   <tbody>{rows.map(({item,index})=><tr key={item.id}>
    <td><input type="checkbox" aria-label={`${index+1}번 TRR 검토`} disabled={disabled||dirty} checked={selected.includes(item.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/></td>
    <td>{index+1}</td>
    {visible.has('section')&&<td>{section(item.trrSection)}</td>}
    {visible.has('kind')&&<td>{kind(item.trrKind)}</td>}
    {visible.has('title')&&<td>{item.title}</td>}
    <td>{item.detail}</td>
   </tr>)}{!rows.length&&<tr><td colSpan={visible.size+1}>{items.length?'필터 조건에 맞는 항목이 없습니다.':'TRR 추출 항목이 없습니다. AI 분석을 실행해 주세요.'}</td></tr>}</tbody>
  </table></div>
  {dirty&&<p role="status">보완 내용을 초안 저장한 뒤 반영하세요.</p>}
 </section>;
}
