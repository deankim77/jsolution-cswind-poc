"use client";
import {TRR_SECTIONS,trrVersionLabel} from '../../lib/trr-contract';
import type {ReviewDraft,ReviewItem} from '../../lib/customer-review-contract';
import './trr-review-details.css';

export default function TrrReviewDetails({draft,version,appliedVersion,wordVersion,disabled,dirty,onChange,onApply}:{draft:ReviewDraft;version:number;appliedVersion?:number;wordVersion?:number;disabled:boolean;dirty:boolean;onChange:(draft:ReviewDraft)=>void;onApply:()=>void}){
 const items=draft.items.filter(i=>i.area==='trr');
 const update=(id:string,patch:Partial<ReviewItem>)=>onChange({...draft,items:draft.items.map(i=>i.id===id?{...i,...patch}:i)});
 return <section className="trr-review-details">
  <p role="status">{appliedVersion===version?`TRR ${wordVersion?trrVersionLabel(wordVersion):''} 반영 완료`:appliedVersion?`분석 v${appliedVersion} 반영됨 · 현재 v${version} 검토 대기`:`분석 v${version} · 검토 대기`}</p>
  <p>본문·출처·반영 목차를 검토한 뒤 TRR에 반영하세요.</p>
  {items.map((item,index)=><article className="analysis-card" key={item.id}>
   <div className="trr-review-fields"><label>반영 목차<select aria-label={`${index+1}번 TRR 반영 목차`} disabled={disabled} value={item.trrSection??''} onChange={e=>update(item.id,{trrSection:e.target.value as ReviewItem['trrSection']})}>{TRR_SECTIONS.map((s,n)=><option value={s} key={s}>{n+1}. {s}</option>)}</select></label>
   <label>자료 구분<select disabled={disabled} value={item.trrKind??'current'} onChange={e=>update(item.id,{trrKind:e.target.value as ReviewItem['trrKind']})}><option value="current">현재 기술요구사항</option><option value="historical">과거 사례 참고</option></select></label></div>
   <label>{index+1}. 추출 항목<input maxLength={6000} disabled={disabled} value={item.title} onChange={e=>update(item.id,{title:e.target.value})}/></label>
   <label>본문<textarea rows={4} maxLength={6000} disabled={disabled} value={item.detail} onChange={e=>update(item.id,{detail:e.target.value})}/></label>
   <label>출처<input maxLength={6000} disabled={disabled} value={item.source} onChange={e=>update(item.id,{source:e.target.value})}/></label>
  </article>)}
  {!items.length&&<p>TRR 추출 항목이 없습니다. AI 분석을 실행해 주세요.</p>}
  {dirty&&<p role="status">보완 내용을 초안 저장한 뒤 반영하세요.</p>}
  <button type="button" className="production-edit-all" disabled={disabled||dirty||!items.length||appliedVersion===version} onClick={onApply}>검토 완료 · TRR 반영 ({items.length}건)</button>
 </section>;
}
