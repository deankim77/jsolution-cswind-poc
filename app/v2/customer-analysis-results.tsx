"use client";
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {TRR_SECTIONS} from '../../lib/trr-contract';
import {Sparkles} from 'lucide-react';
import CommonAiChatPanel from '../common-ai-chat-panel';
import {REVIEW_AREAS,REVIEW_TYPES,type MissingReviewData,type ReviewArea,type ReviewDraft,type ReviewState} from '../../lib/customer-review-contract';
import type {AnalysisHistory} from '../../lib/customer-review-updates';
import './customer-analysis-results.css';

type Props={url:string;recordId:string;version:number;projectId:string;projectName:string;fileName:string;busy:boolean;canReview:boolean;hasConfirmed:boolean;onBusy:(value:boolean)=>void;onApplied:()=>void;onArea?:(area:ReviewArea)=>void;children?:ReactNode};
type ReviewListResponse={reviews:ReviewState[]};
const areaNames:Record<ReviewArea,string>={pbom:'PBOM',extract:'AI 추출사항',trr:'TRR'};
function legacyMissingData(draft:ReviewDraft):MissingReviewData[]{
 if(draft.missingData?.length)return draft.missingData;
 return draft.uncertainties.slice(0,12).map(text=>{
  const clean=text.replace(/^[•\-]\s*/,'').trim();
  let field=clean.split(/\s*[|｜:]\s*/)[0]?.trim()||'확인 필요 DATA';
  if(/CompRev|component\s*rev/i.test(clean))field='부품 CompRev';
  else if(/재질|material/i.test(clean))field='부품 재질';
  else if(/최상위.*수량|ASSY.*수량|item.*수량/i.test(clean))field='최상위 ASSY 수량';
  else if(/개별.*도면|drawingAvailability|도면.*여부/i.test(clean))field='개별 부품 도면';
  else if(/중량|mass|weight/i.test(clean))field='중량 정보';
  else if(/색상|color|paint/i.test(clean))field='색상·도장 정보';
  if(field.length>34)field=`${field.slice(0,34)}…`;
  return {field,reason:clean};
 });
}
function areaItems(draft:ReviewDraft,area:ReviewArea){return draft.items.filter(item=>item.area===area)}

export default function CustomerAnalysisResults({url,recordId,version,projectId,projectName,fileName,busy,canReview,onBusy,onApplied,onArea}:Props){
 const [tab,setTab]=useState<'latest'|'history'>('latest'),[history,setHistory]=useState<AnalysisHistory[]>([]),[current,setCurrent]=useState<ReviewState|null>(null),[selected,setSelected]=useState<string[]>([]),[chat,setChat]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0),[notice,setNotice]=useState(''),[documentType,setDocumentType]=useState<ReviewDraft['documentType']>('unclassified');
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');
  Promise.all([fetch(url,{signal:c.signal}),fetch(`${url}?history=${encodeURIComponent(recordId)}`,{signal:c.signal})].map(async request=>{const response=await request,result=await response.json();if(!response.ok)throw Error(result.error||'분석 정보를 불러오지 못했습니다.');return result})).then(results=>{if(c.signal.aborted)return;const list=results[0] as ReviewListResponse,h=results[1] as {history:AnalysisHistory[]},review=list.reviews.find(row=>row.recordId===recordId)??null;setCurrent(review);setDocumentType(review?.draft.documentType??'unclassified');setHistory(h.history);setSelected(ids=>ids.filter(id=>h.history.some(row=>row.id===id)));}).catch(e=>{if(!c.signal.aborted)setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort();
 },[url,recordId,version,reload]);
 const draft=current?.draft??null,missing=useMemo(()=>draft?legacyMissingData(draft):[],[draft]),selectedHistory=history.filter(row=>selected.includes(row.id));
 const confirmType=async()=>{if(!current||busy||!canReview||documentType==='unclassified')return;onBusy(true);setError('');setNotice('');try{const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'confirm-document-type',recordId,version:current.version,documentType})}),result=await response.json();if(!response.ok)throw Error(result.error||'문서 타입을 확정하지 못했습니다.');setCurrent(result.review);setNotice(`문서 타입을 ${REVIEW_TYPES[documentType]}으로 확정했습니다.`);onApplied();setReload(v=>v+1);}catch(e){setError((e as Error).message)}finally{onBusy(false)}};
 return <section className="customer-analysis-results">
  <div className="analysis-result-tabs" role="tablist" aria-label="AI 분석 결과"><button role="tab" aria-selected={tab==='latest'} className={tab==='latest'?'active':''} disabled={busy} onClick={()=>setTab('latest')}>최신 분석 결과</button><button role="tab" aria-selected={tab==='history'} className={tab==='history'?'active':''} disabled={busy} onClick={()=>setTab('history')}>분석 이력</button></div>
  {error&&<p role="alert" className="analysis-inline-error">{error} <button disabled={busy} onClick={()=>setReload(v=>v+1)}>다시 시도</button></p>}
  {tab==='latest'?loading?<p className="analysis-empty">최신 분석 결과를 불러오는 중…</p>:!draft?<p className="analysis-empty">AI 분석을 실행하면 최신 분석 결과를 확인할 수 있습니다.</p>:draft.analysisMode==='text'?<section className="analysis-card"><h2>AI 분석 결과</h2><p className="analysis-history-summary">{draft.summary}</p></section>:<div className="analysis-latest">
   <section className="analysis-card analysis-type-card">
    <div className="analysis-card-heading"><div><h2>문서 타입 확인</h2><p>AI 추천 분류입니다. 필요하면 변경하세요. TRR 반영은 별도로 진행합니다.</p></div><span className={draft.documentTypeConfirmed?'confirmed':'pending'}>{draft.documentTypeConfirmed?'확정됨':'확인 필요'}</span></div>
    <div className="analysis-type-action"><select aria-label="문서 타입" disabled={busy||!canReview} value={documentType} onChange={e=>setDocumentType(e.target.value as ReviewDraft['documentType'])}>{Object.entries(REVIEW_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button type="button" disabled={busy||!canReview||documentType==='unclassified'||(draft.documentTypeConfirmed&&documentType===draft.documentType)} onClick={()=>void confirmType()}>{draft.documentTypeConfirmed&&documentType===draft.documentType?'확정됨':'문서 타입 확정'}</button></div>
    {notice&&<p role="status" className="analysis-confirm-notice">{notice}</p>}
   </section>
   <section className="analysis-card">
    <div className="analysis-card-heading"><div><h2>AI 분석 요약</h2><p>{draft.items.some(i=>i.area==='trr')?'TRR 관련 요구사항과 주의사항을 요약합니다.':'원본에서 가져와야 하지만 확인하지 못한 DATA만 표시합니다.'}</p></div><span className={missing.length?'pending':'confirmed'}>{missing.length?`미확인 ${missing.length}건`:'미확인 없음'}</span></div>
    {draft.items.some(i=>i.area==='trr')&&<p className="analysis-history-summary">{draft.summary}</p>}
    {missing.length?<div className="analysis-missing-grid">{missing.map((item,index)=><div key={`${item.field}:${index}`} title={item.reason}><strong>{item.field}</strong><span>{item.reason}</span></div>)}</div>:<p className="analysis-ok">필수 DATA에서 별도 미확인 항목이 없습니다.</p>}
   </section>
   <section className="analysis-card">
    <div className="analysis-card-heading"><div><h2>생성 DATA 현황</h2><p>이번 분석에서 생성된 영역별 DATA 건수입니다.</p></div></div>
    <div className="analysis-data-counts">{(Object.keys(REVIEW_AREAS) as ReviewArea[]).map(area=><div key={area}><strong>{areaItems(draft,area).length}</strong><span>{areaNames[area]}</span>{onArea&&<button disabled={busy} onClick={()=>onArea(area)}>상세 보기</button>}</div>)}</div>
   </section>
   <details className="analysis-detail-card"><summary>상세 보기</summary><div className="analysis-detail-body"><section><h3>AI 분석 설명</h3><p>{draft.summary}</p></section>{missing.length>0&&<section><h3>미확인 DATA</h3><ul>{missing.map((item,index)=><li key={`${item.field}:detail:${index}`}><strong>{item.field}</strong><span>{item.reason}</span></li>)}</ul></section>}<section><h3>생성 DATA 상세</h3>{(Object.keys(REVIEW_AREAS) as ReviewArea[]).map(area=>{const items=areaItems(draft,area);return <details key={area} className="analysis-area-detail"><summary>{areaNames[area]} · {items.length}건</summary>{items.length?<ul>{items.map(item=><li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span>{item.area==='trr'&&<span>반영 목차: {TRR_SECTIONS.indexOf(item.trrSection!)+1}. {item.trrSection} · 출처: {item.source}</span>}</li>)}</ul>:<p>생성된 DATA가 없습니다.</p>}</details>})}</section></div></details>
  </div>:<div className="analysis-history-tab">
   {loading?<p className="analysis-empty">분석 이력을 불러오는 중…</p>:!history.length&&!error?<p className="analysis-empty">저장된 분석 이력이 없습니다.</p>:null}
   <div className="analysis-history-list">{history.map((row,index)=>{const rowMissing=legacyMissingData(row.draft);return <article key={row.id} className={selected.includes(row.id)?'selected':''}><input type="checkbox" aria-label={`분석 v${row.version} 선택`} disabled={busy||(!selected.includes(row.id)&&selected.length>=5)} checked={selected.includes(row.id)} onChange={e=>{setChat(false);setSelected(ids=>e.target.checked?[...ids,row.id]:ids.filter(id=>id!==row.id))}}/><div className="analysis-history-content"><div className="analysis-history-heading"><div><b>분석 v{row.version}</b>{index===0&&<em>최신</em>}</div><small>{new Date(row.updatedAt*1000).toLocaleString('ko-KR')} · {row.updatedBy}</small></div><div className="analysis-history-counts">{(Object.keys(REVIEW_AREAS) as ReviewArea[]).map(area=><span key={area}>{areaNames[area]} <b>{areaItems(row.draft,area).length}</b></span>)}<span className={rowMissing.length?'missing':'ok'}>미확인 <b>{rowMissing.length}</b></span></div><details className="analysis-history-detail"><summary>상세 보기</summary><div><p className="analysis-history-summary">{row.draft.summary}</p>{rowMissing.length>0&&<section><h4>미확인 DATA</h4><ul>{rowMissing.map((item,i)=><li key={`${item.field}:${i}`}><strong>{item.field}</strong><span>{item.reason}</span></li>)}</ul></section>}<section><h4>생성 DATA</h4>{(Object.keys(REVIEW_AREAS) as ReviewArea[]).map(area=>{const items=areaItems(row.draft,area);return <details key={area}><summary>{areaNames[area]} · {items.length}건</summary>{items.length?<ul>{items.map(item=><li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul>:<p>생성된 DATA가 없습니다.</p>}</details>})}</section></div></details></div></article>})}</div>
   <div className="analysis-history-selection"><span>{selected.length}개 분석 선택</span><button disabled={busy||!selected.length} onClick={()=>setChat(true)}><Sparkles size={18}/>선택 분석 정리</button></div>
   {chat&&selectedHistory.length>0&&<CommonAiChatPanel key={selected.join(':')} projectName={projectName} source="분석 이력" contextType="customer-analysis-history" contextTitle={`${fileName} · 분석 이력`} items={selectedHistory.map(row=>({id:row.id,kind:'분석 이력',title:`분석 v${row.version}`}))} requestContext={{projectId,recordId,historyIds:selected}} onSendingChange={onBusy} onRemove={item=>setSelected(ids=>ids.filter(id=>id!==item.id))} onClear={()=>{setSelected([]);setChat(false)}}/>}
  </div>}
 </section>;
}
