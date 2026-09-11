"use client";
import {useEffect,useRef,useState} from 'react';
import {ColumnValueFilter} from './table-view-controls';
import {Save,X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {REVIEW_USE_TARGETS,type ReviewItem,type ReviewUseTarget} from '../../lib/customer-review-contract';
import './review-requirements-table.css';

type Row={item:ReviewItem;decision?:string};
const targetLabel=(item:ReviewItem)=>item.useTargets?.length?item.useTargets:['기타' as ReviewUseTarget];
const itemIdentity=(item:ReviewItem)=>{
 const number=item.itemNumber?.trim()||'';
 const name=item.itemName?.trim()||item.title?.trim()||'';
 return number&&name?`${number} / ${name}`:number||name||'—';
};

function ReviewItemEditDialog({item,disabled,onSave,onClose}:{item:ReviewItem;disabled:boolean;onSave:(item:ReviewItem)=>void|Promise<void>;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 const [form,setForm]=useState<ReviewItem>(()=>({...item,useTargets:[...targetLabel(item)]}));
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close()},[]);
 const toggleTarget=(target:ReviewUseTarget)=>setForm(current=>{const values=current.useTargets??[];return {...current,useTargets:values.includes(target)?values.filter(value=>value!==target):[...values,target]}});
 const save=async()=>{if(saving||disabled)return;if(!form.useTargets?.length){setError('활용 대상을 1개 이상 선택하세요.');return}if(!form.detail.trim()){setError('AI 추출 내용을 입력하세요.');return}setSaving(true);setError('');try{const next={...form,title:form.itemName?.trim()||form.title,detail:form.detail.trim(),assy:form.assy?.trim()||'',part:form.part?.trim()||'',itemNumber:form.itemNumber?.trim()||'',itemName:form.itemName?.trim()||''};await onSave(next);onClose()}catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다.')}finally{setSaving(false)}};
 return <dialog ref={ref} className="wv2-module-dialog ai-extract-edit-dialog" aria-labelledby="ai-extract-edit-title" onCancel={e=>{e.preventDefault();if(!saving)onClose()}}>
  <header><div><small>AI DATA REVIEW</small><h2 id="ai-extract-edit-title">AI 추출사항 수정</h2></div><button type="button" disabled={saving} onClick={onClose} aria-label="수정 닫기"><X size={18}/></button></header>
  <form onSubmit={e=>{e.preventDefault();void save()}}>
   <fieldset disabled={saving||disabled} className="ai-extract-edit-fields">
    <div className="ai-extract-target-picker"><span>활용 대상</span><div>{REVIEW_USE_TARGETS.map(target=><label key={target}><input type="checkbox" checked={form.useTargets?.includes(target)??false} onChange={()=>toggleTarget(target)}/><span>{target}</span></label>)}</div></div>
    <label><span>ASSY</span><input value={form.assy??''} onChange={e=>setForm(current=>({...current,assy:e.target.value}))}/></label>
    <label><span>PART</span><input value={form.part??''} onChange={e=>setForm(current=>({...current,part:e.target.value}))}/></label>
    <label><span>품번</span><input value={form.itemNumber??''} onChange={e=>setForm(current=>({...current,itemNumber:e.target.value}))}/></label>
    <label><span>추출 항목</span><input value={form.itemName??''} onChange={e=>setForm(current=>({...current,itemName:e.target.value}))}/></label>
    <label className="ai-extract-edit-field"><span>AI 추출 내용</span><textarea value={form.detail} onChange={e=>setForm(current=>({...current,detail:e.target.value}))}/></label>
    <div className="ai-extract-source-note"><span>근거 위치</span><p>{form.source}</p></div>
   </fieldset>
   {error&&<p role="alert" className="wv2-form-error">{error}</p>}
   <footer><button type="button" disabled={saving} onClick={onClose}>취소</button><button type="submit" className="primary" disabled={saving||disabled}><Save size={18}/>{saving?'저장 중…':'SAVE'}</button></footer>
  </form>
 </dialog>;
}

export function ReviewTargetFilter({targets,filter,onChange}:{targets:readonly (readonly string[])[];filter:'ALL'|ReviewUseTarget;onChange:(value:'ALL'|ReviewUseTarget)=>void}){
 return <div className="ai-extract-filter" role="group" aria-label="활용 대상 필터"><span>활용 대상</span><button type="button" aria-pressed={filter==='ALL'} className={filter==='ALL'?'active':''} onClick={()=>onChange('ALL')}>전체 <b>{targets.length}</b></button>{REVIEW_USE_TARGETS.map(target=>{const count=targets.filter(values=>values.includes(target)).length;return <button type="button" key={target} aria-pressed={filter===target} className={filter===target?'active':''} onClick={()=>onChange(target)}>{target} <b>{count}</b></button>})}</div>;
}

export default function ReviewRequirementsTable({rows,selected,onSelect,onEdit,disabled=false,toolbarContainer}:{toolbarContainer?:HTMLElement|null;rows:Row[];selected?:string[];onSelect?:(ids:string[])=>void;onEdit?:(item:ReviewItem)=>void|Promise<void>;disabled?:boolean;renderSource?:unknown}){
 const [filter,setFilter]=useState<'ALL'|ReviewUseTarget>('ALL'),[editing,setEditing]=useState('');
 const [columnFilters,setColumnFilters]=useState({assy:'',part:'',itemName:'',itemNumber:''});
 const filtered=rows.filter(({item})=>(filter==='ALL'||targetLabel(item).includes(filter))&&(['assy','part','itemName','itemNumber'] as const).every(key=>!columnFilters[key]||JSON.stringify((item[key]??'').trim())===columnFilters[key]));
 const columnFilter=(key:'assy'|'part'|'itemName'|'itemNumber',label:string)=><ColumnValueFilter label={label} values={rows.map(({item})=>item[key]??'')} value={columnFilters[key]} onChange={value=>setColumnFilters(current=>({...current,[key]:value}))}/>;

 const active=rows.find(({item})=>item.id===editing)?.item;
 const selectedVisible=filtered.filter(({item})=>selected?.includes(item.id)).length;
 const filterControls=<ReviewTargetFilter targets={rows.map(({item})=>targetLabel(item))} filter={filter} onChange={setFilter}/>;
 return <>
  {toolbarContainer?createPortal(filterControls,toolbarContainer):toolbarContainer===undefined?filterControls:null}
  <div className="cswind-data-table"><table className="production-table requirements-table ai-extract-table"><colgroup>{onSelect&&<col style={{width:44}}/>}<col style={{width:150}}/><col style={{width:170}}/><col style={{width:150}}/><col style={{width:120}}/><col style={{width:190}}/><col/>{onEdit&&<col style={{width:76}}/>}</colgroup><thead><tr>{onSelect&&<th className="ai-extract-check"><input aria-label="AI 추출사항 전체 선택" type="checkbox" disabled={disabled||!filtered.length} checked={filtered.length>0&&selectedVisible===filtered.length} onChange={e=>{const visibleIds=new Set(filtered.map(r=>r.item.id));const keep=(selected??[]).filter(id=>!visibleIds.has(id));onSelect(e.target.checked?[...keep,...filtered.map(r=>r.item.id)]:keep)}}/></th>}<th>활용 대상</th><th>ASSY{columnFilter('assy','ASSY')}</th><th>PART{columnFilter('part','PART')}</th><th>품번{columnFilter('itemNumber','품번')}</th><th>추출 항목{columnFilter('itemName','추출 항목')}</th><th>AI 추출 내용</th>{onEdit&&<th className="ai-extract-edit-column">수정</th>}</tr></thead><tbody>{filtered.map(({item})=><tr key={item.id}>{onSelect&&<td className="ai-extract-check"><input aria-label={`${item.title} 선택`} type="checkbox" disabled={disabled} checked={selected?.includes(item.id)??false} onChange={e=>onSelect(e.target.checked?[...(selected??[]),item.id]:(selected??[]).filter(id=>id!==item.id))}/></td>}<td><div className="ai-extract-targets">{targetLabel(item).map(target=><span key={target}>{target}</span>)}</div></td><td title={item.assy||''}>{item.assy||'—'}</td><td title={item.part||''}>{item.part||'—'}</td><td title={item.itemNumber||''}>{item.itemNumber||'—'}</td><td title={item.itemName||item.title||''}>{item.itemName||item.title||'—'}</td><td className="ai-extract-detail" title={item.detail}>{item.detail}</td>{onEdit&&<td className="ai-extract-edit-column"><button type="button" disabled={disabled} onClick={()=>setEditing(item.id)}>수정</button></td>}</tr>)}{!filtered.length&&<tr><td colSpan={(onSelect?1:0)+(onEdit?7:6)}>해당 활용 대상의 AI 추출사항이 없습니다.</td></tr>}</tbody></table></div>
  {active&&onEdit&&<ReviewItemEditDialog item={active} disabled={disabled} onSave={onEdit} onClose={()=>setEditing('')}/>} 
 </>;
}
