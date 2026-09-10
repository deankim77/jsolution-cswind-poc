"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Download,Plus,RefreshCw,Search,Upload} from 'lucide-react';
import type {V2Project} from './project-workspaces';
import type {WorkspaceFilterConfig} from './workspace-filter-panel';
import type {CustomerDataList,CustomerDataRecord} from '../../lib/customer-data-contract';
import DocumentPreviewRenderer from './document-preview-renderer';
import './customer-data-workspace.css';

export function CustomerSourcePreview({projectId,record}:{projectId:string;record:CustomerDataRecord}){
 const ref=useRef<HTMLDivElement>(null),url=`/api/projects/${projectId}/customer-data/${record.id}`;
 return <DocumentPreviewRenderer key={record.id} projectId={projectId} viewerRef={ref} tab={{id:record.id,projectId,deliverableId:record.id,title:record.fileName,versionId:record.id}} item={{id:record.id,projectId,name:record.fileName}} versions={[{id:record.id,deliverableId:record.id,revision:record.revision,fileName:record.fileName,fileSize:record.fileSize}]} sourceUrls={{preview:`${url}?preview=1`,download:url}} onVersion={()=>{}} onRegisterRevision={()=>{}}/>;
}
export const uploadTime=(time:number)=>new Date(time*1000).toLocaleString('ko-KR');
export default function CustomerDataWorkspace({project,embedded=false}: {project:V2Project|null;embedded?:boolean;onOpenFilter?:(config:WorkspaceFilterConfig)=>void}){
 const [data,setData]=useState<CustomerDataList|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[reload,setReload]=useState(0),[selected,setSelected]=useState<CustomerDataRecord|null>(null),[uploading,setUploading]=useState(false),[open,setOpen]=useState(false),[drag,setDrag]=useState(false),[results,setResults]=useState<{name:string;status:string}[]>([]);
 const input=useRef<HTMLInputElement>(null),running=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>{if(!project)return;const c=new AbortController();setError('');fetch(`/api/projects/${project.id}/customer-data`,{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d}).then(setData).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[project?.id,reload]);
 async function upload(files:File[]){if(!project||running.current||!data?.canUpload||!files.length)return;running.current=true;setUploading(true);setResults(files.map(f=>({name:f.name,status:'대기'})));setError('');
 for(let i=0;i<files.length;i++){if(!mounted.current)break;const file=files[i];const status=(value:string)=>{if(mounted.current)setResults(rows=>rows.map((r,n)=>n===i?{...r,status:value}:r))};status('업로드 중');try{if(!file.size||file.size>50*1024*1024)throw Error('파일은 0바이트 초과·50MB 이하');const form=new FormData();form.set('file',file);const r=await fetch(`/api/projects/${project.id}/customer-data`,{method:'POST',body:form});const d=await r.json();if(!r.ok)throw Error(d.error);status(d.record.duplicate?'중복 제외':'등록 완료');}catch(e){status(`실패: ${(e as Error).message}`);}}
 running.current=false;if(mounted.current){setUploading(false);setReload(x=>x+1);if(input.current)input.current.value='';}}
 if(!project)return <p>생산 프로젝트를 선택하세요.</p>;
 const rows=(data?.records??[]).filter(r=>`${r.fileName} ${r.createdByName||''}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));
 const body=<><div className="wv2-toolbar">
 {(selected||open)?<button disabled={uploading} onClick={()=>{setSelected(null);setOpen(false)}}><ArrowLeft size={18}/>목록으로</button>:<><label><Search size={18}/><input aria-label="원본 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="원본 파일명·업로드 담당자 검색"/></label><button onClick={()=>setReload(v=>v+1)}><RefreshCw size={18}/>새로고침</button></>}
 <span className="cswind-data-count">{selected?selected.fileName:open?'고객 자료 일괄 업로드':`${rows.length}개 원본 · 최신 업로드순`}</span>
 {!selected&&!open&&<button className="wv2-add" disabled={!data?.canUpload} onClick={()=>{setResults([]);setOpen(true)}}><Plus size={18}/>원본 등록</button>}
 </div><section className="wv2-canvas customer-intake-canvas">
 {error&&<p role="alert" className="wv2-form-error">{error}</p>}
 {selected?<CustomerSourcePreview projectId={project.id} record={selected}/>:open?<div className="customer-upload-area"><label className={`customer-drop ${drag?'drag':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);void upload(Array.from(e.dataTransfer.files))}}><input className="customer-upload-picker" aria-label="고객 원본 파일 선택" ref={input} multiple type="file" disabled={uploading} onChange={e=>void upload(Array.from(e.target.files??[]))}/><Upload size={24}/><strong>{uploading?'고객 자료를 접수하고 있습니다…':'여러 파일을 여기에 놓거나 클릭해서 선택하세요'}</strong><span>파일당 최대 50MB · 동일 내용은 중복 제외 · 문서 분류는 AI Data Review에서 확인</span></label><p>{uploading?'업로드 완료까지 이 화면을 유지하세요.':'파일을 선택하면 바로 업로드합니다. 실패한 파일만 다시 선택할 수 있습니다.'}</p><table className="production-table"><thead><tr><th>원본 파일명</th><th>처리 결과</th></tr></thead><tbody>{results.map((r,i)=><tr key={i}><td>{r.name}</td><td role="status">{r.status}</td></tr>)}</tbody></table></div>:<div className="cswind-data-table"><table><thead><tr><th>원본 파일명 / 미리보기</th><th>업로드 담당자</th><th>업로드 일시</th><th>다운로드</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><button onClick={()=>setSelected(r)}>{r.fileName}</button></td><td>{r.createdByName||r.createdBy}</td><td>{uploadTime(r.createdAt)}</td><td><a aria-label={`${r.fileName} 다운로드`} href={`/api/projects/${project.id}/customer-data/${r.id}`}><Download size={18}/></a></td></tr>)}{!rows.length&&<tr><td colSpan={4}>{!data&&!error?'고객 자료를 불러오는 중…':error?'조회에 실패했습니다. 새로고침하세요.':'접수된 자료가 없습니다. + 원본 등록으로 파일을 올려주세요.'}</td></tr>}</tbody></table></div>}
 </section></>;
 return embedded?body:<section className="customer-intake-standalone">{body}</section>;
}
