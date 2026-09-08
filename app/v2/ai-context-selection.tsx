"use client";

import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from "react";
import {CheckSquare,Sparkles,Trash2,X} from "lucide-react";
import {ConnectedAiPanel,type ContextItem} from "./connected-ai-workspaces";
import "./ai-context-selection-neutral.css";

export type AiSelectionItem=ContextItem&{source:string;projectName?:string;taskName?:string;projectId?:string;taskId?:string;displayMeta?:string};
type SelectionGroups=Record<string,AiSelectionItem[]>;
const EVENT="v2-ai-context-selection";
const EMPTY_GROUPS:SelectionGroups={};
let groups:SelectionGroups={};
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener)};
const getSnapshot=()=>groups;
const getServerSnapshot=()=>EMPTY_GROUPS;

const replaceSource=(source:string,items:AiSelectionItem[])=>{const next={...groups};if(items.length)next[source]=items;else delete next[source];groups=next;emit();if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(EVENT,{detail:{source,items}}))};
const clearAll=()=>{if(!Object.keys(groups).length)return;groups={};emit()};
const uniqueItems=(value:SelectionGroups)=>{const seen=new Set<string>();return Object.values(value).flat().filter(item=>{const key=`${item.kind}:${item.id}`;if(seen.has(key))return false;seen.add(key);return true})};

export function publishAiSelection(source:string,items:ContextItem[]){replaceSource(source,items.map(item=>({...item,source})))}

export function useAiContextSelection(source:string){
  const snapshot=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
  const selected=snapshot[source]??[];
  const toggle=useCallback((item:ContextItem)=>{const current=groups[source]??[];const exists=current.some(row=>row.id===item.id&&row.kind===item.kind);replaceSource(source,exists?current.filter(row=>!(row.id===item.id&&row.kind===item.kind)):[...current,{...item,source}])},[source]);
  const clear=useCallback(()=>replaceSource(source,[]),[source]);
  const has=useCallback((item:ContextItem)=>(groups[source]??[]).some(row=>row.id===item.id&&row.kind===item.kind),[source,snapshot]);
  return {selected,toggle,clear,has};
}

export function AiSelectionBar({onStart}:{onStart:(items:AiSelectionItem[])=>void}){
  const snapshot=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
  const restored=useRef(false);
  const [multiAi,setMultiAi]=useState<{key:number;items:AiSelectionItem[]}|null>(null);
  useEffect(()=>{let cancelled=false;fetch("/api/state?key=v2-ai-context-selection",{cache:"no-store"}).then(response=>response.ok?response.json():Promise.reject()).then(({value}:{value?:SelectionGroups})=>{if(cancelled||!value||typeof value!=="object")return;const next:SelectionGroups={};for(const [source,items] of Object.entries(value)){if(!Array.isArray(items))continue;next[source]=items.filter(item=>item&&typeof item.id==="string"&&typeof item.kind==="string"&&typeof item.title==="string").map(item=>({...item,source}))}groups=next;emit()}).catch(()=>undefined).finally(()=>{restored.current=true});return()=>{cancelled=true}},[]);
  useEffect(()=>{if(!restored.current)return;const timer=window.setTimeout(()=>{void fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:"v2-ai-context-selection",value:snapshot})})},180);return()=>window.clearTimeout(timer)},[snapshot]);
  const items=uniqueItems(snapshot);
  const startAi=()=>{
    if(items.length&&items.every(item=>String(item.kind||"")==="WBS")){onStart(items);return}
    if(items.length>1){setMultiAi({key:Date.now(),items});return}
    if(items.length===1){const item=items[0],kind=String(item.kind||"");if((kind==="PART"||kind==="BOM")&&item.id){window.dispatchEvent(new CustomEvent("v2-open-part-detail",{detail:{partId:item.id,tab:"ai",context:item}}));return}onStart(items)}
  };
  const sameProject=multiAi?(()=>{const names=multiAi.items.map(item=>item.projectName?.trim()).filter(Boolean) as string[];return names.length===multiAi.items.length&&new Set(names).size===1?names[0]:""})():"";
  if(!items.length&&!multiAi)return null;
  return <>
    {items.length>0&&<aside className="wv2-ai-selection-bar"><div><CheckSquare size={20}/><span><b>{items.length}개 항목 선택</b><small>선택한 항목을 하나의 AI 대화 문맥으로 연결</small></span></div><div className="wv2-ai-selection-items">{items.slice(0,4).map(item=><span key={`${item.kind}-${item.id}`}><em>{item.kind}</em>{item.title}</span>)}{items.length>4&&<span>+{items.length-4}</span>}</div><button className="clear" onClick={clearAll}><Trash2 size={18}/>선택 해제</button><button className="primary" onClick={startAi}><Sparkles size={18}/>선택 항목 AI에 추가</button><button className="close" onClick={clearAll} aria-label="선택 바 닫기"><X size={18}/></button></aside>}
    {multiAi&&<aside className="wv2-panel wide"><div className="wv2-resize"/><header><div><small>COMMON AI · MULTI CONTEXT</small><h2>{sameProject||"선택 항목 AI 대화"}</h2><span>{multiAi.items.length}개 항목을 바로 AI 대화 문맥으로 연결했습니다.</span></div><div><button onClick={()=>setMultiAi(null)} aria-label="AI 대화 닫기"><X size={19}/></button></div></header><section className="wv2-panel-body wv2-neutral-ai-content"><div className="wv2-neutral-ai-body"><ConnectedAiPanel project={null} draftRequest={{key:multiAi.key,source:"공통 다중 문맥",prompt:"",contextItems:multiAi.items}}/></div></section></aside>}
  </>;
}
