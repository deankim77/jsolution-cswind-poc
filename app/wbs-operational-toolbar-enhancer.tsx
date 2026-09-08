"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type TaskFilter="all"|"normal"|"gate"|"summary";

function isSummary(row:HTMLElement){return row.classList.contains("summary");}
function isGate(row:HTMLElement){return Boolean(row.querySelector(".gantt-lane>i.gate"))||Array.from(row.children).some(child=>child.textContent?.trim()==="Gate Task");}
function matches(row:HTMLElement,filter:TaskFilter){
  if(filter==="all")return true;
  if(filter==="summary")return isSummary(row);
  if(isSummary(row))return false;
  if(filter==="gate")return isGate(row);
  return !isGate(row);
}

export default function WbsOperationalToolbarEnhancer(){
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [filter,setFilter]=useState<TaskFilter>("all");
  const [counts,setCounts]=useState({visible:0,total:0});

  useEffect(()=>{
    const attach=()=>{
      const root=document.querySelector(".wbs-content.unified-wbs-active") as HTMLElement|null;
      const toolbar=root?.querySelector(".unified-wbs-tabs") as HTMLElement|null;
      if(toolbar)toolbar.classList.add("shared-wbs-toolbar");
      setHost(toolbar||null);
    };
    attach();
    const observer=new MutationObserver(()=>window.requestAnimationFrame(attach));
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    return()=>{
      observer.disconnect();
      host?.classList.remove("shared-wbs-toolbar");
    };
  },[host]);

  useEffect(()=>{
    if(!host)return;
    const root=host.closest(".unified-wbs-shell") as HTMLElement|null;
    if(!root)return;
    const apply=()=>{
      const gridRows=Array.from(root.querySelectorAll(".unified-grid-body>.unified-grid-row")) as HTMLElement[];
      const ganttRows=Array.from(root.querySelectorAll(".unified-gantt-body>.unified-gantt-row")) as HTMLElement[];
      const rows=gridRows.length?gridRows:ganttRows;
      let visible=0;
      rows.forEach(row=>{
        const show=matches(row,filter);
        row.style.display=show?"":"none";
        if(show)visible+=1;
      });
      setCounts({visible,total:rows.length});
    };
    apply();
    const observer=new MutationObserver(()=>window.requestAnimationFrame(apply));
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    return()=>{
      observer.disconnect();
      const rows=Array.from(root.querySelectorAll(".unified-grid-row,.unified-gantt-row")) as HTMLElement[];
      rows.forEach(row=>{row.style.display="";});
    };
  },[host,filter]);

  const label=useMemo(()=>counts.total?`${counts.visible}/${counts.total}`:"0/0",[counts]);
  if(!host)return null;

  return createPortal(<>
    <span className="shared-wbs-tree-meta"><b>WBS 트리</b><small>{label}</small></span>
    <label className="shared-wbs-task-filter"><span>Task Type</span><select value={filter} onChange={event=>setFilter(event.target.value as TaskFilter)}><option value="all">전체</option><option value="normal">일반 Task</option><option value="gate">Gate Task</option><option value="summary">그룹 WBS</option></select></label>
  </>,host);
}
