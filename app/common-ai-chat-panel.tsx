"use client";

import { useEffect,useMemo,useRef,useState } from "react";
import { Bot,Download,Eye,Send } from "lucide-react";
import AiContextSelectionBlock,{type SharedAiContextItem} from "./ai-context-selection-block";
import { artifactLabel,detectAiArtifactType,downloadAiArtifact,type AiArtifactType } from "./ai-artifact-download";
import { saveAiArtifactResult } from "./ai-artifact-library";

export type CommonAiContextItem=SharedAiContextItem;
type ChatMessage={id:string;role:"user"|"assistant";content:string;artifactType?:AiArtifactType};
type ConversationUpdatedDetail={id:string;title:string;context:string;source:string;contextItems:CommonAiContextItem[]};

type Props={
  items:CommonAiContextItem[];
  projectName:string;
  source:string;
  contextType?:string;
  contextTitle?:string;
  onRemove?:(item:CommonAiContextItem)=>void;
  onClear?:()=>void;
  emptyLabel?:string;
};

function safeFileBase(value:string){return `${(value||"AI-PMS").trim()}-AI결과`;}

export default function CommonAiChatPanel({items,projectName,source,contextType="mixed",contextTitle,onRemove,onClear,emptyLabel="분석할 업무 문맥을 선택해 주세요."}:Props){
  const [conversationId,setConversationId]=useState("");
  const [conversationTitle,setConversationTitle]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [query,setQuery]=useState("");
  const [sending,setSending]=useState(false);
  const sendingRef=useRef(false);
  const resolvedContextTitle=contextTitle||`${projectName} · 선택 문맥 ${items.length}건`;
  const signature=useMemo(()=>items.map(item=>`${item.kind}:${item.id}:${item.title}`).join("|"),[items]);
  const signatureRef=useRef(signature);
  useEffect(()=>{
    if(signatureRef.current===signature)return;
    signatureRef.current=signature;
    setConversationId("");setConversationTitle("");setMessages([]);setQuery("");
  },[signature]);

  const rememberArtifact=(type:AiArtifactType,answer:string,id:string,title:string)=>{
    saveAiArtifactResult({type,content:answer,fileBase:safeFileBase(contextTitle||title),title:contextTitle||title,project:projectName,source:`${source} AI 대화 · ${artifactLabel(type)} 생성`,conversationId:id,conversationTitle:title});
  };
  const openPreview=(type:AiArtifactType,answer:string)=>{
    rememberArtifact(type,answer,conversationId,conversationTitle);
    window.dispatchEvent(new CustomEvent("jsolution-ai-artifact-preview",{detail:{type,content:answer,fileBase:safeFileBase(contextTitle||conversationTitle),title:contextTitle||conversationTitle||"AI 생성 결과물"}}));
  };
  const emitConversation=(detail:ConversationUpdatedDetail)=>window.dispatchEvent(new CustomEvent<ConversationUpdatedDetail>("jsolution-ai-conversation-updated",{detail}));

  const send=async()=>{
    const message=query.trim();
    if(!message||sendingRef.current||!items.length)return;
    sendingRef.current=true;setSending(true);setQuery("");
    const now=Date.now();
    setMessages(current=>[...current,{id:`user-${now}`,role:"user",content:message}]);
    try{
      const response=await fetch("/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({conversationId:conversationId||undefined,projectName,source,contextType,contextTitle:resolvedContextTitle,contextItems:items,message})});
      const data=await response.json() as {conversationId?:string;answer?:string;error?:string;saved?:boolean;duplicate?:boolean};
      const nextId=data.conversationId||conversationId;
      const nextTitle=conversationTitle||message;
      if(nextId){setConversationId(nextId);if(!conversationTitle)setConversationTitle(nextTitle);}
      if(data.duplicate)return;
      const answer=response.ok?(data.answer||"응답 내용이 없습니다."):(data.answer?`${data.answer}\n\nAI 연결 오류: ${data.error||"응답을 받지 못했습니다."}`:`AI 연결 오류: ${data.error||"응답을 받지 못했습니다."}`);
      const artifactType=response.ok?detectAiArtifactType(message)||undefined:undefined;
      setMessages(current=>[...current,{id:`assistant-${Date.now()}`,role:"assistant",content:answer,artifactType}]);
      if(nextId){
        emitConversation({id:nextId,title:nextTitle,context:resolvedContextTitle,source,contextItems:items});
        if(artifactType&&data.answer)rememberArtifact(artifactType,data.answer,nextId,nextTitle);
      }
    }catch(error){
      setMessages(current=>[...current,{id:`error-${Date.now()}`,role:"assistant",content:`AI 연결 오류: ${error instanceof Error?error.message:"응답을 받지 못했습니다."}`}]);
    }finally{sendingRef.current=false;setSending(false);}
  };

  return <section className="common-ai-chat-panel">
    {items.length>0?<AiContextSelectionBlock items={items} onRemove={onRemove||(()=>{})} onClear={onClear||(()=>{})}/>:<div className="common-ai-chat-empty-context">{emptyLabel}</div>}
    <div className="common-ai-chat-thread">
      {messages.length===0&&items.length>0&&<div className="common-ai-chat-empty"><Bot size={16}/><span>선택한 문맥을 기준으로 이 자리에서 바로 대화할 수 있습니다.</span></div>}
      {messages.map(message=><div key={message.id} className={`common-ai-chat-message ${message.role}`}><span>{message.role==="assistant"?"AI":"나"}</span><div><p>{message.content}</p>{message.role==="assistant"&&message.artifactType?<div className="common-ai-artifact"><strong>{artifactLabel(message.artifactType)} 결과물</strong><small>AI 라이브러리에 자동 저장됨</small><div><button type="button" onClick={()=>openPreview(message.artifactType!,message.content)}><Eye size={13}/> 미리보기</button><button type="button" className="download" onClick={()=>downloadAiArtifact(message.artifactType!,message.content,safeFileBase(contextTitle||conversationTitle))}><Download size={13}/> 다운로드</button></div></div>:null}</div></div>)}
      {sending&&<div className="common-ai-chat-message assistant loading"><span>AI</span><div><p>답변을 생성하고 있습니다…</p></div></div>}
    </div>
    <div className="common-ai-chat-input"><input value={query} disabled={sending||!items.length} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.repeat){e.preventDefault();void send();}}} placeholder="선택한 문맥을 기준으로 질문하세요"/><button type="button" disabled={!query.trim()||sending||!items.length} onClick={()=>void send()}><Send size={16}/></button></div>
    {conversationId&&<small className="common-ai-chat-saved">AI 대화에 자동 저장됨</small>}
  </section>;
}
