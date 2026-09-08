"use client";

import { useMemo,useState } from "react";
import { AlertTriangle,CalendarDays,Check,ChevronRight,CircleCheck,Search,UserRound } from "lucide-react";
import useMyWorkTasks from "./use-my-work-tasks";
import WorkViewShell from "./work-view-shell";
import { myWorkViewOptions,type WorkView } from "./work-view-switcher";
import type { WorkTaskViewModel } from "./work-task-view-model";

type Props={onOpenTask?:(task:WorkTaskViewModel)=>void};
type Filter="all"|"today"|"active"|"delayed"|"completed";

function ListView({tasks,onOpenTask}:{tasks:WorkTaskViewModel[];onOpenTask?:(task:WorkTaskViewModel)=>void}){
  const [filter,setFilter]=useState<Filter>("all"),[query,setQuery]=useState("");
  const today=new Date().toISOString().slice(0,10);
  const visible=useMemo(()=>tasks.filter(task=>{
    const q=query.trim().toLowerCase();if(q&&!`${task.name} ${task.projectName} ${task.wbsCode}`.toLowerCase().includes(q))return false;
    if(filter==="today")return task.plannedEnd===today;
    if(filter==="active")return task.status==="in_progress"||task.status==="review";
    if(filter==="delayed")return task.isDelayed;
    if(filter==="completed")return task.status==="completed";
    return true;
  }),[tasks,query,filter,today]);
  const counts={all:tasks.length,today:tasks.filter(task=>task.plannedEnd===today).length,active:tasks.filter(task=>task.status==="in_progress"||task.status==="review").length,delayed:tasks.filter(task=>task.isDelayed).length,completed:tasks.filter(task=>task.status==="completed").length};
  const labels:Record<Filter,string>={all:"전체",today:"오늘",active:"진행 중",delayed:"지연",completed:"완료"};
  return <section className="my-work-list panel"><div className="my-work-list-tools"><div>{(Object.keys(labels) as Filter[]).map(value=><button key={value} className={filter===value?"active":""} onClick={()=>setFilter(value)}>{labels[value]}<em>{counts[value]}</em></button>)}</div><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="업무 또는 프로젝트 검색"/></label></div><div className="my-work-list-head"><span>업무</span><span>프로젝트</span><span>기간</span><span>진척률</span><span>상태</span><span/></div><div className="my-work-list-rows">{visible.map(task=><article key={task.id} className={task.isDelayed?"delayed":""} onClick={()=>onOpenTask?.(task)}><div><b>{task.wbsCode}</b><span><strong>{task.name}</strong><small>{task.roleCode||"담당 Task"}</small></span></div><span className="my-work-project"><strong>{task.projectName}</strong><small>{task.projectCode||"프로젝트"}</small></span><time>{task.plannedStart&&task.plannedEnd?`${task.plannedStart.slice(5)} ~ ${task.plannedEnd.slice(5)}`:task.plannedEnd||"미정"}</time><div className="my-work-progress"><span><i style={{width:`${task.progress}%`}}/></span><b>{task.progress}%</b></div><em className={`my-work-status ${task.status}`}>{task.status==="completed"?"완료":task.status==="review"?task.isDelayed?"지연":"검토 · 주의":task.status==="in_progress"?"진행 중":"예정"}</em><ChevronRight size={15}/></article>)}{!visible.length&&<div className="common-work-empty">조건에 맞는 담당 업무가 없습니다.</div>}</div></section>;
}

export default function MyWorkWorkspace({onOpenTask}:Props){
  const [view,setView]=useState<WorkView>("list");
  const {tasks,user,loading,error,updateStatus}=useMyWorkTasks();
  const today=new Date().toISOString().slice(0,10);
  const dueToday=tasks.filter(task=>task.plannedEnd===today).length,active=tasks.filter(task=>task.status==="in_progress"||task.status==="review").length,delayed=tasks.filter(task=>task.isDelayed).length,completed=tasks.filter(task=>task.status==="completed").length;
  const list=<ListView tasks={tasks} onOpenTask={onOpenTask}/>;
  return <div className="content my-work-workspace-content"><section className="work-heading my-work-heading"><div><p className="eyebrow"><CircleCheck size={15}/> MY WORK</p><h1>나의 모든 업무</h1><p>프로젝트 WBS에서 나에게 배정된 실제 Task를 한곳에서 처리합니다.</p></div><span className="my-work-user"><UserRound size={15}/>{user?.name||"현재 사용자"}</span></section><section className="my-work-summary"><article><span>전체 업무</span><strong>{tasks.length}</strong><small>진행 프로젝트 기준</small></article><article><span>오늘 마감</span><strong>{dueToday}</strong><small>{dueToday?"오늘 확인 필요":"오늘 마감 없음"}</small></article><article><span>진행 · 검토</span><strong>{active}</strong><small>현재 수행 업무</small></article><article><span>지연</span><strong className={delayed?"danger-text":""}>{delayed}</strong><small>완료 {completed}건</small></article></section>{delayed>0&&<section className="my-work-attention"><AlertTriangle size={16}/><span><strong>지연 업무 {delayed}건</strong>프로젝트 후속 일정에 영향을 줄 수 있으니 우선 확인하세요.</span></section>}<WorkViewShell scope="my-work" view={view} options={myWorkViewOptions} tasks={tasks} loading={loading} error={error} onViewChange={setView} onOpenTask={onOpenTask} onStatusChange={updateStatus} board={list}/></div>;
}
