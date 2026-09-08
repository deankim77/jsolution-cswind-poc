"use client";

import { useEffect,useMemo,useState } from "react";
import { Download,FileText,LoaderCircle } from "lucide-react";

export type DocumentPreviewData={
  projectId:string;
  versionId:string;
  title:string;
  fileName:string;
  contentType?:string;
  revision?:number;
};

type PreviewState=
  | {kind:"loading"}
  | {kind:"text";text:string;contentType:string}
  | {kind:"blob";url:string;contentType:string}
  | {kind:"error";message:string};

export default function DocumentFilePreviewView({data}:{data:DocumentPreviewData}){
  const [state,setState]=useState<PreviewState>({kind:"loading"});
  const fileUrl=useMemo(()=>`/api/projects/${encodeURIComponent(data.projectId)}/deliverables?versionId=${encodeURIComponent(data.versionId)}`,[data.projectId,data.versionId]);

  useEffect(()=>{
    let disposed=false;
    let objectUrl="";
    setState({kind:"loading"});
    fetch(`${fileUrl}&preview=1`,{cache:"no-store"}).then(async response=>{
      if(!response.ok){
        let message="파일 미리보기를 불러오지 못했습니다.";
        try{const payload=await response.json() as {error?:string};if(payload.error)message=payload.error;}catch{}
        throw new Error(message);
      }
      const contentType=response.headers.get("content-type")||data.contentType||"application/octet-stream";
      if(contentType.includes("application/json")){
        const payload=await response.json() as {text?:string;contentType?:string;error?:string};
        if(payload.error)throw new Error(payload.error);
        if(!disposed)setState({kind:"text",text:payload.text||"미리볼 텍스트가 없습니다.",contentType:payload.contentType||contentType});
        return;
      }
      const blob=await response.blob();
      objectUrl=URL.createObjectURL(blob);
      if(!disposed)setState({kind:"blob",url:objectUrl,contentType:blob.type||contentType});
    }).catch(error=>{if(!disposed)setState({kind:"error",message:error instanceof Error?error.message:"파일 미리보기를 불러오지 못했습니다."});});
    return()=>{disposed=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[data.contentType,fileUrl]);

  return <div className="content document-native-preview-content">
    <section className="panel document-native-preview-workspace">
      <header className="document-native-preview-head">
        <div><span>DOCUMENT PREVIEW</span><strong>{data.title}</strong><small>{data.fileName}{data.revision?` · Revision ${data.revision}`:""}</small></div>
        <a href={fileUrl}><Download size={16}/> 원본 다운로드</a>
      </header>
      <div className="document-native-preview-stage">
        {state.kind==="loading"?<div className="document-native-preview-empty"><LoaderCircle size={28}/><strong>문서를 불러오는 중입니다.</strong></div>:
        state.kind==="error"?<div className="document-native-preview-empty"><FileText size={30}/><strong>{state.message}</strong><p>원본 다운로드로 파일을 확인할 수 있습니다.</p></div>:
        state.kind==="text"?<article className="document-native-preview-paper"><h1>{data.title}</h1><div className="document-native-preview-rule"/><pre>{state.text}</pre><footer>J SOLUTION AI PMS · 등록 문서 미리보기</footer></article>:
        state.contentType.startsWith("image/")?<div className="document-native-image-preview"><img src={state.url} alt={data.title}/></div>:
        state.contentType.includes("pdf")?<iframe className="document-native-pdf-preview" src={state.url} title={`${data.title} 미리보기`}/>:
        <div className="document-native-preview-empty"><FileText size={30}/><strong>이 파일 형식은 브라우저 직접 미리보기를 지원하지 않습니다.</strong><p>{data.fileName}</p></div>}
      </div>
    </section>
  </div>;
}
