"use client";

import {useEffect,useMemo,useState} from "react";
import {ArrowLeft,Clock3,Download,Eye,FileText,Link2,Sparkles,Upload,Workflow} from "lucide-react";
import "./document-detail-workspace-v2.css";

type Deliverable={id:string;projectId:string;projectCode:string;projectName:string;taskId?:string;taskCode?:string;taskName?:string;name:string;type?:string;required?:boolean|number;status:string;version?:string;source:string;revisionCount:number;documentKind?:"document"|"drawing";drawingCode?:string;drawingType?:string;internalDrawingNumber?:string;customerDrawingNumber?:string;ownerDepartment?:string;workflowNumber?:string;workflowTitle?:string;approvedAt?:number;finalApprover?:string};
type DeliverableVersion={id:string;deliverableId:string;taskId?:string;revision:number;fileName:string;fileSize:number;contentType?:string;note?:string;createdAt:number;createdBy?:string};
type DetailResponse={deliverable?:Deliverable;versions?:DeliverableVersion[];error?:string};

const bytes=(value:number)=>value>=1024*1024?`${(value/1024/1024).toFixed(1)} MB`:value>=1024?`${Math.round(value/1024)} KB`:`${value||0} B`;
const dateTime=(value?:number)=>value?new Date(value*1000).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";
const statusLabel=(status:string)=>status==="planned"?"등록 예정":status==="approved"?"승인":status==="rejected"?"반려":status==="submitted"?"등록 완료":"등록 완료";
const sourceLabel=(item:Deliverable)=>item.documentKind==="drawing"?"도면":item.source==="planned"?"계획 산출물":item.source==="ai"?"AI 문서":"추가 산출물";

export default function DocumentDetailWorkspaceV2({deliverableId,onBack,onPreview,onOpenTask,onRegisterRevision}:{deliverableId:string;onBack:()=>void;onPreview:(deliverableId:string,versionId:string)=>void;onOpenTask:(projectId:string,taskId:string)=>void;onRegisterRevision:(item:Deliverable)=>void}){
  const [item,setItem]=useState<Deliverable|null>(null),[versions,setVersions]=useState<DeliverableVersion[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [selectedVersionId,setSelectedVersionId]=useState(""),[aiMessage,setAiMessage]=useState(""),[aiAnswer,setAiAnswer]=useState(""),[aiError,setAiError]=useState(""),[aiLoading,setAiLoading]=useState(false);

  useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");fetch(`/api/deliverables?deliverableId=${encodeURIComponent(deliverableId)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json() as DetailResponse;if(!response.ok)throw new Error(data.error||"문서 정보를 불러오지 못했습니다.");const history=data.versions??[];setItem(data.deliverable??null);setVersions(history);setSelectedVersionId(history[0]?.id||"")}).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError"))setError(reason instanceof Error?reason.message:"문서 정보를 불러오지 못했습니다.")}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[deliverableId]);

  const ordered=useMemo(()=>[...versions].sort((a,b)=>b.revision-a.revision),[versions]);
  const latest=ordered[0],selected=ordered.find(version=>version.id===selectedVersionId)||latest;
  const downloadUrl=item&&selected?`/api/projects/${item.projectId}/deliverables?versionId=${encodeURIComponent(selected.id)}`:"";

  const askAi=async(prompt?:string)=>{if(!item||!selected||aiLoading)return;const message=(prompt||aiMessage).trim();if(!message)return;setAiLoading(true);setAiError("");setAiAnswer("");try{const response=await fetch("/api/ai/document-revision",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId:item.projectId,deliverableId:item.id,versionId:selected.id,message})});const data=await response.json() as {answer?:string;error?:string};if(!response.ok)throw new Error(data.error||"AI 분석을 요청하지 못했습니다.");setAiAnswer(data.answer||"분석 결과가 없습니다.")}catch(reason){setAiError(reason instanceof Error?reason.message:"AI 분석을 요청하지 못했습니다.")}finally{setAiLoading(false)}};

  if(loading)return <section className="wv2-document-detail-page"><div className="wv2-document-detail-empty"><Clock3 size={28}/><b>문서 정보를 불러오는 중…</b></div></section>;
  if(error||!item)return <section className="wv2-document-detail-page"><button className="wv2-doc-back" onClick={onBack}><ArrowLeft size={16}/> 문서 · 산출물</button><div className="wv2-document-detail-empty"><FileText size={28}/><b>{error||"문서를 찾을 수 없습니다."}</b></div></section>;

  return <section className="wv2-document-detail-page">
    <header className="wv2-document-detail-head">
      <div><button className="wv2-doc-back" onClick={onBack}><ArrowLeft size={16}/> 문서 · 산출물</button><small>DOCUMENT DETAIL</small><h1>{item.name}</h1><p>{item.type||"기타 > 일반문서"} · {latest?`현재 Rev.${String(latest.revision).padStart(2,"0")}`:"등록 파일 없음"} · {statusLabel(item.status)}</p></div>
      <div className="wv2-document-detail-actions">{latest&&<button onClick={()=>onPreview(item.id,latest.id)}><Eye size={16}/> 미리보기</button>}<button onClick={()=>onRegisterRevision(item)}><Upload size={16}/> 새 Revision</button>{item.taskId&&<button className="primary" onClick={()=>onOpenTask(item.projectId,item.taskId!)}><Workflow size={16}/> WBS 연동</button>}</div>
    </header>

    <div className="wv2-document-detail-grid">
      <main>
        <section className="wv2-document-card">
          <header><div><small>DOCUMENT INFORMATION</small><h3>문서 기본정보</h3></div><span>{sourceLabel(item)}{Boolean(item.required)&&item.documentKind!=="drawing"?" · 필수":""}</span></header>
          <dl>
            <dt>문서명</dt><dd>{item.name}</dd><dt>문서 분류</dt><dd>{item.type||"기타 > 일반문서"}</dd>
            {item.documentKind==="drawing"&&<><dt>도면 코드</dt><dd>{item.drawingCode||"—"}</dd><dt>도면 유형</dt><dd>{item.drawingType||"—"}</dd><dt>내부 도번</dt><dd>{item.internalDrawingNumber||"—"}</dd><dt>고객 도번</dt><dd>{item.customerDrawingNumber||"—"}</dd></>}
            <dt>현재 Revision</dt><dd>{latest?`Rev.${String(latest.revision).padStart(2,"0")}`:"—"}</dd><dt>전체 Revision</dt><dd>{ordered.length}건</dd>
            <dt>최근 개정일</dt><dd>{dateTime(latest?.createdAt)}</dd><dt>최근 등록자</dt><dd>{latest?.createdBy||"—"}</dd>
            <dt>프로젝트</dt><dd>{item.projectCode} · {item.projectName}</dd><dt>연결 WBS</dt><dd>{item.taskId?<button className="wv2-doc-link" onClick={()=>onOpenTask(item.projectId,item.taskId!)}><Link2 size={14}/>{item.taskCode} {item.taskName}</button>:"프로젝트 공통"}</dd>
            {item.ownerDepartment&&<><dt>담당 부서</dt><dd>{item.ownerDepartment}</dd></>}{item.workflowNumber&&<><dt>승인 Workflow</dt><dd>{item.workflowNumber} · {item.workflowTitle||""}</dd><dt>최종 승인자</dt><dd>{item.finalApprover||"—"}</dd></>}
          </dl>
        </section>

        <section className="wv2-document-card revisions"><header><div><small>REVISION HISTORY</small><h3>버전 · 개정 이력</h3></div><span>{ordered.length}개 Revision</span></header><div className="wv2-document-revision-list">{ordered.length?ordered.map((version,index)=><button key={version.id} className={selected?.id===version.id?"active":""} onClick={()=>{setSelectedVersionId(version.id);setAiAnswer("");setAiError("")}}><span className="rev"><b>Rev.{String(version.revision).padStart(2,"0")}</b>{index===0&&<em>현재</em>}</span><span className="file"><b>{version.fileName}</b><small>{version.note||"변경 메모 없음"}</small></span><span className="who"><small>{dateTime(version.createdAt)}</small><b>{version.createdBy||"—"}</b></span><span className="size">{bytes(version.fileSize)}</span></button>):<div className="wv2-document-detail-empty"><FileText size={24}/><b>등록된 Revision이 없습니다.</b></div>}</div></section>
      </main>

      <aside>
        <section className="wv2-document-card selected"><header><div><small>SELECTED REVISION</small><h3>{selected?`Rev.${String(selected.revision).padStart(2,"0")}`:"Revision 없음"}</h3></div></header>{selected&&<><dl><dt>파일명</dt><dd>{selected.fileName}</dd><dt>파일 크기</dt><dd>{bytes(selected.fileSize)}</dd><dt>등록자</dt><dd>{selected.createdBy||"—"}</dd><dt>등록일</dt><dd>{dateTime(selected.createdAt)}</dd><dt>변경 메모</dt><dd>{selected.note||"변경 메모 없음"}</dd></dl><div className="wv2-document-selected-actions"><button onClick={()=>onPreview(item.id,selected.id)}><Eye size={15}/> 미리보기</button><a href={downloadUrl} download><Download size={15}/> 다운로드</a></div></>}
        </section>

        <section className="wv2-document-card ai"><header><div><small>REVISION AI</small><h3><Sparkles size={17}/> 선택 버전 AI 분석</h3></div></header><p>{selected?`Rev.${String(selected.revision).padStart(2,"0")} 원본 파일을 기준으로 분석합니다.`:"분석할 Revision을 선택해 주세요."}</p><div className="wv2-document-ai-quick"><button disabled={!selected||aiLoading} onClick={()=>askAi("이 Revision의 핵심 내용을 실무자가 빠르게 파악할 수 있도록 요약해줘")}>핵심 요약</button><button disabled={!selected||aiLoading} onClick={()=>askAi("이 Revision에서 검토가 필요한 사항, 누락 가능성, 위험 요소를 정리해줘")}>검토 포인트</button><button disabled={!selected||aiLoading} onClick={()=>askAi("이 Revision의 내용을 프로젝트 보고서에 사용할 수 있는 문장으로 정리해줘")}>보고용 정리</button></div><textarea rows={4} value={aiMessage} onChange={event=>setAiMessage(event.target.value)} placeholder="선택한 Revision에 대해 질문하세요" disabled={!selected||aiLoading}/><button className="wv2-document-ai-send" disabled={!selected||!aiMessage.trim()||aiLoading} onClick={()=>askAi()}>{aiLoading?<><Clock3 size={15}/> 분석 중…</>:<><Sparkles size={15}/> AI 요청</>}</button>{aiError&&<p className="error">{aiError}</p>}{aiAnswer&&<div className="answer"><b>AI 분석 결과</b><p>{aiAnswer}</p></div>}</section>
      </aside>
    </div>
  </section>;
}
