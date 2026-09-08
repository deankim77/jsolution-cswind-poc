"use client";

import { CalendarDays,ChevronRight } from "lucide-react";
import type { WorkTaskViewModel } from "./work-task-view-model";

type Props={
  tasks:WorkTaskViewModel[];
  onOpenTask?:(task:WorkTaskViewModel)=>void;
  selectedTaskIds?:string[];
  onToggleTaskSelection?:(task:WorkTaskViewModel)=>void;
};

function parseDate(value?:string){if(!value)return null;const date=new Date(`${value}T00:00:00`);return Number.isFinite(date.getTime())?date:null;}
function formatDate(value?:string){const date=parseDate(value);return date?`${date.getMonth()+1}/${date.getDate()}`:"미정";}

export default function CommonTimelineView({tasks,onOpenTask}:Props){
  const executable=tasks.filter(task=>task.kind==="task");
  const dated=executable.filter(task=>parseDate(task.plannedStart)&&parseDate(task.plannedEnd));
  const starts=dated.map(task=>parseDate(task.plannedStart)!.getTime());
  const ends=dated.map(task=>parseDate(task.plannedEnd)!.getTime());
  const min=starts.length?Math.min(...starts):Date.now();
  const max=ends.length?Math.max(...ends):min+86400000;
  const span=Math.max(86400000,max-min);

  return <section className="common-timeline-view" aria-label="업무 타임라인">
    <header><div><strong>프로젝트 타임라인</strong><small>담당자와 기간 흐름을 빠르게 확인합니다.</small></div><span><CalendarDays size={14}/>{dated.length}개 일정</span></header>
    <div className="common-timeline-list">
      {executable.map(task=>{
        const start=parseDate(task.plannedStart),end=parseDate(task.plannedEnd);
        const left=start?Math.max(0,Math.min(100,((start.getTime()-min)/span)*100)):0;
        const width=start&&end?Math.max(2,Math.min(100-left,((end.getTime()-start.getTime()+86400000)/span)*100)):0;
        return <button type="button" key={task.id} className={`common-timeline-row ${task.isDelayed?"delayed":""}`} onClick={()=>onOpenTask?.(task)}>
          <span className="common-timeline-task"><b>{task.wbsCode}</b><strong>{task.name}</strong><small>{task.assigneeName||"담당 미지정"}</small></span>
          <span className="common-timeline-lane"><i className="common-timeline-track"/><i className="common-timeline-bar" style={{left:`${left}%`,width:`${width}%`}}><em>{task.progress}%</em></i></span>
          <span className="common-timeline-dates">{formatDate(task.plannedStart)} — {formatDate(task.plannedEnd)}<ChevronRight size={14}/></span>
        </button>;
      })}
      {!executable.length&&<div className="common-work-empty">표시할 실행 Task가 없습니다.</div>}
    </div>
  </section>;
}
