"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {Save,X} from 'lucide-react';
import {REVIEW_USE_TARGETS,type ReviewItem,type ReviewUseTarget} from '../../lib/customer-review-contract';
import './review-requirements-table.css';

type Row={item:ReviewItem;decision?:string};
const targetLabel=(item:ReviewItem)=>item.useTargets?.length?item.useTargets:['기타' as ReviewUseTarget];
const itemIdentity=(item:ReviewItem)=>{
 const number=item.itemNumber?.trim()||'';
 const name=item.itemName?.trim()||item.title?.trim()||'';
 return number&&name?`${number} / ${name}`:number||name||'—';
};

function ReviewItemEditDialog({item,disabled,onSave,onClose}:{item:ReviewItem;disabled:boolean;onSave:(detail:string)=>void;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),[detail,setDetail]=useState(item.detail);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close()},[]);
 return <dialog ref={ref} className="wv2-module-dialog ai-extract-edit-dialog" aria-labelledby="ai-extract-edit-title" onCancel={e=>{e.preventDefault();if(!disabled)onClose()}}>
  <header><div><small>AI DATA REVIEW</small><h2 id="ai-extract-edit-title">AI 추출 내용 수정</h2></div><button type="button" disabled={disabled} onClick={onClose} aria-label="수정 닫기"><X size={18}/></button></header>
  <div className="ai-extract-edit-context"><span>{targetLabel(item).join(' · ')}</span><strong>{itemIdentity(item)}</strong>{item.assy&&<small>ASSY · {item.assy}</small>}{item.part&&<small>PART · {item.part}</small>}</div>
  <label className="ai-extract-edit-field"><span>AI 추출 내용</span><textarea autoFocus disabled={disabled} value={detail} onChange={e=>setDetail(e.target.value)}/></label>
  <footer><button type="button" disabled={disabled} onClick={onClose}>취소</button><button type="button" className="primary" disabled={disabled||!detail.trim()||detail.trim()===item.detail.trim()} onClick={()=>{onSave(detail.trim());onClose()}}><Save size={18}/>수정 적용</button></footer>
 </dialog>;
}

export default function ReviewRequirementsTable({rows,selected,onSelect,onEdit,disabled=false}:{rows:Row[];selected?:string[];onSelect?:(ids:string[])=>void;onEdit?:(id:string,detail:string)=>void;disabled?:boolean;renderSource?:unknown}){
 const [filter,setFilter]=useState<'ALL'|ReviewUseTarget>('ALL'),[editing,setEditing]=useState('');
 const filtered=useMemo(()=>filter==='ALL'?rows:rows.filter(({item})=>targetLabel(item).includes(filter)),[rows,filter]);
 const active=rows.find(({item})=>item.id===editing)?.item;
 const selectedVisible=filtered.filter(({item})=>selected?.includes(item.id)).length;
 return <>
  <div className="ai-extract-filter" role="group" aria-label="활용 대상 필터"><span>활용 대상</span><button type="button" className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}>전체 <b>{rows.length}</b></button>{REVIEW_USE_TARGETS.map(target=>{const count=rows.filter(({item})=>targetLabel(item).includes(target)).length;return <button type="button" key={target} className={filter===target?'active':''} onClick={()=>setFilter(target)}>{target} <b>{count}</b></button>})}</div>
  <div className="cswind-data-table"><table className="production-table requirements-table ai-extract-table"><thead><tr>{onSelect&&<th className="ai-extract-check"><input aria-label="AI 추출사항 전체 선택" type="checkbox" disabled={disabled||!filtered.length} checked={filtered.length>0&&selectedVisible===filtered.length} onChange={e=>{const visibleIds=new Set(filtered.map(r=>r.item.id));const keep=(selected??[]).filter(id=>!visibleIds.has(id));onSelect(e.target.checked?[...keep,...filtered.map(r=>r.item.id)]:keep)}}/></th>}<th>활용 대상</th><th>ASSY</th><th>PART</th><th>품번 / 품명</th><th>AI 추출 내용</th>{onEdit&&<th className="ai-extract-edit-column">수정</th>}</tr></thead><tbody>{filtered.map(({item})=><tr key={item.id}>{onSelect&&<td className="ai-extract-check"><input aria-label={`${item.title} 선택`} type="checkbox" disabled={disabled} checked={selected?.includes(item.id)??false} onChange={e=>onSelect(e.target.checked?[...(selected??[]),item.id]:(selected??[]).filter(id=>id!==item.id))}/></td>}<td><div className="ai-extract-targets">{targetLabel(item).map(target=><span key={target}>{target}</span>)}</div></td><td title={item.assy||''}>{item.assy||'—'}</td><td title={item.part||''}>{item.part||'—'}</td><td title={itemIdentity(item)}>{itemIdentity(item)}</td><td className="ai-extract-detail" title={item.detail}>{item.detail}</td>{onEdit&&<td className="ai-extract-edit-column"><button type="button" disabled={disabled} onClick={()=>setEditing(item.id)}>수정</button></td>}</tr>)}{!filtered.length&&<tr><td colSpan={(onSelect?1:0)+(onEdit?6:5)}>해당 활용 대상의 AI 추출사항이 없습니다.</td></tr>}</tbody></table></div>
  {active&&onEdit&&<ReviewItemEditDialog item={active} disabled={disabled} onSave={detail=>onEdit(active.id,detail)} onClose={()=>setEditing('')}/>} 
 </>;
}
