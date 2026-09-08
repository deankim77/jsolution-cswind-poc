"use client";

import { useEffect } from "react";

const textOf=(element:Element|null)=>element?.textContent?.replace(/\s+/g," ").trim()||"";

function normalizePersistedWorkspace(){
  try{
    const raw=window.localStorage.getItem("jsolution-workspace-tabs");
    if(!raw)return;
    const parsed=JSON.parse(raw) as {tabs?:Array<{key?:string;label?:string;view?:string}>;active?:string};
    const tabs=(parsed.tabs??[]).filter(tab=>tab.view!=="wbs-editor"&&!String(tab.key||"").startsWith("wbs-editor")&&!String(tab.label||"").includes("WBS 편집"));
    const active=String(parsed.active||"").startsWith("wbs-editor")?"wbs":parsed.active;
    window.localStorage.setItem("jsolution-workspace-tabs",JSON.stringify({...parsed,tabs,active}));
  }catch{/* Ignore invalid device-local workspace state. */}
}

export default function WbsEditNavigationFix(){
  useEffect(()=>{
    normalizePersistedWorkspace();

    const syncWorkspaceTabs=()=>{
      const editing=Boolean(document.querySelector(".project-editor-shell"));
      const tabs=Array.from(document.querySelectorAll(".workspace-tab")) as HTMLElement[];
      tabs.forEach(tab=>{
        const label=textOf(tab.querySelector(".workspace-tab-label"));
        const editor=label.includes("WBS 편집");
        const schedule=label.includes("일정 · WBS");
        if(editor){
          tab.classList.add("wbs-editor-workspace-hidden");
          tab.setAttribute("aria-hidden","true");
        }
        if(schedule)tab.classList.toggle("wbs-editor-workspace-active",editing);
      });
    };

    const handler=(event:MouseEvent)=>{
      const target=event.target as HTMLElement;
      const button=target.closest("button") as HTMLButtonElement|null;
      if(!button)return;
      if(!button.closest(".unified-wbs-host"))return;
      const label=textOf(button);
      if(!label.includes("WBS 편집"))return;

      const native=document.querySelector(".wbs-content > .wbs-board .wbs-edit-button, .wbs-content .wbs-edit-button") as HTMLButtonElement|null;
      if(!native||native===button)return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      native.click();
    };

    syncWorkspaceTabs();
    const observer=new MutationObserver(syncWorkspaceTabs);
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("click",handler,true);

    return()=>{
      observer.disconnect();
      document.removeEventListener("click",handler,true);
      (Array.from(document.querySelectorAll(".workspace-tab")) as HTMLElement[]).forEach(tab=>tab.classList.remove("wbs-editor-workspace-active"));
    };
  },[]);

  return null;
}
