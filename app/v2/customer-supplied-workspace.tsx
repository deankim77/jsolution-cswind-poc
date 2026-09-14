"use client";
import {useEffect,useState} from 'react';
import {Search,RefreshCw} from 'lucide-react';
import {readApiJson} from '../../lib/read-api-json';
import type {SuppliedData} from '../../lib/customer-supplied-contract';
import {SUPPLIED_CHANGE_LABELS} from '../../lib/customer-supplied-contract';
import CustomerSuppliedTable from './customer-supplied-table';
import './customer-supplied.css';
export default function CustomerSuppliedWorkspace({projectId}:{projectId:string}){
 const [data,setData]=useState<SuppliedData|null>(null),[query,setQuery]=useState(''),[removed,setRemoved]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const c=new AbortController();setError('');fetch(`/api/projects/${projectId}/customer-supplied`,{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await readApiJson(r);if(!r.ok)throw Error(d.error);setData(d)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[projectId,reload]);
 const rows=(data?.entries??[]).filter(r=>(removed||r.status==='active')&&`${r.section} ${r.itemNumber} ${r.description}`.toLowerCase().includes(query.toLowerCase()));
 return <><div className="wv2-toolbar"><label><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="SECTION·고객 품목번호·품명 검색"/></label><button onClick={()=>setReload(n=>n+1)}><RefreshCw size={18}/>새로고침</button><label><input type="checkbox" checked={removed} onChange={e=>setRemoved(e.target.checked)}/>삭제·대체 이전 품목 포함</label><span className="cswind-data-count">{rows.length}개 사급품</span></div><section className="wv2-canvas">{error&&<p role="alert" className="wv2-form-error">{error}</p>}{!data&&!error?<p>사급품 목록을 불러오는 중…</p>:<CustomerSuppliedTable rows={rows.map(r=>({...r,changeLabel:r.status==='removed'?'삭제':SUPPLIED_CHANGE_LABELS[r.change as keyof typeof SUPPLIED_CHANGE_LABELS]??r.change,source:`원본 ${r.recordId} · 분석 v${r.version} · ${r.bomApplied?'BOM 반영 완료':'BOM 미반영'}`}))}/>}</section></>;
}
