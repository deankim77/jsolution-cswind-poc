"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {Layers3,X} from "lucide-react";
import {PartBomWorkspace} from "./part-bom-workspace";
import "./bom-central-tab-bridge.css";

type Part={id:string;partNumber:string;name:string;partType:string};
type BomTab={partId:string;partNumber:string;name:string};
type BomCopiedResult={id:string;partNumber:string;name:string};

function ensureContentHost(parent:HTMLElement){
  let host=parent.querySelector<HTMLElement>(":scope > .bom-central-content-host");
  if(!host){host=document.createElement("div");host.className="bom-central-content-host";parent.appendChild(host)}
  return host;
}
function ensureTabHost(parent:HTMLElement){
  let host=parent.querySelector<HTMLElement>(":scope > .bom-central-tab-host");
  if(!host){host=document.createElement("span");host.className="bom-central-tab-host";parent.appendChild(host)}
  return host;
}

export default function BomCentralTabBridge(){
  const [tabHost,setTabHost]=useState<HTMLElement|null>(null);
  const [contentHost,setContentHost]=useState<HTMLElement|null>(null);
  const [tabs,setTabs]=useState<BomTab[]>([]);
  const [activeId,setActiveId]=useState("");
  const [parts,setParts]=useState<Part[]>([]);

  useEffect(()=>{
    const attachContent=()=>{
      const content=document.querySelector<HTMLElement>(".wv2-content");
      if(content)setContentHost(ensureContentHost(content));
      else setContentHost(null);
      if(tabHost&&!tabHost.isConnected)setTabHost(null);
    };
    attachContent();
    const observer=new MutationObserver(attachContent);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[tabHost]);

  const activateBom=(partId:string)=>{
    const nav=document.querySelector<HTMLElement>(".wv2-work-tabs");
    const content=document.querySelector<HTMLElement>(".wv2-content");
    nav?.classList.add("bom-central-active");
    content?.classList.add("bom-central-active");
    setActiveId(partId);
  };
  const deactivateBom=()=>{
    document.querySelector<HTMLElement>(".wv2-work-tabs")?.classList.remove("bom-central-active");
    document.querySelector<HTMLElement>(".wv2-content")?.classList.remove("bom-central-active");
    setActiveId("");
  };

  const loadParts=async(force=false)=>{
    if(parts.length&&!force)return parts;
    try{
      const response=await fetch("/api/product-data",{cache:"no-store"});
      const data=await response.json();
      const next=(data.parts||[]) as Part[];
      setParts(next);
      return next;
    }catch{return [] as Part[]}
  };

  const openPartRecord=(part:Part)=>{
    const nav=document.querySelector<HTMLElement>(".wv2-work-tabs");
    if(nav&&!tabHost)setTabHost(ensureTabHost(nav));
    setTabs(current=>current.some(tab=>tab.partId===part.id)?current:[...current,{partId:part.id,partNumber:part.partNumber,name:part.name}]);
    activateBom(part.id);
  };

  const openPart=async(partNumber:string)=>{
    const all=await loadParts();
    const part=all.find(item=>item.partNumber===partNumber);
    if(part)openPartRecord(part);
  };

  const openPartId=async(partId:string)=>{
    let all=await loadParts();
    let part=all.find(item=>item.id===partId);
    if(!part){all=await loadParts(true);part=all.find(item=>item.id===partId)}
    if(part)openPartRecord(part);
  };

  const handleBomCopied=(result:BomCopiedResult)=>{
    const part={id:result.id,partNumber:result.partNumber,name:result.name,partType:"TOP_ITEM"};
    setParts(current=>current.some(item=>item.id===part.id)?current:[...current,part]);
    openPartRecord(part);
  };

  useEffect(()=>{
    const openRequested=(event:Event)=>{const partId=(event as CustomEvent<{partId?:string}>).detail?.partId;if(partId)void openPartId(partId)};
    window.addEventListener("v2-open-part-bom",openRequested);
    return()=>window.removeEventListener("v2-open-part-bom",openRequested);
  },[parts,tabHost]);

  useEffect(()=>{
    const decorateProjectBom=()=>{
      const table=document.querySelector<HTMLElement>(".project-plm-table.bom");
      if(!table)return;
      const head=table.querySelector<HTMLElement>(":scope > .head");
      if(head&&!head.querySelector(".bom-central-project-head")){
        const cell=document.createElement("span");cell.className="bom-central-project-head";cell.textContent="액션";head.appendChild(cell);
      }
      table.querySelectorAll<HTMLElement>(":scope > button").forEach(row=>{
        if(row.querySelector(".bom-central-project-open"))return;
        const cell=document.createElement("span");cell.className="bom-central-project-open";cell.textContent="BOM 열기";row.appendChild(cell);
      });
    };
    decorateProjectBom();
    const observer=new MutationObserver(decorateProjectBom);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    const handler=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      if(!target)return;
      const libraryButton=target.closest(".pbw-bom-cell button");
      if(libraryButton&&!target.closest(".bom-central-content-host")){
        const row=libraryButton.closest(".pbw-part-table > article");
        const partNumber=row?.querySelector<HTMLElement>(":scope > b")?.textContent?.trim();
        if(partNumber){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openPart(partNumber)}
        return;
      }
      const projectRow=target.closest(".project-plm-table.bom > button");
      if(projectRow){
        const partNumber=projectRow.querySelector<HTMLElement>(":scope > span:nth-child(3)")?.textContent?.trim();
        if(partNumber){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void openPart(partNumber)}
        return;
      }
      const workspaceButton=target.closest(".wv2-work-tabs button");
      if(workspaceButton&&!workspaceButton.classList.contains("bom-central-work-tab"))deactivateBom();
    };
    document.addEventListener("click",handler,true);
    return()=>document.removeEventListener("click",handler,true);
  },[parts,tabHost]);

  useEffect(()=>{
    const nav=document.querySelector<HTMLElement>(".wv2-work-tabs");
    const content=document.querySelector<HTMLElement>(".wv2-content");
    nav?.classList.toggle("bom-central-active",Boolean(activeId));
    content?.classList.toggle("bom-central-active",Boolean(activeId));
  },[activeId]);

  const closeTab=(partId:string)=>{
    const index=tabs.findIndex(tab=>tab.partId===partId);
    const remaining=tabs.filter(tab=>tab.partId!==partId);
    setTabs(remaining);
    if(activeId===partId){
      const next=remaining[Math.max(0,index-1)]||remaining[0];
      if(next)activateBom(next.partId);else deactivateBom();
    }
    if(!remaining.length){tabHost?.remove();setTabHost(null)}
  };

  if(!contentHost)return null;
  const activeTab=tabs.find(tab=>tab.partId===activeId);
  return <>
    {tabHost&&createPortal(<>{tabs.map(tab=><button key={tab.partId} type="button" className={`bom-central-work-tab ${activeId===tab.partId?"active":""}`} title={`${tab.partNumber} · ${tab.name}`} onClick={()=>activateBom(tab.partId)}><Layers3 size={18}/><span>BOM · {tab.partNumber}</span><i role="button" aria-label={`${tab.partNumber} BOM 탭 닫기`} onClick={event=>{event.stopPropagation();closeTab(tab.partId)}}><X size={18}/></i></button>)}</>,tabHost)}
    {activeTab&&createPortal(<div className="bom-central-editor-host"><PartBomWorkspace key={activeTab.partId} initialRootId={activeTab.partId} onBomCopied={handleBomCopied}/></div>,contentHost)}
  </>;
}
