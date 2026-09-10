"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {FileText,Search,RefreshCw,Save,Filter,ExternalLink} from 'lucide-react';
import CommonAiChatPanel from '../common-ai-chat-panel';
import CustomerDataWorkspace,{uploadTime} from './customer-data-workspace';
import type {V2Project} from './project-workspaces';
import type {CustomerDataList} from '../../lib/customer-data-contract';
import {REVIEW_AREAS,REVIEW_TYPES,type ReviewState,type ReviewDraft,type ConfirmedReview} from '../../lib/customer-review-contract';
import {FilterSelect,type WorkspaceFilterConfig} from './workspace-filter-panel';
import {WorkPanelFrame} from './work-panel';
import ReviewDecisionActions from './review-decision-actions';
import ReviewRequirementsTable from './review-requirements-table';
import CustomerSourceLink from './customer-source-link';
import {customerReceiptId} from '../../lib/customer-data-contract';
import PbomTable from './pbom-table';
import CustomerAnalysisResults from './customer-analysis-results';
import {buildBomRows,type ProjectPbom,type BomRow} from '../../lib/pbom-contract';
import './production-workspace.css';
export const productionTabs=[['customer','고객 Data'],['review','AI Data Review'],['pbom','PBOM'],['extract','AI 추출사항']] as const;
export type ProductionTab=typeof productionTabs[number][0];
export default function ProductionWorkspace({project,tab,onCloseAi,onOpenFilter,onOpenBomEditor,panelHidden=false}:{onOpenBomEditor:(rootId:string)=>void;onOpenFilter:(config:WorkspaceFilterConfig)=>void;project:V2Project;tab:ProductionTab;panelHidden?:boolean;onCloseAi:()=>void}){
 const [data,setData]=useState<CustomerDataList|null>(null),[reviews,setReviews]=useState<ReviewState[]>([]),[confirmed,setConfirmed]=useState<ConfirmedReview[]>([]),[reload,setReload]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[type,setType]=useState(''),[status,setStatus]=useState(''),[selected,setSelected]=useState(''),[checked,setChecked]=useState<string[]>([]),[draft,setDraft]=useState<ReviewDraft|null>(null),[itemIds,setItemIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
 const [filterOpen,setFilterOpen]=useState(false),[filterDraft,setFilterDraft]=useState({type:'',status:''}),[previousDraft,setPreviousDraft]=useState<ReviewDraft|null>(null);
 const [panelWide,setPanelWide]=useState(false),[reviewTab,setReviewTab]=useState<string>('summary'),[editing,setEditing]=useState('');
 const [pbomToolbar,setPbomToolbar]=useState<HTMLDivElement|null>(null);
 const [pbom,setPbom]=useState<ProjectPbom|null>(null),[pbomError,setPbomError]=useState('');
 const draftRef=useRef<ReviewDraft|null>(null);
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const url=`/api/projects/${project.id}/customer-data`,current=reviews.find(r=>r.recordId===selected),record=data?.records.find(r=>r.id===selected);
 const refresh=useCallback(()=>setReload(x=>x+1),[]);
 useEffect(()=>{const c=new AbortController();setError('');Promise.all([fetch(url,{signal:c.signal}),fetch(`${url}/review`,{signal:c.signal})].map(async r=>{const res=await r,d=await res.json();if(!res.ok)throw Error(d.error);return d})).then(([d,r])=>{setData(d);setReviews(r.reviews);setConfirmed(r.confirmed)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[url,reload]);
 useEffect(()=>{if(tab!=='review'&&tab!=='pbom')return;const c=new AbortController();setPbomError('');fetch(`/api/projects/${project.id}/pbom`,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setPbom(d)}).catch(e=>{if(!c.signal.aborted)setPbomError(e.message)});return()=>c.abort()},[project.id,tab,reload]);
 useEffect(()=>{setDraft(current?.draft??null);setDirty(false);setItemIds([]);},[selected,current?.version]);
 useEffect(()=>{onCloseAi();setSelected('')},[tab]);
 const rows=(data?.records??[]).filter(r=>{const d=reviews.find(v=>v.recordId===r.id)?.draft;return (!r.sourcePurpose||r.sourcePurpose==='input')&&(!type||(d?.documentType??'unclassified')===type)&&(!status||(status==='analyzed'?Boolean(d):!d))&&`${customerReceiptId(r)} ${r.fileName} ${d?.drawingNumber??''} ${d?.summary??''}`.toLowerCase().includes(query.toLowerCase())});
 useEffect(()=>{setPreviousDraft(null)},[selected]);
 useEffect(()=>{draftRef.current=current?.draft??null},[current]);
 useEffect(()=>{if(!filterOpen)return;onOpenFilter({eyebrow:'AI DATA REVIEW',title:'문서 분석 필터',description:'문서 종류와 분석 상태를 선택하세요.',resultCount:(data?.records??[]).filter(r=>{const d=reviews.find(v=>v.recordId===r.id)?.draft;return (!filterDraft.type||(d?.documentType??'unclassified')===filterDraft.type)&&(!filterDraft.status||(filterDraft.status==='analyzed'?Boolean(d):!d))}).length,activeCount:Number(Boolean(filterDraft.type))+Number(Boolean(filterDraft.status)),onCancel:()=>setFilterOpen(false),onApply:()=>{setType(filterDraft.type);setStatus(filterDraft.status);setFilterOpen(false)},onReset:()=>setFilterDraft({type:'',status:''}),content:<><FilterSelect label="문서 종류" value={filterDraft.type} options={Object.entries(REVIEW_TYPES).map(([value,label])=>({value,label}))} onChange={type=>setFilterDraft(d=>({...d,type}))}/><FilterSelect label="분석 상태" value={filterDraft.status} options={[{value:'pending',label:'미분석'},{value:'analyzed',label:'분석 초안 있음'}]} onChange={status=>setFilterDraft(d=>({...d,status}))}/></>})},[filterOpen,filterDraft,data,reviews,onOpenFilter]);
 const accept=(result:any)=>{if(!mounted.current)return;if(result.review){setPreviousDraft(draftRef.current);setReviews(values=>[result.review,...values.filter(r=>r.recordId!==result.review.recordId)]);setNotice('AI 분석 초안을 갱신했습니다. 확정 전 DATA입니다.');}};
 const post=async(body:unknown)=>{const r=await fetch(`${url}/review`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);return d;};
 const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action()}catch(e){setError((e as Error).message)}finally{if(mounted.current)setBusy(false)}};
 const analyze=()=>run(async()=>{const result=await post({recordId:selected,recordIds:[...new Set([selected,...checked])],message:'선택 문서 1건을 기준으로 문서 타입을 분류하고 PBOM과 AI 추출사항을 작성해 주세요. AI 추출사항은 활용 대상, 관련 ASSY/PART, 품번·품명과 추출 내용을 구조화하고 원본에 없는 내용은 만들지 마세요.'});accept(result)});
 const choose=(id:string,area='summary')=>{if(busy||dirty)return;onCloseAi();setSelected(id);setReviewTab(area);setPanelWide(false);setNotice('');setError('');};
 const close=()=>{if(busy)return;if(dirty&&!window.confirm('저장하지 않은 초안을 버리고 닫을까요?'))return;setSelected('');setDirty(false);};
 const popup=(id:string)=>{window.open(`${url}/${id}?preview=1&popup=1`,'_blank','popup,width=1200,height=900,noopener,noreferrer');};
 let bomRows:BomRow[]=[],bomError='';try{bomRows=buildBomRows(draft?.items.filter(i=>i.area==='pbom')??[],pbom?.identities??[])}catch(e){bomError=(e as Error).message;bomRows=(draft?.items.filter(i=>i.area==='pbom'&&i.bom)??[]).map(i=>({...i,bom:i.bom!,level:1,path:'구조 확인 필요',totalQuantity:null,calculatedWeight:null,calculatedWeightSource:'Not Available',match:'NEED_REVIEW'}));}
 const areaItems=draft?.items.filter(i=>i.area===reviewTab)??[];
 const areaConfirmed=confirmed.filter(c=>c.recordId===selected&&c.item.area===reviewTab);
 const areaIds=itemIds.filter(id=>areaItems.some(i=>i.id===id));
 const selectTab=(key:string)=>{setReviewTab(key);setEditing('');setItemIds([]);};
 if(tab==='customer')return <CustomerDataWorkspace key={project.id} project={project} embedded/>;
 const renderSource=(ids:string[])=> <div className="customer-source-links">{[...new Set(ids.filter(Boolean))].map(id=>{const source=data?.records.find(r=>r.id===id);return source?<CustomerSourceLink key={id} record={source}/>:<span key={id} title={id}>{data?'원본 확인 필요':'자료 조회 중…'}</span>})}</div>;
 const confirmedRows=confirmed.filter(c=>c.item.area===tab&&!confirmed.some(n=>n.recordId===c.recordId&&n.item.id===c.item.id&&n.version>c.version));
 const chatIds=[...new Set([selected,...checked])];
 return <><div className="wv2-toolbar"><label><Search size={18}/><input value={query} disabled={busy||dirty} onChange={e=>setQuery(e.target.value)} placeholder={tab==='review'?'자료 ID·파일명·분석 내용 검색':'확정 DATA 검색'}/></label>{tab==='review'&&<button disabled={busy||dirty} onClick={()=>{setSelected('');setFilterDraft({type,status});setFilterOpen(true)}}><Filter size={18}/>상세 필터</button>}<button disabled={busy||dirty} onClick={refresh}><RefreshCw size={18}/>새로고침</button>{tab==='pbom'&&pbom?.root&&<button onClick={()=>onOpenBomEditor(pbom.root!.id)}>BOM 편집기 · 구매품/공용품 추가</button>}{tab==='pbom'&&<div className="pbom-toolbar-slot" ref={setPbomToolbar}/>}<span className="cswind-data-count">{tab==='review'?`${rows.length}개 문서`:tab==='pbom'?`${pbom?.rows.length??0}개 BOM 행`:`${confirmedRows.length}개 확정 항목`}</span></div>
 <section className="wv2-canvas customer-review-canvas">
 {!record&&error&&<p role="alert" className="wv2-form-error">{error}</p>}{pbomError&&<p role="alert" className="wv2-form-error">{pbomError}</p>}
 {tab==='review'?<div className="cswind-data-table"><table className="production-table customer-document-list"><thead><tr><th>비교</th><th>미리보기</th><th>자료 ID</th><th>원본 파일명</th><th>문서 종류</th><th>분석 상태</th>{Object.entries(REVIEW_AREAS).map(([key,label])=><th className="review-count-column" key={key} title={label.replace(/^\d+\. /,'')}>{label.replace(/^\d+\. /,'')}</th>)}</tr></thead><tbody>{rows.map(r=>{
 const review=reviews.find(v=>v.recordId===r.id);
 return <tr key={r.id} className={selected===r.id?'selected':''} onClick={()=>choose(r.id)}>
 <td onClick={e=>e.stopPropagation()}><input title="기준 문서 외 최대 4개 비교" aria-label={`${r.fileName} 비교 선택`} type="checkbox" checked={checked.includes(r.id)} disabled={busy||dirty||Boolean(selected)||(!checked.includes(r.id)&&checked.length>=4)} onChange={e=>setChecked(ids=>e.target.checked?[...ids,r.id]:ids.filter(id=>id!==r.id))}/></td>
 <td onClick={e=>{e.stopPropagation();popup(r.id)}}><button type="button" className="customer-thumb" aria-label={`${r.fileName} 원본 미리보기`} title={`${r.fileName} 팝업으로 보기`}>{/\.(png|jpe?g|webp)$/i.test(r.fileName)?<img loading="lazy" alt="원본 미리보기" src={`${url}/${r.id}?preview=1`}/>:<FileText size={18}/>}</button></td>
 <td><button type="button" className="customer-file-link" disabled={busy||dirty} onClick={e=>{e.stopPropagation();choose(r.id)}}>{customerReceiptId(r)}</button></td>
 <td><button type="button" className="customer-file-link" disabled={busy||dirty} onClick={e=>{e.stopPropagation();choose(r.id)}} title={r.fileName}>{r.fileName}</button></td>
 <td>{REVIEW_TYPES[review?.draft.documentType??'unclassified']}</td><td>{review?'AI 분석 완료':'미분석'}</td>
 {Object.entries(REVIEW_AREAS).map(([area,label])=><td className="review-count-column" key={area} onClick={e=>{e.stopPropagation();choose(r.id,area)}}><button type="button" disabled={busy||dirty} aria-label={`${customerReceiptId(r)} ${label.replace(/^\d+\. /,'')} 분석 결과 보기`}>{review?review.draft.items.filter(item=>item.area===area).length:'—'}</button></td>)}
 </tr>;
 })}{!rows.length&&<tr><td colSpan={8}>{!data&&!error?'자료를 불러오는 중…':'표시할 문서가 없습니다.'}</td></tr>}</tbody></table></div> :tab==='pbom'?<>{pbom?.root?<PbomTable toolbarContainer={pbomToolbar} renderSource={renderSource} rows={pbom.rows.filter(r=>!query||`${JSON.stringify(r)} ${(r.sourceRecordIds??[r.recordId]).map(id=>{const source=data?.records.find(d=>d.id===id);return source?customerReceiptId(source):id}).join(' ')}`.toLowerCase().includes(query.toLowerCase()))} root={pbom.root} onOpenEditor={()=>onOpenBomEditor(pbom.root!.id)}/>:!pbomError&&<p className="production-help">{pbom?'기존 프로젝트의 TOP 품목을 생성하세요.':'BOM을 불러오는 중…'} {pbom&&data?.canReview&&<button disabled={busy} onClick={()=>void run(async()=>{const r=await fetch(`/api/projects/${project.id}/pbom`,{method:'POST'});const d=await r.json();if(!r.ok)throw Error(d.error);refresh()})}>TOP 품목 생성</button>}</p>}</>:<><p className="production-help">AI DATA REVIEW에서 확정한 추출사항입니다.</p><ReviewRequirementsTable rows={confirmedRows.filter(c=>`${JSON.stringify(c.item)}`.toLowerCase().includes(query.toLowerCase())).map(c=>({item:c.item,decision:`확정 v${c.version} · ${uploadTime(c.confirmedAt)}`}))}/></>}
 </section>
 {tab==='review'&&record&&!panelHidden&&<WorkPanelFrame variant="review" wide={panelWide} onWide={()=>setPanelWide(v=>!v)} onClose={close} eyebrow="AI DATA REVIEW" title={record.fileName} description={`${customerReceiptId(record)} · ${project.name} · ${current?`분석 초안 v${current.version}`:'미분석'}`}>
 <nav>{[['summary','AI 분석 결과'],...Object.entries(REVIEW_AREAS).map(([key,label])=>[key,label.replace(/^\d+\. /,'')]),['ai','AI 대화']].map(([key,label])=><button key={key} className={reviewTab===key?'active':''} disabled={busy||(dirty&&key==='ai')} onClick={()=>selectTab(key)}>{label}{draft&&key in REVIEW_AREAS?` (${draft.items.filter(i=>i.area===key).length})`:''}</button>)}</nav>
 <section className="wv2-panel-body review-panel-body">
 <div className="review-draft">
 <div className="review-decision review-confirm-actions"><button onClick={()=>popup(record.id)}><ExternalLink size={18}/>원본 팝업</button><button disabled={busy||dirty||!data?.canReview} onClick={()=>void analyze()}><RefreshCw size={18}/>{current?'재검증':'AI 분석'}</button>{draft&&reviewTab!=='ai'&&<div className="review-save-actions">{dirty&&<><button disabled={busy} onClick={()=>void run(async()=>{accept(await post({action:'save',recordId:selected,version:current?.version,draft}));setDirty(false)})}><Save size={18}/>초안 저장</button><button disabled={busy} onClick={()=>{setDraft(current?.draft??null);setDirty(false)}}>수정 취소</button></>}{reviewTab!=='summary'&&<ReviewDecisionActions key={`${selected}:${reviewTab}`}
 selectedCount={areaIds.length} totalCount={areaItems.length}
 documentName={record.fileName} areaLabel={REVIEW_AREAS[reviewTab as keyof typeof REVIEW_AREAS]?.replace(/^\d+\. /,'')??reviewTab}
 confirmedCount={new Set(areaConfirmed.map(c=>c.item.id)).size}
 selectionDisabled={busy||dirty||!data?.canReview||!areaItems.length||(reviewTab==='pbom'&&(!bomRows.length||Boolean(bomError)))}
 confirmDisabled={dirty||busy||!data?.canReview||!areaIds.length||(reviewTab==='pbom'&&(!pbom||Boolean(pbomError)||Boolean(bomError)||bomRows.length!==areaItems.length))}
 cancelDisabled={busy||dirty||!data?.canReview||!areaConfirmed.length}
 onSelectAll={checked=>setItemIds(checked?areaItems.map(i=>i.id):[])}
 onConfirm={()=>void run(async()=>{await post({action:'confirm',recordId:selected,version:current?.version,itemIds:areaIds});setItemIds([]);setNotice('선택한 DATA를 확정했습니다.');refresh()})}
 onCancel={()=>void run(async()=>{const result=await post({action:'cancel',recordId:selected,area:reviewTab,confirmationIds:areaConfirmed.map(c=>c.id)});setItemIds([]);setNotice(result.retained?`확정을 취소했습니다. 기존·공유·수동 변경 BOM ${result.retained}건은 유지했습니다.`:'확정을 취소했습니다.');refresh()})}
 />} </div>}</div>
 {error&&<p role="alert" className="wv2-form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">AI 처리 중입니다…</p>}
 {reviewTab==='ai'?<CommonAiChatPanel key={`${project.id}:${selected}`} projectName={project.name} source="고객 Data Review" contextType="customer-review" contextTitle={record.fileName} items={chatIds.map(id=>({id,kind:'고객 원본',title:data?.records.find(r=>r.id===id)?.fileName||id}))} requestContext={{projectId:project.id,recordId:selected}} initialMessages={current?.messages} onResponse={accept} onSendingChange={setBusy}/>:draft?<>

 {reviewTab==='summary'?<CustomerAnalysisResults key={selected} url={`${url}/review`} recordId={selected} version={current?.version??0} projectId={project.id} projectName={project.name} fileName={record.fileName} busy={busy||dirty} canReview={Boolean(data?.canReview)} hasConfirmed={confirmed.some(c=>c.recordId===selected&&c.item.area==='pbom')} onBusy={setBusy} onApplied={refresh}/>:reviewTab==='pbom'?<>{bomError&&<p role="alert">{bomError}</p>}{areaItems.some(i=>!i.bom)&&<p>이전 분석은 텍스트 형식입니다. 재검증하면 BOM 구조와 필수 컬럼을 추출합니다.</p>}<PbomTable renderSource={renderSource} variant="review" rows={bomRows} editable={!busy&&Boolean(data?.canReview)} onEdit={async(id,bom)=>{setBusy(true);try{const next={...draft,items:draft.items.map(i=>i.id===id?{...i,bom}:i)};const result=await post({action:'save',recordId:selected,version:current?.version,draft:next});accept(result);setDraft(result.review?.draft??next);setDirty(false);setItemIds([]);setNotice('부품 정보가 저장되었습니다.')}finally{setBusy(false)}}}/></>:<ReviewRequirementsTable rows={areaItems.map(item=>({item}))} selected={itemIds} disabled={busy||!data?.canReview} onSelect={ids=>setItemIds(ids)} onEdit={async item=>{setBusy(true);try{const next={...draft,items:draft.items.map(currentItem=>currentItem.id===item.id?item:currentItem)};const result=await post({action:'save',recordId:selected,version:current?.version,draft:next});accept(result);setDraft(result.review?.draft??next);setDirty(false);setItemIds([]);setNotice('AI 추출사항을 저장했습니다.')}finally{setBusy(false)}}/>}
 </>:<p>AI 분석을 실행하면 문서 타입과 PBOM·AI 추출사항 초안을 확인할 수 있습니다.</p>}
 </div></section></WorkPanelFrame>}
 </>;
}
