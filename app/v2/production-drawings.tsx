"use client";
import {useEffect,useState} from 'react';
import {RefreshCw,Search} from 'lucide-react';
import {CustomerThumbnail} from './customer-data-workspace';
import {customerReceiptId,type CustomerDataRecord} from '../../lib/customer-data-contract';
import {resolveDrawingTitle} from '../../lib/production-drawing-metadata';
import type {ReviewState} from '../../lib/customer-review-contract';

export default function ProductionDrawings({projectId}:{projectId:string}){
 const [records,setRecords]=useState<CustomerDataRecord[]>([]),[reviews,setReviews]=useState<ReviewState[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');const base=`/api/projects/${projectId}/customer-data`;
  const read=async(url:string)=>{const r=await fetch(url,{signal:c.signal,cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'도면 조회에 실패했습니다.');return d};
  Promise.all([read(base),read(`${base}/review`)]).then(([raw,analysis])=>{if(c.signal.aborted)return;setRecords(raw.records??[]);setReviews(analysis.reviews??[])}).catch(e=>{if(!c.signal.aborted)setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort();
 },[projectId,reload]);
 const rows=records.flatMap(record=>{const draft=reviews.find(r=>r.recordId===record.id)?.draft;if(!draft||draft.documentType!=='drawing'||!draft.documentTypeConfirmed)return [];const title=resolveDrawingTitle(draft,record.id);return [{record,draft,title}]}).filter(({record,draft,title})=>`${customerReceiptId(record)} ${title} ${draft.drawingNumber} ${draft.revisionLabel}`.toLowerCase().includes(query.toLowerCase()));
 return <><div className="wv2-toolbar"><label><Search size={18}/><input aria-label="도면 검색" placeholder="자료번호·도면명·도면번호 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label><button onClick={()=>setReload(v=>v+1)}><RefreshCw size={18}/>새로고침</button><span className="cswind-data-count">{rows.length}개 도면</span></div><section className="wv2-canvas customer-intake-canvas">{error&&<p role="alert">{error}</p>}<div className="cswind-data-table"><table><thead><tr><th>미리보기</th><th>자료번호</th><th>도면명</th><th>도면번호</th><th>리비전</th></tr></thead><tbody>{!loading&&!error&&rows.map(({record,draft,title})=><tr key={record.id}><td><CustomerThumbnail projectId={projectId} record={record}/></td><td>{customerReceiptId(record)}</td><td>{title||'미확인'}</td><td>{draft.drawingNumber||'미확인'}</td><td>{draft.revisionLabel||'미확인'}</td></tr>)}{(loading||error||!rows.length)&&<tr><td colSpan={5}>{loading?'도면을 불러오는 중…':error?'새로고침하여 다시 시도하세요.':'도면으로 확정된 분석 결과가 없습니다.'}</td></tr>}</tbody></table></div></section></>;
}
