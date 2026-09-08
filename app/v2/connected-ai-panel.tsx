"use client";

import {useEffect,useMemo,useRef,useState} from "react";
/* eslint-disable react-hooks/exhaustive-deps */
import {ChevronRight,Download,Eye,FileText,Link2,MessageSquareText,Plus,Search,Send,Sparkles,Trash2} from "lucide-react";
import {artifactLabel,detectAiArtifactType,downloadAiArtifact,type AiArtifactType} from "../ai-artifact-download";
import {saveAiArtifactResult} from "../ai-artifact-library";
import type {AiDraftRequest,ContextItem} from "./connected-ai-workspaces-impl";
import "./connected-ai-panel.css";

type ChatMessage={id?:string;role:"user"|"assistant";content:string;createdAt?:number;artifactType?:AiArtifactType};
type Conversation={id:string;title:string;source:string;contextType:string;contextTitle:string;contextItems:ContextItem[];groupName?:string;updatedAt:number};
type SearchResult={id:string;kind:"project"|"task"|"document"|"issue";projectId:string;taskId?:string;eyebrow:string;title:string;meta:string};
type Project={id:string;code:string;name:string};
type Task={id:string;wbsCode:string;name:string;progress:number;status:string;deliverables:Array<{id?:string;name:string}>};
type PanelMode="chat"|"recent";
type RichContextItem=ContextItem&{displayMeta?:string;projectName?:string;taskName?:string};

const contextKind=(kind:SearchResult["kind"])=>kind==="project"?"프로젝트":kind==="task"?"WBS":kind==="document"?"문서":"이슈";
const contextKey=(item:ContextItem)=>`${item.kind||"context"}:${item.id||item.title||""}`;
const contextMeta=(item:ContextItem)=>{const rich=item as RichContextItem;return rich.displayMeta||item.meta||[rich.projectName,rich.taskName].filter(Boolean).join(" · ")};
const statusLabel=(status:string)=>status==="completed"?"완료":status==="review"?"완료 검토":status==="active"?"진행 중":status==="hold"?"보류":"예정";
const safeFileBase=(value:string)=>`${(value||"AI-PMS").trim()}-AI결과`;
const withArtifactTypes=(items:ChatMessage[])=>items.map((item,index)=>item.role==="assistant"?{...item,artifactType:item.artifactType||detectAiArtifactType(items[index-1]?.content||"")||undefined}:item);

function ArtifactResultCard({type,content,title}:{type:AiArtifactType;content:string;title:string}){
  const fileBase=safeFileBase(title);
  const preview=()=>window.dispatchEvent(new CustomEvent("jsolution-ai-artifact-preview",{detail:{type,content,fileBase,title:title||"AI 생성 결과물"}}));
  return <div className="wv2-ai-artifact"><strong>{artifactLabel(type)} 결과물</strong><small>AI 라이브러리에 자동 저장됨</small><div><button type="button" onClick={preview}><Eye size={18}/>미리보기</button><button type="button" className="download" onClick={()=>downloadAiArtifact(type,content,fileBase)}><Download size={18}/>다운로드</button></div></div>;
}

function MessageList({messages,sending,endRef,title}:{messages:ChatMessage[];sending:boolean;endRef:React.RefObject<HTMLDivElement|null>;title:string}){
  return <div className="wv2-ai-messages wv2-ai-panel-messages">{messages.map((item,index)=><article className={item.role} key={item.id||index}><small>{item.role==="user"?"나":"AI"}</small><p>{item.content}</p>{item.role==="assistant"&&item.artifactType&&<ArtifactResultCard type={item.artifactType} content={item.content} title={title}/>}</article>)}{sending&&<article className="assistant"><small>AI</small><p>분석 중…</p></article>}<div ref={endRef} aria-hidden="true"/></div>;
}

export function ConnectedAiPanel({task,project,draftRequest}:{task?:Task;project:Project|null;draftRequest?:AiDraftRequest|null}){
  const initial=useMemo<ContextItem[]>(()=>task?[{id:task.id,kind:"WBS",title:`${task.wbsCode} ${task.name}`,meta:`진척률 ${task.progress}% · 상태 ${statusLabel(task.status)}`}]:project?[{id:project.id,kind:"프로젝트",title:project.name,meta:project.code}]:[],[task?.id,task?.name,task?.wbsCode,task?.progress,task?.status,project?.id,project?.name,project?.code]);
  const [mode,setMode]=useState<PanelMode>("chat");
  const [contextItems,setContextItems]=useState<ContextItem[]>(initial);
  const [message,setMessage]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [conversationId,setConversationId]=useState("");
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [sending,setSending]=useState(false);
  const [notice,setNotice]=useState("");
  const [pickerOpen,setPickerOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<SearchResult[]>([]);
  const [recentConversationId,setRecentConversationId]=useState("");
  const [recentContextItems,setRecentContextItems]=useState<ContextItem[]>([]);
  const [recentMessages,setRecentMessages]=useState<ChatMessage[]>([]);
  const [recentMessage,setRecentMessage]=useState("");
  const [recentSending,setRecentSending]=useState(false);
  const handledDraft=useRef<number|null>(null);
  const messageEndRef=useRef<HTMLDivElement|null>(null);
  const recentMessageEndRef=useRef<HTMLDivElement|null>(null);
  const connected=Boolean(project||contextItems.length);

  useEffect(()=>{if(mode==="chat")messageEndRef.current?.scrollIntoView({block:"end"});else recentMessageEndRef.current?.scrollIntoView({block:"end"})},[messages,recentMessages,sending,recentSending,mode]);
  useEffect(()=>{if(!conversationId){setContextItems(initial);setMessages([])}},[initial,conversationId]);

  const loadConversations=()=>fetch("/api/ai/conversations",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"AI 대화를 불러오지 못했습니다.");setConversations(data.conversations??[])}).catch(reason=>setNotice(reason instanceof Error?reason.message:"AI 대화를 불러오지 못했습니다."));
  useEffect(()=>{void loadConversations()},[]);
  useEffect(()=>{if(!pickerOpen||!query.trim()){setResults([]);return}const controller=new AbortController();const timer=window.setTimeout(()=>fetch(`/api/search?q=${encodeURIComponent(query.trim())}&scope=all`,{cache:"no-store",signal:controller.signal}).then(response=>response.json()).then(data=>setResults(data.results??[])).catch(()=>setResults([])),220);return()=>{window.clearTimeout(timer);controller.abort()}},[pickerOpen,query]);

  const addContext=(result:SearchResult)=>{const item={id:result.id,kind:contextKind(result.kind),title:result.title,meta:`${result.eyebrow} · ${result.meta}`};setContextItems(current=>current.some(existing=>contextKey(existing)===contextKey(item))?current:[...current,item]);setQuery("");setResults([]);setPickerOpen(false)};
  const removeContext=(item:ContextItem)=>setContextItems(current=>current.filter(candidate=>contextKey(candidate)!==contextKey(item)));

  const resume=async(id:string)=>{setNotice("");try{const response=await fetch(`/api/ai/conversations?id=${encodeURIComponent(id)}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"대화를 불러오지 못했습니다.");setRecentConversationId(id);setRecentMessages(withArtifactTypes(data.messages??[]));setRecentContextItems(data.conversation?.contextItems??[])}catch(reason){setNotice(reason instanceof Error?reason.message:"대화를 불러오지 못했습니다.")}};

  const sendChat=async(text=message,options?:{items?:ContextItem[];reset?:boolean;source?:string})=>{const activeItems=options?.items??contextItems;if((!project&&!activeItems.length)||!activeItems.length||!text.trim()||sending)return;const content=text.trim(),activeConversation=options?.reset?"":conversationId;if(options?.reset){setConversationId("");setMessages([]);setContextItems(activeItems)}setSending(true);setNotice("");setMessages(current=>[...current,{role:"user",content}]);setMessage("");try{const contextTitle=`${project?.name||"통합 업무"} · 선택 문맥 ${activeItems.length}건`;const response=await fetch("/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({conversationId:activeConversation||undefined,message:content,source:options?.source||"V2 우측 AI",contextType:activeItems.length>1?"multi-context":activeItems[0]?.kind||"workspace",contextTitle,contextItems:activeItems,projectName:project?.name||""})});const result=await response.json();if(!response.ok&&!result.answer)throw new Error(result.error||"AI 응답을 받지 못했습니다.");setConversationId(result.conversationId||activeConversation);const answer=result.answer||"질문을 저장했습니다.";const artifactType=response.ok?detectAiArtifactType(content)||undefined:undefined;setMessages(current=>[...current,{role:"assistant",content:answer,artifactType}]);if(artifactType&&result.answer)saveAiArtifactResult({type:artifactType,content:result.answer,fileBase:safeFileBase(project?.name||activeItems[0]?.title||"AI-PMS"),title:project?.name||activeItems[0]?.title||"AI 생성 결과물",project:project?.name||"개인 업무",source:`${options?.source||"V2 우측 AI"} · ${artifactLabel(artifactType)} 생성`,conversationId:result.conversationId||activeConversation,conversationTitle:content});setNotice(result.warning||result.error||"");void loadConversations()}catch(reason){setNotice(reason instanceof Error?reason.message:"AI 응답을 받지 못했습니다.")}finally{setSending(false)}};

  const sendRecent=async()=>{const selected=conversations.find(item=>item.id===recentConversationId);if(!selected||!recentMessage.trim()||recentSending)return;const content=recentMessage.trim();setRecentSending(true);setNotice("");setRecentMessage("");setRecentMessages(current=>[...current,{role:"user",content}]);try{const response=await fetch("/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({conversationId:selected.id,message:content,source:selected.source||"V2 우측 AI",contextType:selected.contextType||"multi-context",contextTitle:selected.contextTitle,contextItems:recentContextItems.length?recentContextItems:selected.contextItems,projectName:selected.contextTitle?.split(" · ")[0]||project?.name||""})});const result=await response.json();if(!response.ok&&!result.answer)throw new Error(result.error||"AI 응답을 받지 못했습니다.");const artifactType=response.ok?detectAiArtifactType(content)||undefined:undefined;setRecentMessages(current=>[...current,{role:"assistant",content:result.answer||"질문을 저장했습니다.",artifactType}]);setNotice(result.warning||result.error||"");void loadConversations()}catch(reason){setNotice(reason instanceof Error?reason.message:"AI 응답을 받지 못했습니다.")}finally{setRecentSending(false)}};

  useEffect(()=>{if(!draftRequest||handledDraft.current===draftRequest.key)return;handledDraft.current=draftRequest.key;const items=draftRequest.contextItems?.length?draftRequest.contextItems:initial;setMode("chat");setConversationId("");setMessages([]);setContextItems(items);setMessage(draftRequest.prompt?.trim()||"");setNotice(items.length?`${items.length}개 업무 자료를 AI 문맥에 추가했습니다. 질문을 입력해 주세요.`:"")},[draftRequest?.key]);

  return <div className={`wv2-ai wv2-connected-ai wv2-ai-panel-modern ${connected?"connected":"disconnected"}`}>
    <nav className="wv2-ai-mode-tabs" aria-label="AI 대화 보기"><button className={mode==="chat"?"active":""} onClick={()=>setMode("chat")}>AI 대화</button><button className={mode==="recent"?"active":""} onClick={()=>setMode("recent")}>최근 AI대화</button></nav>

    {mode==="chat"?<>
      <section className="wv2-ai-context-stack"><header><div><span><b>선택 정보 {contextItems.length}건</b></span></div><button onClick={()=>setPickerOpen(value=>!value)}><Plus size={18}/>AI 자료 추가</button></header><div className="wv2-ai-context-lines">{contextItems.map(item=>{const meta=contextMeta(item);const title=`${item.kind||"자료"} · ${item.title||item.fileName||"제목 없음"}${meta?` · ${meta}`:""}`;return <span className="wv2-ai-context-line" key={contextKey(item)} title={title}><em>{item.kind||"자료"}</em><b>{item.title||item.fileName||"제목 없음"}</b><small>{meta}</small>{item.fileAttached&&<FileText size={18}/>}<button title="선택 정보 삭제" aria-label={`${item.title||"선택 정보"} 삭제`} onClick={()=>removeContext(item)}><Trash2 size={18}/></button></span>})}{!contextItems.length&&<p>연결된 선택 정보가 없습니다.</p>}</div>
        {pickerOpen&&<div className="wv2-ai-context-picker"><label><Search size={18}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="전체 프로젝트·업무·문서·이슈 검색"/></label><main>{results.map(result=><button key={`${result.kind}-${result.id}`} onClick={()=>addContext(result)}><span><small>{contextKind(result.kind)} · {result.eyebrow}</small><b>{result.title}</b><em>{result.meta}</em></span><Plus size={18}/></button>)}{query.trim()&&!results.length&&<p>검색 결과가 없습니다.</p>}</main></div>}
      </section>
      {!messages.length?<div className="wv2-ai-welcome wv2-ai-panel-fill"><Sparkles size={26}/><h3>{contextItems.length?`${contextItems.length}개 선택 정보로 무엇을 도와드릴까요?`:"분석할 자료를 선택해 주세요"}</h3><p>현재 선택 정보로 시작한 대화는 MY AI HOME에 저장되어 계속 이어갈 수 있습니다.</p><button disabled={!contextItems.length} onClick={()=>sendChat("선택한 문맥의 현재 상태와 핵심 위험을 요약해줘")}>현재 상태·위험 요약</button><button disabled={!contextItems.length} onClick={()=>sendChat("선택한 항목 사이의 일정 영향과 의존성을 분석해줘")}>일정 영향 분석</button></div>:<MessageList messages={messages} sending={sending} endRef={messageEndRef} title={project?.name||contextItems[0]?.title||"AI 생성 결과물"}/>} 
      {notice&&<p className="wv2-panel-notice">{notice}</p>}
      <label className="wv2-ai-input wv2-ai-panel-input"><textarea rows={3} value={message} onChange={event=>setMessage(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void sendChat()}}} disabled={!contextItems.length||sending} placeholder="선택한 자료를 기준으로 질문하세요"/><button disabled={!contextItems.length||sending||!message.trim()} onClick={()=>sendChat()}><Send size={18}/></button></label>
    </>:<>
      <section className="wv2-ai-history wv2-ai-recent-tab"><header><b>최근 AI대화</b><span>{conversations.length}개</span></header><div>{conversations.slice(0,8).map(item=><button key={item.id} className={recentConversationId===item.id?"active":""} onClick={()=>void resume(item.id)}><MessageSquareText size={18}/><span><b>{item.title}</b><small>{item.contextItems.length}개 문맥</small></span><ChevronRight size={18}/></button>)}</div></section>
      {recentConversationId?<><div className="wv2-ai-recent-context"><Link2 size={16}/><span>{recentContextItems.length}개 문맥으로 이어서 대화합니다.</span></div><MessageList messages={recentMessages} sending={recentSending} endRef={recentMessageEndRef} title={conversations.find(item=>item.id===recentConversationId)?.title||"AI 대화"}/>{notice&&<p className="wv2-panel-notice">{notice}</p>}<label className="wv2-ai-input wv2-ai-panel-input"><textarea rows={3} value={recentMessage} onChange={event=>setRecentMessage(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void sendRecent()}}} disabled={recentSending} placeholder="이 AI 대화를 이어서 질문하세요"/><button disabled={recentSending||!recentMessage.trim()} onClick={()=>void sendRecent()}><Send size={18}/></button></label></>:<div className="wv2-ai-welcome wv2-ai-panel-fill"><MessageSquareText size={26}/><h3>이어갈 AI 대화를 선택해 주세요.</h3><p>최근 AI대화를 선택하면 저장된 문맥과 대화 내용을 그대로 불러옵니다.</p></div>}
    </>}
  </div>;
}
