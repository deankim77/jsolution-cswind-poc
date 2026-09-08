"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, GanttChartSquare, Pencil, Play, Sparkles } from "lucide-react";

type Project={id:string;code:string;name:string;customerName?:string;startDate:string;endDate:string;status:string};
type Task={id:string;kind:"summary"|"task";progress:number;status:string;plannedEnd?:string;roleCode?:string;assigneeUserId?:string;deliverables?:Array<{required?:boolean}>};

const textOf=(element:Element|null)=>element?.textContent?.replace(/\s+/g," ").trim()||"";
const statusLabel=(status:string)=>status==="active"?"진행 중":status==="stopped"?"중단":status==="completed"?"완료":"준비 중";
const today=()=>new Date().toISOString().slice(0,10);

function switchToWbs(target:"actual"|"gantt"){
  sessionStorage.setItem("js-wbs-view",target);
  window.dispatchEvent(new CustomEvent("jsolution-wbs-view-change",{detail:target}));
}

function clickLifecycleAction(){
  const button=document.querySelector(".project-wbs-editor-content > .unified-wbs-host .unified-editor-tabs button.primary") as HTMLButtonElement|null;
  button?.click();
}

function nativeTaskFilter(){return document.querySelector(".project-editor-table>header select") as HTMLSelectElement|null;}

export default function WbsEditorInlineShell(){
  const [mount,setMount]=useState<HTMLElement|null>(null);
  const [project,setProject]=useState<Project|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [taskFilter,setTaskFilter]=useState("all");
  const [treeCount,setTreeCount]=useState("");

  useEffect(()=>{
    let frame=0;
    const scan=()=>{
      frame=0;
      const shell=document.querySelector(".project-editor-shell") as HTMLElement|null;
      if(!shell){setMount(null);return;}
      let target=shell.querySelector(":scope > .wbs-editor-inline-head-mount") as HTMLElement|null;
      if(!target){
        target=document.createElement("div");
        target.className="wbs-editor-inline-head-mount";
        shell.insertBefore(target,shell.firstChild);
      }
      setMount(current=>current===target?current:target);
      const native=nativeTaskFilter();
      if(native)setTaskFilter(current=>current===native.value?current:(native.value||"all"));
      const countText=textOf(document.querySelector(".project-editor-table>header small"));
      if(countText){const next=countText.replace(/개 표시/g,"").trim();setTreeCount(current=>current===next?current:next);}
    };
    const scheduleScan=()=>{if(frame)return;frame=window.requestAnimationFrame(scan);};
    scan();
    const observer=new MutationObserver(scheduleScan);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{
      observer.disconnect();
      if(frame)window.cancelAnimationFrame(frame);
    };
  },[]);

  useEffect(()=>{
    if(!mount)return;
    let cancelled=false;
    const load=async()=>{
      const legacyHeader=document.querySelector(".project-editor-header");
      const text=textOf(legacyHeader);
      const code=text.match(/[A-Z]+-\d{4}-\d+/i)?.[0];
      const response=await fetch("/api/projects",{cache:"no-store"});
      if(!response.ok)return;
      const data=await response.json() as {projects?:Project[]};
      const found=(data.projects??[]).find(item=>code&&item.code.toLowerCase()===code.toLowerCase())||(data.projects??[]).find(item=>text.includes(item.name));
      if(!found||cancelled)return;
      setProject(found);
      const wbs=await fetch(`/api/projects/${found.id}/wbs`,{cache:"no-store"});
      if(!wbs.ok||cancelled)return;
      const wbsData=await wbs.json() as {tasks?:Task[]};
      if(!cancelled)setTasks(wbsData.tasks??[]);
    };
    void load();
    return()=>{cancelled=true};
  },[mount]);

  const summary=useMemo(()=>{
    const executable=tasks.filter(task=>task.kind!=="summary");
    const progress=executable.length?Math.round(executable.reduce((sum,task)=>sum+(Number(task.progress)||0),0)/executable.length):0;
    const complete=executable.filter(task=>task.status==="completed"||task.progress>=100).length;
    const active=executable.filter(task=>task.status==="active"||(task.progress>0&&task.progress<100)).length;
    const delayed=executable.filter(task=>task.plannedEnd&&task.plannedEnd<today()&&!(task.status==="completed"||task.progress>=100)).length;
    return {count:executable.length,progress,complete,active,delayed};
  },[tasks]);

  const changeTaskFilter=(value:string)=>{
    setTaskFilter(value);
    const native=nativeTaskFilter();
    if(!native)return;
    const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;
    setter?.call(native,value);
    native.dispatchEvent(new Event("change",{bubbles:true}));
    window.setTimeout(()=>{
      const countText=textOf(document.querySelector(".project-editor-table>header small"));
      if(countText)setTreeCount(countText.replace(/개 표시/g,"").trim());
    },0);
  };

  if(!mount||!project)return null;
  return createPortal(<div className="editor-inline-unified-shell">
    <section className="unified-project-head editor-inline-project-head">
      <div className="unified-project-info"><span><GanttChartSquare size={15}/> PROJECT WBS</span><strong>{project.name}</strong><small>{project.code} · {project.customerName||"거래처 미지정"} · {project.startDate} ~ {project.endDate} · {statusLabel(project.status)} · PM Dean Kim</small></div>
      <div className="unified-kpis"><span><small>전체 진척률</small><b>{summary.progress}%</b></span><span><small>전체 Task</small><b>{summary.count}</b><em>완료 {summary.complete} · 진행 {summary.active}</em></span><span><small>지연 Task</small><b>{summary.delayed}</b></span><span><small>상태</small><b>{statusLabel(project.status)}</b></span></div>
      <div className="unified-ai-summary"><Sparkles size={18}/><div><strong>WBS 계획 편집 중</strong><small>Grid에서 구조를 편집하고 우측 패널에서 일정·Role·담당자·산출물을 조정합니다.</small></div></div>
    </section>
    <div className="unified-wbs-tabs editor-inline-tabs shared-wbs-toolbar">
      <button onClick={()=>switchToWbs("actual")}><Play size={16}/> WBS 실적입력</button>
      <button onClick={()=>switchToWbs("gantt")}><CalendarDays size={16}/> 간트 차트</button>
      <button className="active"><Pencil size={16}/> WBS 편집</button>
      <button className="primary" disabled={project.status==="active"||project.status==="completed"} onClick={clickLifecycleAction}><Play size={16}/>{project.status==="stopped"?"프로젝트 재개":project.status==="active"?"프로젝트 진행중":project.status==="completed"?"프로젝트 완료":"프로젝트 시작"}</button>
      <span className="shared-wbs-tree-meta"><b>WBS 트리</b><small>{treeCount||`${tasks.length}/${tasks.length}`}</small></span>
      <label className="shared-wbs-task-filter"><span>Task Type</span><select value={taskFilter} onChange={event=>changeTaskFilter(event.target.value)}><option value="all">전체</option><option value="normal">일반 Task</option><option value="gate">Gate Task</option><option value="summary">그룹 WBS</option></select></label>
      <span className="unified-period">{project.startDate} ~ {project.endDate}</span>
    </div>
  </div>,mount);
}
