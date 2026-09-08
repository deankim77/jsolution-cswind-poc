"use client";

import {AlertTriangle,FileText,Folders,GitPullRequestArrow,Search,ShieldCheck,UserRound,Workflow,X} from "lucide-react";
import {useEffect,useRef,useState,type ComponentType,type CSSProperties} from "react";
import type {ContextItem} from "./connected-ai-workspaces";
import {useAiContextSelection} from "./ai-context-selection";
import "./integrated-global-search.css";

export type IntegratedSearchResult={id:string;kind:"project"|"task"|"document"|"issue"|"workflow"|"ecr"|"quality"|"person";projectId?:string;taskId?:string;eyebrow:string;title:string;meta:string;intentReason?:string};
type Scope="all"|"project"|"task"|"document"|"issue"|"workflow"|"ecr"|"quality"|"person";
const icons:Record<IntegratedSearchResult["kind"],ComponentType<{size?:number}>>={project:Folders,task:Workflow,document:FileText,issue:AlertTriangle,workflow:GitPullRequestArrow,ecr:Workflow,quality:ShieldCheck,person:UserRound};
const labels:Record<Scope,string>={all:"전체",project:"프로젝트",task:"WBS",document:"문서·산출물",issue:"이슈·리스크",workflow:"워크플로우",ecr:"설계변경",quality:"품질관리",person:"사람"};
const RESUME_KEY="v2-integrated-search-resume";

export function IntegratedGlobalSearch({query,setQuery,onClose,onOpen,onAi,embedded=true}:{query:string;setQuery:(value:string)=>void;onClose:()=>void;onOpen:(result:IntegratedSearchResult)=>void;onAi:(items:ContextItem[],prompt:string)=>void;embedded?:boolean}){
  void onAi;
  const selection=useAiContextSelection("통합검색");
  const [scope,setScope]=useState<Scope>("all"),[results,setResults]=useState<IntegratedSearchResult[]>([]),[loading,setLoading]=useState(false),[intent,setIntent]=useState("일반 검색"),[visible,setVisible]=useState(true);
  const [workspaceStyle,setWorkspaceStyle]=useState<CSSProperties|undefined>(undefined);
  const runtimeTabRef=useRef<HTMLButtonElement|null>(null),previousActiveRef=useRef<HTMLElement|null>(null);
  const contextFor=(item:IntegratedSearchResult):ContextItem=>({id:item.id,kind:item.kind==="project"?"프로젝트":item.kind==="task"?"WBS":item.kind==="document"?"문서":item.kind==="workflow"?"워크플로우":item.kind==="ecr"?"설계변경":item.kind==="quality"?"품질":item.kind==="person"?"담당자":"이슈",title:item.title,meta:item.meta});
  const preserveSearch=()=>{try{sessionStorage.setItem(RESUME_KEY,JSON.stringify({query,scope}))}catch{}};
  const activateRuntimeTab=()=>{const tabs=document.querySelector<HTMLElement>(".wv2-work-tabs");if(!tabs)return;tabs.querySelectorAll<HTMLElement>(":scope > button.active").forEach(item=>{if(item!==runtimeTabRef.current)item.classList.remove("active")});runtimeTabRef.current?.classList.add("active")};
  const showSearch=()=>{setVisible(true);window.requestAnimationFrame(activateRuntimeTab)};
  const hideSearch=()=>{preserveSearch();setVisible(false);runtimeTabRef.current?.classList.remove("active")};
  const closeSearch=()=>{try{sessionStorage.removeItem(RESUME_KEY)}catch{}selection.clear();setQuery("");setVisible(false);runtimeTabRef.current?.classList.remove("active");previousActiveRef.current?.classList.add("active");const panelClose=document.querySelector<HTMLButtonElement>(".wv2-panel>header>div:last-child>button:last-child");panelClose?.click();onClose()};

  useEffect(()=>{try{const raw=sessionStorage.getItem(RESUME_KEY);if(!raw)return;sessionStorage.removeItem(RESUME_KEY);const saved=JSON.parse(raw) as {query?:string;scope?:Scope};if(saved.query)setQuery(saved.query);if(saved.scope&&saved.scope in labels)setScope(saved.scope)}catch{}},[]);
  useEffect(()=>{if(!embedded)return;const content=document.querySelector<HTMLElement>(".wv2-content"),tabs=document.querySelector<HTMLElement>(".wv2-work-tabs");if(!content||!tabs)return;previousActiveRef.current=tabs.querySelector<HTMLElement>(":scope > button.active");previousActiveRef.current?.classList.remove("active");const tab=document.createElement("button");runtimeTabRef.current=tab;tab.className="active wv2-search-runtime-tab";const title=document.createElement("span");title.textContent="통합검색";const close=document.createElement("i");close.setAttribute("role","button");close.setAttribute("aria-label","통합검색 탭 닫기");close.textContent="×";close.addEventListener("click",event=>{event.stopPropagation();closeSearch()});tab.addEventListener("click",event=>{if((event.target as HTMLElement).closest("i"))return;showSearch()});tab.append(title,close);tabs.appendChild(tab);const measure=()=>{const rect=content.getBoundingClientRect();setWorkspaceStyle({position:"fixed",left:rect.left,top:rect.top,width:rect.width,height:rect.height})};measure();window.addEventListener("resize",measure);const observer=new ResizeObserver(measure);observer.observe(content);return()=>{observer.disconnect();window.removeEventListener("resize",measure);tab.remove();runtimeTabRef.current=null;if(!tabs.querySelector(":scope > button.active"))previousActiveRef.current?.classList.add("active")}},[embedded]);
  useEffect(()=>{if(!embedded)return;const handleNavigation=(event:MouseEvent)=>{const target=event.target as HTMLElement|null;const nav=target?.closest<HTMLElement>(".wv2-context-level2 button,.wv2-rail button,.wv2-work-tabs>button");if(!nav||nav===runtimeTabRef.current||nav.classList.contains("wv2-search-runtime-tab"))return;hideSearch()};const hideForArtifact=()=>hideSearch();document.addEventListener("click",handleNavigation,true);window.addEventListener("jsolution-ai-artifact-preview",hideForArtifact);return()=>{document.removeEventListener("click",handleNavigation,true);window.removeEventListener("jsolution-ai-artifact-preview",hideForArtifact)}},[embedded,query,scope]);
  useEffect(()=>{if(!embedded||!visible)return;activateRuntimeTab()},[embedded,visible]);
  useEffect(()=>{if(!query.trim()){setResults([]);setIntent("일반 검색");return}const controller=new AbortController(),timer=window.setTimeout(()=>{setLoading(true);fetch(`/api/search?q=${encodeURIComponent(query.trim())}&scope=${scope}&intent=1`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"검색하지 못했습니다.");setResults(data.results??[]);setIntent(data.intentLabel||"일반 검색")}).catch(()=>{if(!controller.signal.aborted)setResults([])}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})},180);return()=>{window.clearTimeout(timer);controller.abort()}},[query,scope]);
  const grouped=(['project','task','document','issue','workflow','ecr','quality','person'] as const).map(kind=>({kind,items:results.filter(item=>item.kind===kind)})).filter(group=>group.items.length);
  const reopenSearch=()=>window.setTimeout(()=>document.querySelector<HTMLButtonElement>(".wv2-global-trigger")?.click(),90);
  const openSearchResult=(item:IntegratedSearchResult)=>{
    preserveSearch();
    if(item.kind==="workflow"||item.kind==="ecr"||item.kind==="quality"){
      const moduleLabel=item.kind==="workflow"?"워크플로우":item.kind==="ecr"?"설계변경":"품질관리";
      onClose();
      window.setTimeout(()=>{if(!document.querySelector(".wv2-context"))document.querySelector<HTMLButtonElement>(".wv2-nav-toggle")?.click();window.setTimeout(()=>{const moduleButton=Array.from(document.querySelectorAll<HTMLButtonElement>(".wv2-context-level2 button")).find(button=>button.textContent?.trim()===moduleLabel);moduleButton?.click();window.setTimeout(()=>{const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>(".wv2-content button"));const target=buttons.find(button=>Boolean(item.eyebrow)&&button.textContent?.includes(item.eyebrow))||buttons.find(button=>button.textContent?.includes(item.title));target?.click();reopenSearch()},450)},120)},0);
      return;
    }
    onOpen(item);
    reopenSearch();
  };
  const content=<section className="wv2-integrated-search" onClick={event=>event.stopPropagation()}>
    <header><Search size={20}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="예: 지연된 프로젝트, 양산이관 문서, 품질 리스크, 설계변경 승인 현황"/><span className="intent">{intent}</span>{!embedded&&<button onClick={closeSearch}><X size={18}/></button>}</header>
    <nav>{(Object.keys(labels) as Scope[]).map(key=><button key={key} className={scope===key?"active":""} onClick={()=>setScope(key)}>{labels[key]}</button>)}</nav>
    <main>{!query.trim()?<div className="empty"><Search size={28}/><b>질문처럼 검색해도 됩니다.</b><p>프로젝트·WBS·문서·이슈·워크플로우·설계변경·품질을 함께 찾습니다.</p></div>:loading?<div className="empty"><b>검색 중…</b></div>:grouped.length?grouped.map(group=><section key={group.kind}><header><b>{labels[group.kind]}</b><span>{group.items.length}건</span></header>{group.items.map(item=>{const Icon=icons[item.kind],key=`${item.kind}:${item.id}`,context=contextFor(item),checked=selection.has(context);return <article key={key} className={checked?"selected":""}><label><input type="checkbox" checked={checked} onChange={()=>selection.toggle(context)}/></label><button onClick={()=>item.kind!=="person"&&openSearchResult(item)}><Icon size={18}/><span><small>{item.eyebrow}</small><b>{item.title}</b><em>{item.meta}</em>{item.intentReason&&<i>{item.intentReason}</i>}</span></button></article>})}</section>):<div className="empty"><b>검색 결과가 없습니다.</b><p>프로젝트 코드, WBS, 문서명, 번호, 담당자 이름을 함께 검색해 보세요.</p></div>}</main>
  </section>;
  if(embedded&&!visible)return null;
  return embedded?<div className="wv2-search-workspace" style={workspaceStyle}>{content}</div>:<div className="wv2-search-backdrop" onClick={closeSearch}>{content}</div>;
}
