"use client";
import {useState} from 'react';
import {Pencil} from 'lucide-react';
import {ColumnValueFilter} from './table-view-controls';
import {TRR_SECTIONS,trrVersionLabel} from '../../lib/trr-contract';
import type {ReviewDraft,ReviewItem} from '../../lib/customer-review-contract';
import './trr-review-details.css';

export default function TrrReviewDetails({draft,version,appliedVersion,wordVersion,disabled,dirty,onChange,onApply}:{draft:ReviewDraft;version:number;appliedVersion?:number;wordVersion?:number;disabled:boolean;dirty:boolean;onChange:(draft:ReviewDraft)=>void;onApply:()=>void}){
 const items=draft.items.filter(i=>i.area==='trr');
 const [editing,setEditing]=useState(false);
 const [filters,setFilters]=useState({trrSection:'',trrKind:'',title:''});
 const kind=(value:string|undefined)=>value==='historical'?'과거 사례 참고':'현재 기술요구사항';
 const section=(value:string|undefined)=>`${TRR_SECTIONS.indexOf(value as typeof TRR_SECTIONS[number])+1}. ${value??''}`;
 const label=(item:ReviewItem,key:keyof typeof filters)=>key==='trrKind'?kind(item.trrKind):key==='trrSection'?section(item.trrSection):item.title;
 const rows=items.map((item,index)=>({item,index})).filter(({item})=>(Object.keys(filters) as (keyof typeof filters)[]).every(key=>!filters[key]||JSON.stringify(label(item,key).trim())===filters[key]));
 const filter=(key:keyof typeof filters,title:string)=><ColumnValueFilter label={title} values={items.map(item=>label(item,key))} value={filters[key]} onChange={value=>setFilters(current=>({...current,[key]:value}))}/>;
 const update=(id:string,patch:Partial<ReviewItem>)=>onChange({...draft,items:draft.items.map(i=>i.id===id?{...i,...patch}:i)});
 return <section className="trr-review-details">
  <p role="status">{appliedVersion===version?`TRR ${wordVersion?trrVersionLabel(wordVersion):''} 반영 완료`:appliedVersion?`분석 v${appliedVersion} 반영됨 · 현재 v${version} 검토 대기`:`분석 v${version} · 검토 대기`}</p>
  <div className="trr-review-toolbar">
   <button type="button" className="production-edit-all" disabled={disabled||!items.length} onClick={()=>setEditing(value=>!value)}><Pencil size={18}/>{editing?'조회 모드':'전체 수정'}</button>
   <button type="button" onClick={()=>setFilters({trrSection:'',trrKind:'',title:''})}>필터 초기화</button>
   <span>{rows.length} / {items.length}건</span>
   <button type="button" className="production-edit-all" disabled={disabled||dirty||!items.length||appliedVersion===version} onClick={onApply}>검토 완료 · TRR 반영 (전체 {items.length}건)</button>
  </div>
  <div className="trr-review-scroll"><table className="production-table trr-review-table">
   <colgroup><col className="trr-col-number"/><col className="trr-col-section"/><col className="trr-col-kind"/><col className="trr-col-title"/><col/></colgroup>
   <thead><tr><th>순번</th><th>반영 목차{filter('trrSection','반영 목차')}</th><th>자료 구분{filter('trrKind','자료 구분')}</th><th>추출 항목{filter('title','추출 항목')}</th><th>본문</th></tr></thead>
   <tbody>{rows.map(({item,index})=><tr key={item.id}>
    <td>{index+1}</td>
    <td>{editing?<select aria-label={`${index+1}번 TRR 반영 목차`} disabled={disabled} value={item.trrSection??''} onChange={e=>update(item.id,{trrSection:e.target.value as ReviewItem['trrSection']})}>{TRR_SECTIONS.map((s,n)=><option value={s} key={s}>{n+1}. {s}</option>)}</select>:section(item.trrSection)}</td>
    <td>{editing?<select aria-label={`${index+1}번 자료 구분`} disabled={disabled} value={item.trrKind??'current'} onChange={e=>update(item.id,{trrKind:e.target.value as ReviewItem['trrKind']})}><option value="current">현재 기술요구사항</option><option value="historical">과거 사례 참고</option></select>:kind(item.trrKind)}</td>
    <td>{editing?<textarea aria-label={`${index+1}번 추출 항목`} rows={2} maxLength={6000} disabled={disabled} value={item.title} onChange={e=>update(item.id,{title:e.target.value})}/>:item.title}</td>
    <td>{editing?<textarea aria-label={`${index+1}번 본문`} rows={2} maxLength={6000} disabled={disabled} value={item.detail} onChange={e=>update(item.id,{detail:e.target.value})}/>:item.detail}</td>
   </tr>)}{!rows.length&&<tr><td colSpan={5}>{items.length?'필터 조건에 맞는 항목이 없습니다.':'TRR 추출 항목이 없습니다. AI 분석을 실행해 주세요.'}</td></tr>}</tbody>
  </table></div>
  {dirty&&<p role="status">보완 내용을 초안 저장한 뒤 반영하세요.</p>}
 </section>;
}
