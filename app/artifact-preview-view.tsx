"use client";

import { useMemo,useState } from "react";
import { ChevronLeft,ChevronRight,Download } from "lucide-react";
import { artifactLabel,artifactRows,downloadAiArtifact,type AiArtifactType } from "./ai-artifact-download";

export type ArtifactPreviewData={
  type:AiArtifactType;
  title:string;
  content:string;
  fileBase:string;
};

function splitPages(content:string,type:AiArtifactType){
  if(type==="xlsx"||type==="image")return [content];
  if(type==="pptx"){
    const slideParts=content.split(/(?=슬라이드\s*\d+\s*[:.-]?)/i).map(item=>item.trim()).filter(Boolean);
    if(slideParts.length>1)return slideParts;
  }
  const paragraphs=content.split(/\n{2,}/).map(item=>item.trim()).filter(Boolean);
  const pages:string[]=[];
  let current="";
  for(const paragraph of paragraphs.length?paragraphs:[content]){
    if(current&&`${current}\n\n${paragraph}`.length>1500){pages.push(current);current=paragraph;}
    else current=current?`${current}\n\n${paragraph}`:paragraph;
  }
  if(current)pages.push(current);
  return pages.length?pages:[content];
}

export default function ArtifactPreviewView({data}:{data:ArtifactPreviewData}){
  const pages=useMemo(()=>splitPages(data.content,data.type),[data]);
  const [page,setPage]=useState(0);
  const current=Math.min(page,Math.max(0,pages.length-1));
  return <div className={`content ai-native-artifact-preview type-${data.type}`}>
    <section className="panel ai-artifact-workspace">
      <header className="ai-artifact-preview-head">
        <div><span>AI GENERATED {artifactLabel(data.type)}</span><strong>{data.title}</strong><small>정식 Workspace 탭에서 전체 내용을 확인합니다.</small></div>
        <div><button onClick={()=>downloadAiArtifact(data.type,data.content,data.fileBase)}><Download size={15}/> 다운로드</button></div>
      </header>
      <div className="ai-artifact-preview-toolbar">
        <button disabled={current<=0} onClick={()=>setPage(value=>Math.max(0,value-1))}><ChevronLeft size={15}/> 이전</button>
        <strong>{current+1} / {Math.max(1,pages.length)}</strong>
        <button disabled={current>=pages.length-1} onClick={()=>setPage(value=>Math.min(pages.length-1,value+1))}>다음 <ChevronRight size={15}/></button>
      </div>
      <div className="ai-artifact-preview-stage">
        {data.type==="xlsx"?<div className="ai-artifact-sheet"><table><tbody>{artifactRows(data.content).map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,colIndex)=><td key={colIndex}>{cell}</td>)}</tr>)}</tbody></table></div>:
        data.type==="image"?<div className="ai-artifact-image-page"><div className="ai-artifact-image-card"><span>J SOLUTION AI</span><h1>{data.title}</h1><p>{data.content}</p></div></div>:
        <article className={`ai-artifact-page ${data.type==="pptx"?"slide":"document"}`}><h1>{data.title}</h1><div className="ai-artifact-rule"/><div className="ai-artifact-copy">{pages[current]||data.content}</div><footer>J SOLUTION AI PMS · AI 생성 자료</footer></article>}
      </div>
    </section>
  </div>;
}
