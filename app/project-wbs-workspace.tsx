"use client";

import { useMemo,useState } from "react";
import { AlertTriangle,ChevronDown,ChevronRight,FileText,GanttChartSquare,ListFilter,Pencil,Play,Search,Target } from "lucide-react";
import useProjectWorkTasks from "./use-project-work-tasks";
import WorkViewShell from "./work-view-shell";
import { projectWorkViewOptions,type WorkView } from "./work-view-switcher";
import type { WorkTaskViewModel } from "./work-task-view-model";

type Project={id:string;code?:string;name:string;status?:string;startDate?:string;endDate?:string};
type Props={
  project:Project|null|undefined;
  onOpenTask?:(task:WorkTaskViewModel)=>void;
  onOpenDeliverables?:(task:WorkTaskViewModel)=>void;
  onOpenIssues?:(task:WorkTaskViewModel)=>void;
  onOpenEditor?:()=>void;
};

type QuickFilter="all"|"active"|"delayed"|"issue"|"completed";

function Board({tasks,onOpenTask,onOpenDeliverables,onOpenIssues}:{tasks:WorkTaskViewModel[];onOpenTask?:(task:WorkTaskViewModel)=>void;onOpenDeliverables?:(task:WorkTaskViewModel)=>void;onOpenIssues?:(task:WorkTaskViewModel)=>void}){
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<QuickFilter>("all");
  const [collapsed,setCollapsed]=useState<Set<string>>(()=>new Set());
  const parentCodes=useMemo(()=>new Set(tasks.map(task=>task.wbsCode.split(".").slice(0,-1).join(".")).filter(Boolean)),[tasks]);
  const visible=useMemo(()=>{
    const keyword=query.trim().toLowerCase();
    return tasks.filter(task=>{
      const parts=task.wbsCode.split(".");
      const ancestors=parts.slice(0,-1).map((_,index)=>parts.slice(0,index+1).join("."));
      if(ancestors.some(code=>collapsed.has(code)))return false;
      if(keyword&&!`${task.wbsCode} ${task.name} ${task.assigneeName||""} ${task.roleCode||""}`.toLowerCase().includes(keyword))return false;
      if(task.kind==="summary")return true;
      if(filter==="active")return task.status==="in_progress"||task.status==="review";
      if(filter==="delayed")return task.isDelayed;
      if(filter==="issue")return task.issueCount>0;
      if(filter==="completed")return task.status==="completed";
      return true;
    });
  },[tasks,query,filter,collapsed]);
  const counts={all:tasks.filter(task=>task.kind==="task").length,active:tasks.filter(task=>task.kind==="task"&&(task.status==="in_progress"||task.status==="review")).length,delayed:tasks.filter(task=>task.kind==="task"&&task.isDelayed).length,issue:tasks.filter(task=>task.kind==="task"&&task.issueCount>0).length,completed:tasks.filter(task=>task.kind==="task"&&task.status==="completed").length};
  const labels:Record<QuickFilter,string>={all:"전체",active:"진행 중",delayed:"지연",issue:"이슈",completed:"완료"};
  return <section className="project-wbs-board panel">
    <div className="project-wbs-board-toolbar"><div>{(Object.keys(labels) as QuickFilter[]).map(value=><button key={value} className={filter===value?"active":""} onClick={()=>setFilter(value)}>{labels[value]}<em>{counts[value]}</em></button>)}</div><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="WBS, Task명, 담당자 검색"/></label><span><ListFilter size={14}/> 실행 Task {counts.all}건</span></div>
    <div className="project-wbs-board-head"><span>WBS / 업무</span><span>산출물</span><span>이슈</span><span>담당자</span><span>기간</span><span>진척률</span><span>상태</span><span/></div>
    <div className="project-wbs-board-rows">{visible.map(task=>{
      const hasChildren=parentCodes.has(task.wbsCode),expanded=!collapsed.has(task.wbsCode);
      return <article key={task.id} className={`${task.kind} ${task.isDelayed?"delayed":""}`} onClick={()=>onOpenTask?.(task)}>
        <div className="project-wbs-task" style={{paddingLeft:10+(task.level-1)*18}}>{hasChildren?<button type="button" onClick={event=>{event.stopPropagation();setCollapsed(current=>{const next=new Set(current);next.has(task.wbsCode)?next.delete(task.wbsCode):next.add(task.wbsCode);return next})}}>{expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>:<span/>}<b>{task.wbsCode}</b><div><strong>{task.name}</strong><small>{task.kind==="summary"?"그룹 WBS":task.taskType==="gate"?"Gate Task":"실행 Task"}</small></div></div>
        <button type="button" className="project-wbs-count" disabled={!task.deliverableCount} onClick={event=>{event.stopPropagation();onOpenDeliverables?.(task)}}><FileText size={13}/><b>{task.deliverableCount}</b></button>
        <button type="button" className={`project-wbs-count ${task.issueCount?"attention":""}`} disabled={!task.issueCount} onClick={event=>{event.stopPropagation();onOpenIssues?.(task)}}><AlertTriangle size={13}/><b>{task.issueCount}</b></button>
        <span className="project-wbs-owner"><i>{task.assigneeName?.slice(0,1)||"-"}</i>{task.assigneeName||task.roleCode||"미배정"}</span>
        <time>{task.plannedStart&&task.plannedEnd?`${task.plannedStart.slice(5)} ~ ${task.plannedEnd.slice(5)}`:task.plannedEnd||"미정"}</time>
        <div className="project-wbs-progress"><span><i style={{width:`${task.progress}%`}}/></span><b>{task.progress}%</b></div>
        <em className={`project-wbs-status ${task.status}`}>{task.status==="completed"?"완료":task.status==="review"?task.isDelayed?"지연":"검토 · 주의":task.status==="in_progress"?"진행 중":"예정"}</em>
        <button type="button" className="project-wbs-open" onClick={event=>{event.stopPropagation();onOpenTask?.(task)}}>{task.kind==="task"?<Play size={14}/>:<ChevronRight size={14}/>}</button>
      </article>})}{!visible.length&&<div className="common-work-empty">조건에 맞는 WBS Task가 없습니다.</div>}</div>
  </section>;
}

export default function ProjectWbsWorkspace({project,onOpenTask,onOpenDeliverables,onOpenIssues,onOpenEditor}:Props){
  const [view,setView]=useState<WorkView>("board");
  const {tasks,loading,error,updateStatus,updateSchedule}=useProjectWorkTasks(project);
  const executable=tasks.filter(task=>task.kind==="task");
  const progress=executable.length?Math.round(executable.reduce((sum,task)=>sum+task.progress,0)/executable.length):0;
  const delayed=executable.filter(task=>task.isDelayed).length;
  const completed=executable.filter(task=>task.status==="completed").length;
  const endingThisWeek=executable.filter(task=>{if(!task.plannedEnd)return false;const due=new Date(`${task.plannedEnd}T23:59:59`),now=new Date(),limit=new Date(now);limit.setDate(limit.getDate()+7);return due>=now&&due<=limit}).length;
  const board=<Board tasks={tasks} onOpenTask={onOpenTask} onOpenDeliverables={onOpenDeliverables} onOpenIssues={onOpenIssues}/>;
  if(!project)return <div className="content project-wbs-workspace-content"><section className="panel common-work-view-state"><Target size={28}/><strong>프로젝트를 선택해 주세요.</strong><span>프로젝트 목록에서 WBS 열기를 선택하면 실제 WBS 데이터를 표시합니다.</span></section></div>;
  return <div className="content project-wbs-workspace-content">
    <section className="wbs-heading project-wbs-heading"><div><p className="eyebrow"><GanttChartSquare size={15}/> 일정 · WBS</p><h1>{project.name} WBS</h1><p>하나의 WBS 데이터를 보드·타임라인·간트·칸반·캘린더에서 동일하게 관리합니다.</p></div><div className="wbs-heading-actions"><span className="permission-chip">PM · PL 편집 권한</span><button className="wbs-edit-button" onClick={onOpenEditor}><Pencil size={14}/> WBS 편집</button></div></section>
    <section className="wbs-project-context"><span><Target size={15}/></span><strong>{project.name}</strong><em>{project.status==="active"?"진행 중":"준비 중"}</em><small>{project.code||"프로젝트"}{project.startDate&&project.endDate?` · ${project.startDate} ~ ${project.endDate}`:""}</small></section>
    <section className="project-wbs-summary"><article><span>전체 진척률</span><strong>{progress}%</strong><small>실행 Task 평균</small></article><article><span>전체 Task</span><strong>{executable.length}</strong><small>완료 {completed}</small></article><article><span>지연 Task</span><strong className={delayed?"danger-text":""}>{delayed}</strong><small>{delayed?"일정 확인 필요":"지연 없음"}</small></article><article><span>7일 내 마감</span><strong>{endingThisWeek}</strong><small>계획 종료일 기준</small></article></section>
    <WorkViewShell scope="project" view={view} options={projectWorkViewOptions} tasks={tasks} loading={loading} error={error} onViewChange={next=>{if(next==="editor"){onOpenEditor?.();return;}setView(next)}} onOpenTask={onOpenTask} onStatusChange={updateStatus} onScheduleChange={updateSchedule} board={board}/>
  </div>;
}
