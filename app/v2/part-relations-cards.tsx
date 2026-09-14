"use client";
import {useEffect,useState} from 'react';
import {FileText,FolderOpen,Layers3,Link2} from 'lucide-react';
import type {PartRelations} from '../../lib/part-relations';
import {readApiJson} from '../../lib/read-api-json';
import './part-relations-cards.css';
export default function PartRelationsCards({partId,refreshKey,parents,children}:{partId:string;refreshKey:number;parents:number;children:number}){
 const [data,setData]=useState<PartRelations|null>(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();setData(null);setError('');fetch(`/api/product-data/part-relations?partId=${encodeURIComponent(partId)}`,{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await readApiJson(r);if(!r.ok)throw Error(d.error);if(!c.signal.aborted)setData(d)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[partId,refreshKey]);
 return <div className="wv2-part-relation-tab">
 {error&&<p role="alert">{error}</p>}
 <section className="part-relation-details"><FileText size={20}/><div><b>연관 도면</b>{!data&&!error?<span>조회 중…</span>:data?.drawings.length?data.drawings.map(d=><a key={d.id} href={`/api/projects/${d.projectId}/customer-data/${d.id}?preview=1&popup=1`} target="_blank" rel="noopener noreferrer"><strong>{d.kind==='part'?'해당 부품 도면':'상위 ASSY 도면'}</strong><span>{d.fileName}</span><small>{d.drawingNumber||'도면번호 미확인'} · {d.revision?`Rev.${d.revision}`:'Revision 미확인'} · {d.projectName}</small></a>):!error&&<span>연결된 고객 도면이 없습니다.</span>}</div></section>
 <section><Layers3 size={20}/><div><b>BOM 사용 관계</b><span>상위 {parents}개 · 하위 {children}개</span></div><em>연결됨</em></section>
 <section><Link2 size={20}/><div><b>설계변경 · 품질 · Workflow</b><span>PART 기준 연관 객체를 한곳에서 확인합니다.</span></div><em>확장 예정</em></section>
 <section className="part-relation-details"><FolderOpen size={20}/><div><b>사용 프로젝트{data?` (${data.projects.length})`:''}</b>{!data&&!error?<span>조회 중…</span>:data?.projects.length?data.projects.map(p=><article key={p.id}><strong>{p.name}</strong><small>{p.code}</small></article>):!error&&<span>BOM에서 사용 중인 프로젝트가 없습니다.</span>}</div></section>
 </div>;
}
