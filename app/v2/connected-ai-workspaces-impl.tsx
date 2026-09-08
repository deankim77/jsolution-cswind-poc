"use client";

import {useEffect,useMemo,useRef,useState} from "react";
/* eslint-disable react-hooks/exhaustive-deps */
import {ChevronRight,Download,Eye,FileText,FolderOpen,Link2,MessageSquareText,Plus,Search,Send,Sparkles,Trash2} from "lucide-react";
import {artifactLabel,detectAiArtifactType,downloadAiArtifact,type AiArtifactType} from "../ai-artifact-download";
import {saveAiArtifactResult} from "../ai-artifact-library";

export type ContextItem={id?:string;kind?:string;title?:string;meta?:string;fileName?:string;revision?:number;fileAttached?:boolean};
export type AiDraftRequest={key:number;prompt?:string;contextItems?:ContextItem[];source?:string};
type ChatMessage={id?:string;role:"user"|"assistant";content:string;createdAt?:number;artifactType?:AiArtifactType};
type Conversation={id:string;title:string;source:string;contextType:string;contextTitle:string;contextItems:ContextItem[];groupName?:string;updatedAt:number};
type SearchResult={id:string;kind:"project"|"task"|"document"|"issue";projectId:string;taskId?:string;eyebrow:string;title:string;meta:string};
type Project={id:string;code:string;name:string};
type Task={id:string;wbsCode:string;name:string;progress:number;status:string;deliverables:Array<{id?:string;name:string}>};

const contextKind=(kind:SearchResult["kind"])=>kind==="project"?"프로젝트":kind==="task"?"WBS":kind==="document"?"문서":"이슈";
const contextKey=(item:ContextItem)=>`${item.kind||"context"}:${item.id||item.title||""}`;
const statusLabel=(status:string)=>status==="completed"?"완료":status==="review"?"완료 검토":status==="active"?"진행 중":status==="hold"?"보류":"예정";
const safeFileBase=(value:string)=>`${(value||"AI-PMS").trim()}-AI결과`;
const withArtifactTypes=(items:ChatMessage[])=>items.map((item,index)=>item.role==="assistant"?{...item,artifactType:item.artifactType||detectAiArtifactType(items[index-1]?.content||"")||undefined}:item);
function ArtifactResultCard({type,content,title}:{type:AiArtifactType;content:string;title:string}){
  const fileBase=safeFileBase(title);
  const preview=()=>window.dispatchEvent(new CustomEvent("jsolution-ai-artifact-preview",{detail:{type,content,fileBase,title:title||"AI 생성 결과물"}}));
  return <div className="wv2-ai-artifact"><strong>{artifactLabel(type)} 결과물</strong><small>AI 라이브러리에 자동 저장됨</small><div><button type="button" onClick={preview}><Eye size={18}/>미리보기</button><button type="button" className="download" onClick={()=>downloadAiArtifact(type,content,fileBase)}><Download size={18}/>다운로드</button></div></div>;
}

export function ConnectedAiPanel({task,project,draftRequest}:{task?:Task;project:Project|null;draftRequest?:AiDraftRequest|null}){
  const initial=useMemo<ContextItem[]>(()=>task?[{id:task.id,kind:"WBS",title:`${task.wbsCode} ${task.name}`,meta:`진척률 ${task.progress}% · 상태 ${statusLabel(task.status)}`}]:project?[{id:project.id,kind:"프로젝트",title:project.name,meta:project.code}]:[],[task?.id,task?.name,task?.wbsCode,task?.progress,task?.status,project?.id,project?.name,project?.code]);
  const [contextItems,setContextItems]=useState<ContextItem[]>(initial);
  const [message,setMessage]=useState("");const [messages,setMessages]=useState<ChatMessage[]>([]);const [conversationId,setConversationId]=useState("");const [conversations,setConversations]=useState<Conversation[]>([]);
  const [sending,setSending]=useState(false);const [notice,setNotice]=useState("");const [pickerOpen,setPickerOpen]=useState(false);const [query,setQuery]=useState("");const [results,setResults]=useState<SearchResult[]>([]);
  const handledDraft=useRef<number|null>(null);
  const messageEndRef=useRef<HTMLDivElement|null>(null);
  const connected=Boolean(project||contextItems.length);
  useEffect(()=>{messageEndRef.current?.scrollIntoView({block:"end"})},[messages,sending]);

  useEffect(()=>{if(!conversationId){setContextItems(initial);setMessages([])}},[initial,conversationId]);
  const loadConversations=()=>fetch("/api/ai/conversations",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"AI 대화를 불러오지 못했습니다.");setConversations(data.conversations??[]);setNotice("")}).catch(reason=>setNotice(reason instanceof Error?reason.message:"AI 대화를 불러오지 못했습니다."));
  useEffect(()=>{void loadConversations()},[]);
  useEffect(()=>{if(!pickerOpen||!query.trim()){setResults([]);return}const controller=new AbortController();const timer=window.setTimeout(()=>fetch(`/api/search?q=${encodeURIComponent(query.trim())}&scope=all`,{cache:"no-store",signal:controller.signal}).then(response=>response.json()).then(data=>setResults(data.results??[])).catch(()=>setResults([])),220);return()=>{window.clearTimeout(timer);controller.abort()}},[pickerOpen,query]);

  const addContext=(result:SearchResult)=>{const item={id:result.id,kind:contextKind(result.kind),title:result.title,meta:`${result.eyebrow} · ${result.meta}`};setContextItems(current=>current.some(existing=>contextKey(existing)===contextKey(item))?current:[...current,item]);setQuery("");setResults([])};
  const removeContext=(item:ContextItem)=>setContextItems(current=>current.filter(candidate=>contextKey(candidate)!==contextKey(item)));
  const resume=async(id:string)=>{setNotice("");try{const response=await fetch(`/api/ai/conversations?id=${encodeURIComponent(id)}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"대화를 불러오지 못했습니다.");setConversationId(id);setMessages(withArtifactTypes(data.messages??[]));setContextItems(data.conversation?.contextItems??[]);setPickerOpen(false)}catch(reason){setNotice(reason instanceof Error?reason.message:"대화를 불러오지 못했습니다.")}};
  const newConversation=()=>{setConversationId("");setMessages([]);setContextItems(initial);setNotice("")};
  const send=async(text=message,options?:{items?:ContextItem[];reset?:boolean;source?:string})=>{const activeItems=options?.items??contextItems;if((!project&&!activeItems.length)||!activeItems.length||!text.trim()||sending)return;const content=text.trim(),activeConversation=options?.reset?"":conversationId;if(options?.reset){setConversationId("");setMessages([]);setContextItems(activeItems)}setSending(true);setNotice("");setMessages(current=>[...current,{role:"user",content}]);setMessage("");try{const contextTitle=`${project?.name||"통합 업무"} · 선택 문맥 ${activeItems.length}건`;const response=await fetch("/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({conversationId:activeConversation||undefined,message:content,source:options?.source||"V2 우측 AI",contextType:activeItems.length>1?"multi-context":activeItems[0]?.kind||"workspace",contextTitle,contextItems:activeItems,projectName:project?.name||""})});const result=await response.json();if(!response.ok&&!result.answer)throw new Error(result.error||"AI 응답을 받지 못했습니다.");setConversationId(result.conversationId||activeConversation);const answer=result.answer||"질문을 저장했습니다.";const artifactType=response.ok?detectAiArtifactType(content)||undefined:undefined;setMessages(current=>[...current,{role:"assistant",content:answer,artifactType}]);if(artifactType&&result.answer)saveAiArtifactResult({type:artifactType,content:result.answer,fileBase:safeFileBase(project?.name||activeItems[0]?.title||"AI-PMS"),title:project?.name||activeItems[0]?.title||"AI 생성 결과물",project:project?.name||"개인 업무",source:`${options?.source||"V2 우측 AI"} · ${artifactLabel(artifactType)} 생성`,conversationId:result.conversationId||activeConversation,conversationTitle:content});setNotice(result.warning||result.error||"");void loadConversations()}catch(reason){setNotice(reason instanceof Error?reason.message:"AI 응답을 받지 못했습니다.")}finally{setSending(false)}};
  useEffect(()=>{if(!draftRequest||handledDraft.current===draftRequest.key)return;handledDraft.current=draftRequest.key;const items=draftRequest.contextItems?.length?draftRequest.contextItems:initial;setConversationId("");setMessages([]);setContextItems(items);setMessage(draftRequest.prompt?.trim()||"");setNotice(items.length?`${items.length}개 업무 자료를 AI 문맥에 추가했습니다. 질문을 입력해 주세요.`:"")},[draftRequest?.key]);

  return <div className={`wv2-ai wv2-connected-ai ${connected?"connected":"disconnected"}`}>
    <section className="wv2-ai-context-stack"><header><div><Link2 size={18}/><span><b>AI 대화 문맥</b><small>프로젝트·WBS·문서·이슈를 여러 공간에서 함께 선택</small></span></div><button onClick={()=>setPickerOpen(value=>!value)}><Plus size={18}/>문맥 추가</button></header><div>{contextItems.map(item=><span key={contextKey(item)}><em>{item.kind}</em><b>{item.title}</b>{item.fileAttached&&<FileText size={18}/>}<button onClick={()=>removeContext(item)}><Trash2 size={18}/></button></span>)}{!contextItems.length&&<p>연결된 문맥이 없습니다.</p>}</div>
      {pickerOpen&&<div className="wv2-ai-context-picker"><label><Search size={18}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="전체 프로젝트·업무·문서·이슈 검색"/></label><main>{results.map(result=><button key={`${result.kind}-${result.id}`} onClick={()=>addContext(result)}><span><small>{contextKind(result.kind)} · {result.eyebrow}</small><b>{result.title}</b><em>{result.meta}</em></span><Plus size={18}/></button>)}{query.trim()&&!results.length&&<p>검색 결과가 없습니다.</p>}</main></div>}
    </section>
    <section className="wv2-ai-history"><header><b>최근 대화</b><button onClick={newConversation}><Plus size={18}/>새 대화</button></header><div>{conversations.slice(0,5).map(item=><button key={item.id} className={conversationId===item.id?"active":""} onClick={()=>resume(item.id)}><MessageSquareText size={18}/><span><b>{item.title}</b><small>{item.contextItems.length}개 문맥</small></span><ChevronRight size={18}/></button>)}</div></section>
    {!messages.length?<div className="wv2-ai-welcome"><Sparkles size={26}/><h3>{contextItems.length?`${contextItems.length}개 문맥으로 무엇을 도와드릴까요?`:"분석할 문맥을 선택해 주세요"}</h3><p>이 대화는 MY AI HOME과 AI 라이브러리에 저장되어 같은 대화에서 계속 이어집니다.</p><button disabled={!contextItems.length} onClick={()=>send("선택한 문맥의 현재 상태와 핵심 위험을 요약해줘")}>현재 상태·위험 요약</button><button disabled={!contextItems.length} onClick={()=>send("선택한 항목 사이의 일정 영향과 의존성을 분석해줘")}>일정 영향 분석</button></div>:<div className="wv2-ai-messages">{messages.map((item,index)=><article className={item.role} key={item.id||index}><small>{item.role==="user"?"나":"AI"}</small><p>{item.content}</p>{item.role==="assistant"&&item.artifactType&&<ArtifactResultCard type={item.artifactType} content={item.content} title={project?.name||contextItems[0]?.title||"AI 생성 결과물"}/>}</article>)}{sending&&<article className="assistant"><small>AI</small><p>분석 중…</p></article>}<div ref={messageEndRef} aria-hidden="true"/></div>}
    {notice&&<p className="wv2-panel-notice">{notice}</p>}<label className="wv2-ai-input"><textarea rows={3} value={message} onChange={event=>setMessage(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send()}}} disabled={!contextItems.length||sending} placeholder="선택한 여러 업무 문맥을 기준으로 질문하세요"/><button disabled={!contextItems.length||sending||!message.trim()} onClick={()=>send()}><Send size={18}/></button></label>
  </div>;
}

export function ContinuingAiHomeWorkspace(){
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [query,setQuery]=useState("");
  const [groupFilter,setGroupFilter]=useState("all");
  const [groups,setGroups]=useState<string[]>([]);
  const [groupManagerOpen,setGroupManagerOpen]=useState(false);
  const [groupDraft,setGroupDraft]=useState("");
  const [editingGroup,setEditingGroup]=useState("");
  const [titleEditing,setTitleEditing]=useState(false);
  const [titleDraft,setTitleDraft]=useState("");
  const [deleteTarget,setDeleteTarget]=useState<{kind:"conversation"|"group";name:string}|null>(null);
  const [reply,setReply]=useState("");
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [notice,setNotice]=useState("");
  const messagesRef=useRef<HTMLDivElement|null>(null);
  const messagesEndRef=useRef<HTMLDivElement|null>(null);
  const replyRef=useRef<HTMLTextAreaElement|null>(null);
  const stickToBottom=useRef(true);

  const persistGroups=async(next:string[])=>{
    const normalized=Array.from(new Set(next.map(value=>value.trim()).filter(Boolean))).sort();
    setGroups(normalized);
    await fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:"v2-ai-groups",value:{groups:normalized}})});
  };
  const loadList=async(preferred?:string)=>{
    const response=await fetch("/api/ai/conversations",{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"AI 대화를 불러오지 못했습니다.");
    const next=(data.conversations??[]) as Conversation[];
    setConversations(next);
    setGroups(current=>Array.from(new Set([...current,...next.map(item=>item.groupName||"").filter(Boolean)])).sort());
    setSelectedId(current=>preferred||current||next[0]?.id||"");
  };
  useEffect(()=>{
    Promise.all([
      loadList(),
      fetch("/api/state?key=v2-ai-groups",{cache:"no-store"}).then(response=>response.ok?response.json():{}).then(({value}:{value?:{groups?:string[]}})=>setGroups(Array.from(new Set(value?.groups??[])).sort())),
    ]).catch(reason=>setNotice(reason instanceof Error?reason.message:"AI 대화를 불러오지 못했습니다.")).finally(()=>setLoading(false));
  },[]);
  const loadDetail=async(id:string)=>{
    const response=await fetch(`/api/ai/conversations?id=${encodeURIComponent(id)}`,{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"대화 내용을 불러오지 못했습니다.");
    setMessages(withArtifactTypes(data.messages??[]));
  };
  useEffect(()=>{if(!selectedId){setMessages([]);return}stickToBottom.current=true;loadDetail(selectedId).catch(reason=>setNotice(reason instanceof Error?reason.message:"대화 내용을 불러오지 못했습니다."))},[selectedId]);
  useEffect(()=>{const container=messagesRef.current;if(!container||!stickToBottom.current)return;requestAnimationFrame(()=>container.scrollTo({top:container.scrollHeight,behavior:selectedId?"smooth":"auto"}))},[messages,sending,selectedId]);
  useEffect(()=>{const element=replyRef.current;if(!element)return;element.style.height="auto";element.style.height=`${Math.min(Math.max(element.scrollHeight,36),120)}px`},[reply]);

  const patchConversation=async(patch:{title?:string;groupName?:string},id=selectedId)=>{
    if(!id)return;
    const response=await fetch("/api/ai/conversations",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,...patch})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"대화를 변경하지 못했습니다.");
    setConversations(current=>current.map(item=>item.id===id?{...item,...patch}:item));
  };
  const saveTitle=async()=>{
    const selected=conversations.find(item=>item.id===selectedId),title=titleDraft.trim();
    if(!selected||!title){setTitleEditing(false);return}
    try{await patchConversation({title});setNotice("대화 이름을 변경했습니다.");setTitleEditing(false)}
    catch(reason){setNotice(reason instanceof Error?reason.message:"대화 이름을 변경하지 못했습니다.")}
  };
  const moveConversation=async(groupName:string)=>{
    try{await patchConversation({groupName});setNotice(groupName?`'${groupName}' 그룹으로 이동했습니다.`:"미분류로 이동했습니다.")}
    catch(reason){setNotice(reason instanceof Error?reason.message:"대화 그룹을 변경하지 못했습니다.")}
  };
  const saveGroup=async()=>{
    const name=groupDraft.trim();
    if(!name)return;
    if(groups.some(group=>group===name&&group!==editingGroup)){setNotice("같은 이름의 그룹이 이미 있습니다.");return}
    try{
      if(editingGroup){
        const targets=conversations.filter(item=>item.groupName===editingGroup);
        await Promise.all(targets.map(item=>patchConversation({groupName:name},item.id)));
        await persistGroups(groups.map(group=>group===editingGroup?name:group));
        if(groupFilter===editingGroup)setGroupFilter(name);
        setNotice("그룹 이름을 변경했습니다.");
      }else{
        await persistGroups([...groups,name]);
        setNotice("대화 그룹을 추가했습니다.");
      }
      setGroupDraft("");setEditingGroup("");
    }catch(reason){setNotice(reason instanceof Error?reason.message:"대화 그룹을 저장하지 못했습니다.")}
  };
  const deleteGroup=async(name:string)=>{
    try{
      const targets=conversations.filter(item=>item.groupName===name);
      await Promise.all(targets.map(item=>patchConversation({groupName:""},item.id)));
      await persistGroups(groups.filter(group=>group!==name));
      if(groupFilter===name)setGroupFilter("ungrouped");
      setNotice("그룹을 삭제하고 대화는 미분류로 이동했습니다.");
    }catch(reason){setNotice(reason instanceof Error?reason.message:"대화 그룹을 삭제하지 못했습니다.")}
  };
  const deleteConversation=async()=>{
    const selected=conversations.find(item=>item.id===selectedId);
    if(!selected)return;
    try{
      const response=await fetch(`/api/ai/conversations?id=${encodeURIComponent(selected.id)}`,{method:"DELETE"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"대화를 삭제하지 못했습니다.");
      setConversations(current=>{const next=current.filter(item=>item.id!==selected.id);setSelectedId(next[0]?.id||"");return next});
      setMessages([]);setNotice("대화를 삭제했습니다.");
    }catch(reason){setNotice(reason instanceof Error?reason.message:"대화를 삭제하지 못했습니다.")}
  };
  const confirmDelete=async()=>{
    const target=deleteTarget;setDeleteTarget(null);if(!target)return;
    if(target.kind==="conversation")await deleteConversation();else await deleteGroup(target.name);
  };
  const send=async()=>{
    const selected=conversations.find(item=>item.id===selectedId);
    if(!selected||!reply.trim()||sending)return;
    const content=reply.trim();stickToBottom.current=true;setSending(true);setReply("");setMessages(current=>[...current,{role:"user",content}]);
    try{
      const response=await fetch("/api/ai/conversations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:selected.id,title:selected.title,source:selected.source,contextType:selected.contextType,contextTitle:selected.contextTitle,contextItems:selected.contextItems,message:content})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"AI 응답을 받지 못했습니다.");
      if(data.answer){
        const artifactType=response.ok?detectAiArtifactType(content)||undefined:undefined;
        setMessages(current=>[...current,{role:"assistant",content:data.answer,artifactType}]);
        if(artifactType)saveAiArtifactResult({type:artifactType,content:data.answer,fileBase:safeFileBase(selected.contextTitle||selected.title),title:selected.title,project:selected.contextTitle.split(" · ")[0]||"개인 업무",source:`${selected.source} · ${artifactLabel(artifactType)} 생성`,conversationId:selected.id,conversationTitle:selected.title});
      }
      setNotice(data.warning||data.error||"");await loadList(selected.id);
    }catch(reason){setNotice(reason instanceof Error?reason.message:"AI 응답을 받지 못했습니다.");await loadDetail(selected.id).catch(()=>undefined)}
    finally{setSending(false)}
  };

  const visible=conversations.filter(item=>(groupFilter==="all"||(groupFilter==="ungrouped"?!item.groupName:item.groupName===groupFilter))&&(!query.trim()||`${item.title} ${item.source} ${item.contextTitle} ${item.groupName||""}`.toLowerCase().includes(query.trim().toLowerCase())));
  const selected=conversations.find(item=>item.id===selectedId);
  const selectedContextSummary=selected?Array.from(new Set([selected.contextTitle.split(" · 선택")[0],...selected.contextItems.map(item=>`${item.kind||"문맥"}: ${item.title||item.fileName||"제목 없음"}`)].filter(Boolean))).join(" · "):"";

  return <section className="wv2-module wv2-ai-home wv2-ai-library">
    <header className="wv2-module-head"><div><small>MY AI HOME · AI LIBRARY</small><h1>나의 AI 업무 공간</h1><p>우측 패널과 모든 업무 공간에서 시작한 AI 대화를 같은 문맥으로 계속 이어갑니다.</p></div><div className="wv2-module-count"><b>{conversations.length}</b><span>저장 대화</span></div></header>
    <div className="wv2-ai-home-grid">
      <aside>
        <label><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="대화·프로젝트 검색"/></label>
        <div className="wv2-ai-group-row"><select className="wv2-ai-group-filter" value={groupFilter} onChange={event=>setGroupFilter(event.target.value)}><option value="all">전체 대화 그룹</option><option value="ungrouped">미분류</option>{groups.map(group=><option key={group} value={group}>{group}</option>)}</select><button title="그룹 관리" onClick={()=>setGroupManagerOpen(value=>!value)}><FolderOpen size={18}/></button></div>
        {groupManagerOpen&&<section className="wv2-ai-group-manager"><header><b>{editingGroup?"그룹 이름 변경":"대화 그룹 관리"}</b>{editingGroup&&<button className="subtle" onClick={()=>{setEditingGroup("");setGroupDraft("")}}>취소</button>}</header><div className="editor"><input aria-label={editingGroup?"변경할 그룹 이름":"새 그룹 이름"} value={groupDraft} onChange={event=>setGroupDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void saveGroup()}if(event.key==="Escape"){setEditingGroup("");setGroupDraft("")}}} placeholder={editingGroup?"변경할 그룹 이름":"새 그룹 이름"}/><button disabled={!groupDraft.trim()} onClick={()=>void saveGroup()}>{!editingGroup&&<Plus size={18}/>}<span>{editingGroup?"변경":"추가"}</span></button></div>{groups.map(group=>{const conversationCount=conversations.filter(item=>item.groupName===group).length;return <div className="group" key={group}><button onClick={()=>setGroupFilter(group)}><span>{group}</span><small>{conversationCount}개</small></button><button title="이름 변경" onClick={()=>{setEditingGroup(group);setGroupDraft(group)}}>수정</button><button className="danger" title="그룹 삭제" onClick={()=>setDeleteTarget({kind:"group",name:group})}>삭제</button></div>})}</section>}
        {loading?<p className="wv2-ai-library-empty">AI 대화를 불러오는 중…</p>:visible.map(item=><button key={item.id} className={selectedId===item.id?"active":""} onClick={()=>setSelectedId(item.id)}><Sparkles size={18}/><span><b>{item.title}</b><small>{item.groupName?`${item.groupName} · `:""}{item.source} · {item.contextItems.length}개 문맥</small><em>{new Date(item.updatedAt*1000).toLocaleString("ko-KR")}</em></span><ChevronRight size={18}/></button>)}
      </aside>
      <main>{selected?<>
        <header><div>{titleEditing?<div className="wv2-ai-title-editor"><input autoFocus value={titleDraft} onChange={event=>setTitleDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void saveTitle();if(event.key==="Escape")setTitleEditing(false)}}/><button onClick={()=>void saveTitle()}>저장</button></div>:<h2>{selected.title}</h2>}<p title={selectedContextSummary}>{selected.groupName?`${selected.groupName} · `:""}{selectedContextSummary}</p></div>
          <div className="wv2-ai-home-actions"><span>{selected.contextItems.length}개 문맥</span><button onClick={()=>{setTitleDraft(selected.title);setTitleEditing(true)}}>이름 변경</button><label className="wv2-ai-move-group"><span>그룹 이동</span><select value={selected.groupName||""} onChange={event=>void moveConversation(event.target.value)}><option value="">미분류</option>{groups.map(group=><option key={group} value={group}>{group}</option>)}</select></label><button className="danger" onClick={()=>setDeleteTarget({kind:"conversation",name:selected.title})}><Trash2 size={18}/>삭제</button></div>
        </header>
        <div ref={messagesRef} className="wv2-ai-home-messages" onScroll={event=>{const element=event.currentTarget;stickToBottom.current=element.scrollHeight-element.scrollTop-element.clientHeight<72}}>{messages.map((item,index)=><article key={item.id||index} className={item.role}><small>{item.role==="user"?"나":"AI"}</small><p>{item.content}</p>{item.role==="assistant"&&item.artifactType&&<ArtifactResultCard type={item.artifactType} content={item.content} title={selected.title}/>}</article>)}{sending&&<article className="assistant"><small>AI</small><p>분석 중…</p></article>}<div ref={messagesEndRef} aria-hidden="true"/></div>
        <label className="wv2-ai-library-input"><textarea ref={replyRef} rows={1} value={reply} onChange={event=>setReply(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send()}}} placeholder="이 대화의 문맥과 기록을 유지해 계속 질문하세요"/><button disabled={sending||!reply.trim()} onClick={send}><Send size={18}/></button></label>
      </>:<div className="wv2-ai-library-empty"><FolderOpen size={28}/><b>이어볼 AI 대화를 선택해 주세요.</b></div>}</main>
    </div>
    {notice&&<p className="wv2-module-notice">{notice}</p>}
    {deleteTarget&&<div className="wv2-confirm-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setDeleteTarget(null)}}><section className="wv2-confirm-dialog" role="alertdialog" aria-modal="true"><header><h2>{deleteTarget.kind==="group"?"대화 그룹 삭제":"AI 대화 삭제"}</h2></header><p>{deleteTarget.kind==="group"?`'${deleteTarget.name}' 그룹을 삭제할까요? 대화는 미분류로 이동합니다.`:`'${deleteTarget.name}' 대화를 삭제할까요?`}</p><footer><button onClick={()=>setDeleteTarget(null)}>취소</button><button className="danger" onClick={()=>void confirmDelete()}>삭제</button></footer></section></div>}
  </section>;
}
