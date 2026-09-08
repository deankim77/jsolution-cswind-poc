"use client";

/* eslint-disable @next/next/no-img-element */
import {useEffect,useState,type CSSProperties,type RefObject} from "react";
import {ChevronDown,Download,ExternalLink,FileText,Maximize2,Minus,RefreshCw,Upload,ZoomIn} from "lucide-react";

export type DocumentPreviewDeliverable={
  id:string;
  projectId:string;
  name:string;
  documentKind?:"document"|"drawing";
  drawingCode?:string;
  workflowNumber?:string;
  approvedAt?:number;
  finalApprover?:string;
};

export type DocumentPreviewVersion={
  id:string;
  deliverableId:string;
  revision:number;
  fileName:string;
  fileSize:number;
  contentType?:string;
  previewFileKey?:string;
  conversionStatus?:string;
  conversionError?:string;
};

export type DocumentPreviewTab={
  id:string;
  projectId:string;
  deliverableId:string;
  title:string;
  versionId:string;
};

type Props={
  projectId:string;
  tab:DocumentPreviewTab;
  item?:DocumentPreviewDeliverable;
  versions:DocumentPreviewVersion[];
  onVersion:(id:string)=>void;
  onRegisterRevision:(item:DocumentPreviewDeliverable)=>void;
  viewerRef:RefObject<HTMLDivElement|null>;
};

const bytes=(value:number)=>value>=1024*1024?`${(value/1024/1024).toFixed(1)} MB`:value>=1024?`${Math.round(value/1024)} KB`:`${value||0} B`;
const isDrawing=(item?:DocumentPreviewDeliverable)=>item?.documentKind==="drawing";

export default function DocumentPreviewRenderer({projectId,tab,item,versions,onVersion,onRegisterRevision,viewerRef}:Props){
  const version=versions.find(candidate=>candidate.id===tab.versionId)??versions[0];
  const [text,setText]=useState("");
  const [error,setError]=useState<{message:string;downloadAvailable:boolean}|null>(null);
  const [loading,setLoading]=useState(true);
  const [zoom,setZoom]=useState(100);
  const [fit,setFit]=useState(true);
  const [reloadKey,setReloadKey]=useState(0);
  const [conversionStatus,setConversionStatus]=useState(version?.conversionStatus||"");
  const [conversionError,setConversionError]=useState(version?.conversionError||"");
  const [conversionSaving,setConversionSaving]=useState(false);

  useEffect(()=>{
    setConversionStatus(version?.conversionStatus||"");
    setConversionError(version?.conversionError||"");
  },[version?.id,version?.conversionStatus,version?.conversionError]);

  const url=version?`/api/projects/${projectId}/deliverables?versionId=${encodeURIComponent(version.id)}&preview=1`:"";
  const lower=version?.fileName.toLowerCase()||"";
  const kind=version?.contentType?.startsWith("image/")||/\.(png|jpe?g|gif|webp|svg)$/i.test(lower)
    ?"image"
    :version?.contentType==="application/pdf"||lower.endsWith(".pdf")
      ?"pdf"
      :lower.endsWith(".dwg")
        ?"dwg"
        :/\.(docx|pptx|xlsx|txt|csv|json|xml|md)$/i.test(lower)||version?.contentType?.startsWith("text/")
          ?"text"
          :"unsupported";

  useEffect(()=>{
    setText("");
    setError(null);
    setZoom(100);
    setFit(true);
    if(!version){setLoading(false);return}
    if(kind!=="text"){setLoading(false);return}
    setLoading(true);
    fetch(url,{cache:"no-store"})
      .then(async response=>{
        const data=await response.json().catch(()=>null) as {text?:string;error?:string;downloadAvailable?:boolean}|null;
        if(!response.ok)throw {message:data?.error||"문서 미리보기를 불러오지 못했습니다.",downloadAvailable:Boolean(data?.downloadAvailable)};
        setText(data?.text||"");
      })
      .catch(reason=>setError({
        message:typeof reason?.message==="string"?reason.message:"문서 미리보기를 불러오지 못했습니다.",
        downloadAvailable:Boolean(reason?.downloadAvailable),
      }))
      .finally(()=>setLoading(false));
  },[version?.id,reloadKey]);

  const download=version?`/api/projects/${projectId}/deliverables?versionId=${encodeURIComponent(version.id)}`:"";
  const retryConversion=async()=>{
    if(!version)return;
    setConversionSaving(true);
    setConversionError("");
    try{
      const response=await fetch(`/api/projects/${projectId}/deliverables`,{
        method:"PATCH",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"retry-conversion",versionId:version.id}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"DWG 변환에 실패했습니다.");
      setConversionStatus(result.status||"converted");
      if(result.error)setConversionError(result.error);
      setReloadKey(value=>value+1);
    }catch(reason){
      setConversionStatus("failed");
      setConversionError(reason instanceof Error?reason.message:"DWG 변환에 실패했습니다.");
    }finally{
      setConversionSaving(false);
    }
  };

  const textStyle={"--v2-preview-text-size":`${Math.max(12,Math.round(zoom*0.14))}px`} as CSSProperties;
  const approvalMeta=item?.workflowNumber?`승인 완료 · ${item.workflowNumber} · ${item.finalApprover||"최종 승인자"}${item.approvedAt?` · ${new Date(Number(item.approvedAt)*1000).toLocaleDateString("ko-KR")}`:""}`:"";

  return <div className="wv2-document-preview" ref={viewerRef}>
    <header>
      <div><span><b>{item?.drawingCode?`${item.drawingCode} · ${item.name}`:item?.name||tab.title}</b><small>{version?.fileName||"Revision 없음"}{version?` · ${bytes(version.fileSize)}`:""}</small>{approvalMeta&&<em>{approvalMeta}</em>}</span></div>
      <div className="wv2-preview-actions">
        <label>Revision <select value={version?.id||""} onChange={event=>onVersion(event.target.value)}>{versions.map(candidate=><option key={candidate.id} value={candidate.id}>Rev.{String(candidate.revision).padStart(2,"0")} · {candidate.fileName}</option>)}</select><ChevronDown size={18}/></label>
        <button title="축소" onClick={()=>{setFit(false);setZoom(value=>Math.max(50,(fit?100:value)-10))}}><Minus size={18}/></button>
        <button className="wv2-preview-zoom-label" title="화면 맞춤" onClick={()=>{setFit(true);setZoom(100)}}>{fit?"맞춤":`${zoom}%`}</button>
        <button title="확대" onClick={()=>{setFit(false);setZoom(value=>Math.min(200,(fit?100:value)+10))}}><ZoomIn size={18}/></button>
        <button title="전체 화면" onClick={()=>viewerRef.current?.requestFullscreen()}><Maximize2 size={18}/></button>
        {item&&<button onClick={()=>onRegisterRevision(item)}><Upload size={18}/>{isDrawing(item)?"새 Rev 등록":"Revision 등록"}</button>}
        <a href={download} download><Download size={18}/>다운로드</a>
      </div>
    </header>
    <main>
      {loading?<div className="wv2-preview-empty"><RefreshCw className="wv2-spin" size={24}/><b>문서를 변환하는 중…</b></div>
      :error?<div className="wv2-preview-empty wv2-preview-error"><FileText size={24}/><b>{error.message}</b><span>{error.downloadAvailable?"원본 파일은 정상이며 다운로드하여 확인할 수 있습니다.":"파일 등록 상태를 확인한 뒤 다시 시도해 주세요."}</span><div><button onClick={()=>setReloadKey(value=>value+1)}><RefreshCw size={18}/>다시 시도</button>{error.downloadAvailable&&<a href={download} download><Download size={18}/>원본 다운로드</a>}</div></div>
      :kind==="image"?<div className={`wv2-image-preview ${fit?"fit":"zoomed"}`}><img src={url} alt={version?.fileName} style={fit?undefined:{width:`${zoom}%`}}/></div>
      :kind==="pdf"?<iframe src={url} title={version?.fileName}/>
      :kind==="text"?<pre style={textStyle}>{text}</pre>
      :kind==="dwg"?(conversionStatus==="converted"?<iframe src={`${url}&reload=${reloadKey}`} title={`${version?.fileName} PDF 변환 미리보기`}/>:<div className="wv2-preview-empty"><RefreshCw size={26}/><b>{conversionStatus==="converting"?"DWG를 PDF로 변환하는 중입니다.":conversionStatus==="unconfigured"?"DWG 변환 서버 연결이 필요합니다.":conversionStatus==="failed"?"DWG 변환에 실패했습니다.":"DWG PDF 미리보기를 준비 중입니다."}</b><span>{conversionError||"원본 DWG는 정상 보관되며 변환 후 브라우저 미리보기가 제공됩니다."}</span><div><button disabled={conversionSaving} onClick={retryConversion}><RefreshCw size={18}/>{conversionSaving?"변환 요청 중…":"변환 다시 시도"}</button><a href={download} download><Download size={18}/>원본 다운로드</a></div></div>)
      :<div className="wv2-preview-empty"><ExternalLink size={26}/><b>이 형식은 브라우저 내 미리보기를 지원하지 않습니다.</b><span>다운로드하여 원본 프로그램에서 확인해 주세요.</span><a href={download}>파일 열기</a></div>}
    </main>
  </div>;
}
