"use client";

import { useEffect,useMemo,useRef,useState } from "react";
import { createPortal } from "react-dom";
import { Bot,Download,Eye,LoaderCircle } from "lucide-react";
import { artifactLabel,detectAiArtifactType,downloadAiArtifact,type AiArtifactType } from "./ai-artifact-download";
import { saveAiArtifactResult,type StoredAiArtifactResult } from "./ai-artifact-library";

type PendingTurn={message:string;startedAt:number};
type ArtifactTarget={element:Element;content:string;fileBase:string;type:AiArtifactType};
type ConversationIndexItem={id:string;title:string};

type ArtifactPreviewDetail={title:string;content:string;fileBase:string;type:AiArtifactType};

function safeFileBase(value:string){return `${value.trim()||"AI-PMS"}-AI요약`;}
function scrollBottom(target:Element|null,behavior:ScrollBehavior="smooth"){if(!target)return;window.requestAnimationFrame(()=>target.scrollTo({top:target.scrollHeight,behavior}));}
function currentConversationTitle(){return document.querySelector(".ai-conversation-room>header h2")?.textContent?.trim()||"AI-PMS";}
function currentConversationContext(){return document.querySelector(".ai-conversation-room>header p")?.textContent?.trim()||"개인 업무";}
function previewTitle(value:string){const line=value.split(/\r?\n/).map(item=>item.trim()).find(Boolean)||"AI 생성 결과물";return line.replace(/^슬라이드\s*제목\s*:\s*/i,"").replace(/^#+\s*/,"").slice(0,72);}
function openNativeArtifactPreview(detail:ArtifactPreviewDetail){window.dispatchEvent(new CustomEvent<ArtifactPreviewDetail>("jsolution-ai-artifact-preview",{detail}));}

export default function MyAiConversationSync(){
  const [pending,setPending]=useState<PendingTurn|null>(null);
  const [elapsed,setElapsed]=useState(0);
  const [target,setTarget]=useState<Element|null>(null);
  const [artifactTargets,setArtifactTargets]=useState<ArtifactTarget[]>([]);
  const [libraryHeaderTarget,setLibraryHeaderTarget]=useState<Element|null>(null);
  const [libraryArtifact,setLibraryArtifact]=useState<StoredAiArtifactResult|null>(null);
  const artifactSignatureRef=useRef("");

  useEffect(()=>{
    const sync=()=>{
      const next=document.querySelector(".ai-conversation-messages");
      setTarget(next);
      if(next)scrollBottom(next,"auto");
      if(next){
        const articles=Array.from(next.querySelectorAll("article"));let lastUser="";const artifacts:ArtifactTarget[]=[];
        for(const article of articles){
          if(article.classList.contains("user")){lastUser=article.querySelector("p")?.textContent?.trim()||"";continue;}
          if(!article.classList.contains("assistant"))continue;
          const type=detectAiArtifactType(lastUser);if(!type)continue;
          const content=article.querySelector("p")?.textContent?.trim()||"";const host=article.querySelector(":scope > div");
          if(content&&host){
            const item={element:host,content,fileBase:safeFileBase(currentConversationTitle()),type};artifacts.push(item);
            saveAiArtifactResult({type,content,fileBase:item.fileBase,title:currentConversationTitle(),project:currentConversationContext(),source:`AI 대화 · ${artifactLabel(type)} 생성`,conversationTitle:currentConversationTitle()});
          }
        }
        const signature=artifacts.map((item,index)=>`${index}:${item.type}:${item.content.slice(0,100)}`).join("|");
        if(signature!==artifactSignatureRef.current){artifactSignatureRef.current=signature;setArtifactTargets(artifacts);}
      }else if(artifactSignatureRef.current){artifactSignatureRef.current="";setArtifactTargets([]);}

      const libraryHeader=document.querySelector(".ai-preview-document>header");
      setLibraryHeaderTarget(libraryHeader);
      if(libraryHeader){
        const meta=libraryHeader.querySelector("p")?.textContent||"";
        const resultId=meta.match(/AI-DOC-\d+/)?.[0]||"";
        try{
          const stored=JSON.parse(window.localStorage.getItem("jsolution-ai-analysis-results")||"[]") as StoredAiArtifactResult[];
          const result=stored.find(item=>item.id===resultId&&item.artifactType&&item.artifactContent);
          setLibraryArtifact(result||null);
        }catch{setLibraryArtifact(null);}
      }else setLibraryArtifact(null);
    };
    sync();
    const observer=new MutationObserver(()=>{sync();scrollBottom(document.querySelector(".ai-conversation-messages"));});
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{if(!pending){setElapsed(0);return;}const update=()=>setElapsed(Math.max(0,Math.floor((Date.now()-pending.startedAt)/1000)));update();const timer=window.setInterval(update,1000);return()=>window.clearInterval(timer);},[pending]);

  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=typeof input==="string"?input:input instanceof URL?input.toString():input.url;
      const isConversationPost=url.includes("/api/ai/conversations")&&init?.method?.toUpperCase()==="POST";
      let payload:{id?:string;message?:string}|null=null;if(isConversationPost&&typeof init?.body==="string"){try{payload=JSON.parse(init.body) as {id?:string;message?:string}}catch{}}
      const isFollowup=Boolean(payload?.id&&payload.message?.trim());if(isFollowup){setPending({message:payload!.message!.trim(),startedAt:Date.now()});scrollBottom(document.querySelector(".ai-conversation-messages"));}
      try{const response=await originalFetch(input,init);if(isFollowup){try{const data=await response.clone().json() as {answer?:string};if(data.answer){window.setTimeout(()=>{const active=document.querySelector(".ai-conversation-browser-list .conversation-row.active .conversation-open") as HTMLButtonElement|null;active?.click();window.setTimeout(()=>scrollBottom(document.querySelector(".ai-conversation-messages")),120);},20);}}catch{}}return response;}finally{if(isFollowup)window.setTimeout(()=>setPending(null),120);}
    };
    return()=>{window.fetch=originalFetch};
  },[]);

  useEffect(()=>{
    const handleDelete=async(event:MouseEvent)=>{
      const button=(event.target as Element|null)?.closest(".conversation-room-actions .danger") as HTMLButtonElement|null;if(!button)return;
      const title=currentConversationTitle();
      try{const response=await fetch("/api/ai/conversations",{cache:"no-store"});if(!response.ok)return;const data=await response.json() as {conversations?:ConversationIndexItem[]};const activeRow=document.querySelector(".ai-conversation-browser-list .conversation-row.active .conversation-open");const activeRowTitle=activeRow?.querySelector("strong")?.textContent?.trim()||title;const conversation=(data.conversations||[]).find(item=>item.title===activeRowTitle)||(data.conversations||[]).find(item=>item.title===title);if(!conversation)return;await fetch("/api/ai/conversations/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:conversation.id})});}catch{}
    };
    document.addEventListener("click",handleDelete,true);return()=>document.removeEventListener("click",handleDelete,true);
  },[]);

  const openPreview=(item:ArtifactTarget)=>openNativeArtifactPreview({title:previewTitle(item.content),content:item.content,fileBase:item.fileBase,type:item.type});
  const openLibraryPreview=()=>{if(libraryArtifact)openNativeArtifactPreview({title:libraryArtifact.title.replace(/\s*·\s*(PPTX|DOCX|XLSX|PDF|IMAGE)$/i,""),content:libraryArtifact.artifactContent,fileBase:libraryArtifact.fileBase,type:libraryArtifact.artifactType});};
  const pendingMessage=useMemo(()=>elapsed>=10?"문서와 이전 대화를 함께 분석하고 있습니다…":elapsed>=4?"관련 문맥을 검토하고 답변을 작성하고 있습니다…":"AI가 답변을 준비하고 있습니다…",[elapsed]);

  return <>
    {pending&&target&&createPortal(<><article className="user ai-optimistic-user"><span><div className="avatar">DK</div></span><div><b>Dean Kim</b><p>{pending.message}</p></div></article><article className="assistant ai-response-pending" role="status" aria-live="polite"><span><Bot size={17}/></span><div><b>J SOLUTION AI</b><p><LoaderCircle size={15}/><span>{pendingMessage}</span><small>{elapsed>0?`${elapsed}초`:""}</small></p></div></article></>,target,"pending-turn")}
    {artifactTargets.map((item,index)=>createPortal(<div className="ai-conversation-artifact-actions"><button className="ai-conversation-preview" type="button" onClick={()=>openPreview(item)}><Eye size={13}/>{artifactLabel(item.type)} 미리보기</button><button className="ai-conversation-download" type="button" onClick={()=>downloadAiArtifact(item.type,item.content,item.fileBase)}><Download size={13}/>{artifactLabel(item.type)} 다운로드</button></div>,item.element,`artifact-${index}-${item.type}-${item.content.slice(0,18)}`))}
    {libraryHeaderTarget&&libraryArtifact&&createPortal(<div className="ai-library-artifact-actions"><button type="button" onClick={openLibraryPreview}><Eye size={14}/> 미리보기</button><button type="button" className="download" onClick={()=>downloadAiArtifact(libraryArtifact.artifactType,libraryArtifact.artifactContent,libraryArtifact.fileBase)}><Download size={14}/> 다운로드</button></div>,libraryHeaderTarget,"library-artifact-actions")}
  </>;
}
