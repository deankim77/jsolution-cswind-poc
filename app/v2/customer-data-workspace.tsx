"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Download,FileText,Plus,RefreshCw,Search,Upload} from 'lucide-react';
import type {V2Project} from './project-workspaces';
import type {WorkspaceFilterConfig} from './workspace-filter-panel';
import {CUSTOMER_SOURCE_PURPOSES,type CustomerSourcePurpose,type CustomerDataList,type CustomerDataRecord} from '../../lib/customer-data-contract';
import {customerReceiptId} from '../../lib/customer-data-contract';
import DocumentPreviewRenderer from './document-preview-renderer';
import './customer-data-workspace.css';

export function CustomerSourcePreview({projectId,record}:{projectId:string;record:CustomerDataRecord}){
 const ref=useRef<HTMLDivElement>(null),url=`/api/projects/${projectId}/customer-data/${record.id}`;
 return <DocumentPreviewRenderer key={record.id} projectId={projectId} viewerRef={ref} tab={{id:record.id,projectId,deliverableId:record.id,title:record.fileName,versionId:record.id}} item={{id:record.id,projectId,name:record.fileName}} versions={[{id:record.id,deliverableId:record.id,revision:record.revision,fileName:record.fileName,fileSize:record.fileSize}]} sourceUrls={{preview:`${url}?preview=1`,download:url}} onVersion={()=>{}} onRegisterRevision={()=>{}}/>;
}
export const uploadTime=(time:number)=>new Date(time*1000).toLocaleString('ko-KR');
export default function CustomerDataWorkspace({project,embedded=false,purposeScope}: {project:V2Project|null;embedded?:boolean;purposeScope?:'ttr';onOpenFilter?:(config:WorkspaceFilterConfig)=>void}){
 const [data,setData]=useState<CustomerDataList|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[reload,setReload]=useState(0),[uploading,setUploading]=useState(false),[open,setOpen]=useState(false),[drag,setDrag]=useState<string|null>(null),[results,setResults]=useState<{name:string;status:string;purpose:CustomerSourcePurpose}[]>([]);
 const running=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>{const refresh=()=>{if(!running.current)setReload(value=>value+1)};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[]);
 useEffect(()=>{if(!project)return;const c=new AbortController();setError('');fetch(`/api/projects/${project.id}/customer-data`,{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d}).then(setData).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[project?.id,reload]);
 async function upload(files:File[],sourcePurpose:CustomerSourcePurpose){if(purposeScope||!project||running.current||!data?.canUpload||!files.length)return;running.current=true;setUploading(true);setResults(files.map(f=>({name:f.name,status:'대기',purpose:sourcePurpose})));setError('');
 for(let i=0;i<files.length;i++){if(!mounted.current)break;const file=files[i];const status=(value:string)=>{if(mounted.current)setResults(rows=>rows.map((r,n)=>n===i?{...r,status:value}:r))};status('업로드 중');try{if(!file.size||file.size>50*1024*1024)throw Error('파일은 0바이트 초과·50MB 이하');const form=new FormData();form.set('file',file);form.set('intakeGroup','unclassified');form.set('sourcePurpose',sourcePurpose);const r=await fetch(`/api/projects/${project.id}/customer-data`,{method:'POST',body:form});const d=await r.json();if(!r.ok)throw Error(d.error);status(d.trrWarning||(d.record.duplicate?'중복 제외':'등록 완료'));}catch(e){status(`실패: ${(e as Error).message}`);}}
 running.current=false;if(mounted.current){setUploading(false);setReload(x=>x+1);}}
 if(!project)return <p>생산 프로젝트를 선택하세요.</p>;
 const rows=(data?.records??[]).filter(r=>(!purposeScope||r.sourcePurpose===purposeScope)&&`${customerReceiptId(r)} ${r.fileName} ${r.createdByName||''}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));
 const uploadPurposes=['bom','ttr'] as const;
 const uploadOpen=open&&!purposeScope;
 const body=<><div className="wv2-toolbar">
 {uploadOpen?<button disabled={uploading} onClick={()=>{setOpen(false)}}><ArrowLeft size={18}/>목록으로</button>:<><label><Search size={18}/><input aria-label="원본 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="자료 ID·파일명·담당자 검색"/></label><button onClick={()=>setReload(v=>v+1)}><RefreshCw size={18}/>새로고침</button></>}
 <span className="cswind-data-count">{uploadOpen?(purposeScope?'TRR 자료 일괄 업로드':'고객 자료 일괄 업로드'):`${rows.length}개 원본 · 최신 업로드순`}</span>
 {!purposeScope&&!open&&<button className="wv2-add customer-source-register" disabled={!data?.canUpload} onClick={()=>{setResults([]);setOpen(true)}}><Plus size={18}/>원본 등록</button>}
 </div><section className="wv2-canvas customer-intake-canvas">
 {error&&<p role="alert" className="wv2-form-error">{error}</p>}
 {uploadOpen?<div className="customer-upload-area"><p className="customer-upload-guidance">BOM 추출을 위한 도면, TRR 작성을 위한 기술문서·참고자료를 등록해 주세요. (TRR 작성 시 도면 정보도 참조합니다.)</p><div className="customer-upload-cards">{uploadPurposes.map(purpose=><label key={purpose} className={`customer-drop ${drag===purpose?'drag':''}`} onDragOver={e=>{e.preventDefault();if(!uploading)setDrag(purpose)}} onDragLeave={()=>setDrag(null)} onDrop={e=>{e.preventDefault();setDrag(null);void upload(Array.from(e.dataTransfer.files),purpose)}}><input className="customer-upload-picker" aria-label={`${CUSTOMER_SOURCE_PURPOSES[purpose]} 파일 선택`} multiple type="file" disabled={uploading} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';void upload(files,purpose)}}/><Upload size={24}/><strong>{CUSTOMER_SOURCE_PURPOSES[purpose]}</strong><span>{uploading?'고객 자료를 접수하고 있습니다…':'파일을 끌어다 놓거나 클릭해서 선택하세요'}</span><span>여러 파일 선택 · 파일당 최대 50MB</span></label>)}</div><table className="production-table"><thead><tr><th>원본 파일명</th><th>자료 용도</th><th>처리 결과</th></tr></thead><tbody>{results.map((r,i)=><tr key={i}><td>{r.name}</td><td>{CUSTOMER_SOURCE_PURPOSES[r.purpose]}</td><td role="status">{r.status}</td></tr>)}</tbody></table></div>:<div className="cswind-data-table"><table><thead><tr><th>미리보기</th><th>자료 ID</th><th>원본 파일명</th><th>자료 용도</th><th>업로드 담당자</th><th>업로드 일시</th><th>다운로드</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><button type="button" className="customer-thumb" aria-label={`${r.fileName} 원본 미리보기`} title={`${r.fileName} 팝업으로 보기`} onClick={()=>{window.open(`/api/projects/${project.id}/customer-data/${r.id}?preview=1&popup=1`,'_blank',`popup=yes,width=${window.screen.availWidth},height=${window.screen.availHeight},left=0,top=0,resizable=yes,scrollbars=yes,noopener,noreferrer`)}}>{/\.(png|jpe?g|webp)$/i.test(r.fileName)?<img loading="lazy" alt="원본 미리보기" src={`/api/projects/${project.id}/customer-data/${r.id}?preview=1`}/>:<FileText size={18}/>}</button></td><td>{customerReceiptId(r)}</td><td title={r.fileName}>{r.fileName}</td><td>{CUSTOMER_SOURCE_PURPOSES[r.sourcePurpose??'input']}</td><td>{r.createdByName||r.createdBy}</td><td>{uploadTime(r.createdAt)}</td><td><a aria-label={`${r.fileName} 다운로드`} href={`/api/projects/${project.id}/customer-data/${r.id}`}><Download size={18}/></a></td></tr>)}{!rows.length&&<tr><td colSpan={7}>{!data&&!error?'고객 자료를 불러오는 중…':error?'조회에 실패했습니다. 새로고침하세요.':purposeScope?'등록된 TRR 자료가 없습니다. 고객 Data에서 등록해 주세요.':'접수된 자료가 없습니다. + 원본 등록으로 파일을 올려주세요.'}</td></tr>}</tbody></table></div>}
 </section></>;
 return embedded?body:<section className="customer-intake-standalone">{body}</section>;
}
