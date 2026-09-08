"use client";

import { AlertTriangle,CalendarDays,FileText,UserRound } from "lucide-react";
import { workTaskStatusLabel,workTaskStatusOrder,type WorkTaskStatus,type WorkTaskViewModel } from "./work-task-view-model";

type Props={
  tasks:WorkTaskViewModel[];
  scope:"project"|"my-work";
  onOpenTask?:(task:WorkTaskViewModel)=>void;
  onStatusChange?:(task:WorkTaskViewModel,status:WorkTaskStatus)=>void|Promise<void>;
};

function dateLabel(start?:string,end?:string){
  if(!start&&!end)return "일정 미정";
  if(start&&end)return `${start} → ${end}`;
  return start||end||"일정 미정";
}

export default function CommonKanbanView({tasks,scope,onOpenTask,onStatusChange}:Props){
  const executable=tasks.filter(task=>task.kind==="task");
  return <section className={`common-kanban ${scope}`} aria-label={scope==="project"?"프로젝트 칸반":"MY WORK 칸반"}>
    {workTaskStatusOrder.map(status=>{
      const column=executable.filter(task=>task.status===status);
      return <section className="common-kanban-column" key={status} data-status={status}
        onDragOver={event=>{if(onStatusChange)event.preventDefault()}}
        onDrop={event=>{if(!onStatusChange)return;event.preventDefault();const id=event.dataTransfer.getData("text/work-task-id");const task=executable.find(item=>item.id===id);if(task&&task.status!==status)void onStatusChange(task,status)}}>
        <header><div><strong>{workTaskStatusLabel[status]}</strong><span>{column.length}</span></div>{status==="review"&&<AlertTriangle size={15}/>}</header>
        <div className="common-kanban-cards">
          {column.map(task=><article key={task.id} className={`common-kanban-card ${task.isDelayed?"delayed":""}`} draggable={Boolean(onStatusChange)}
            onDragStart={event=>event.dataTransfer.setData("text/work-task-id",task.id)} onClick={()=>onOpenTask?.(task)}>
            <div className="kanban-card-top"><span>{task.wbsCode}</span>{task.isDelayed&&<em>지연</em>}</div>
            <strong className="kanban-card-title">{task.name}</strong>
            {scope==="my-work"&&<small className="kanban-project">{task.projectName}</small>}
            <div className="kanban-meta"><span><UserRound size={13}/>{task.assigneeName||"미배정"}</span><span><CalendarDays size={13}/>{dateLabel(task.plannedStart,task.plannedEnd)}</span></div>
            <div className="kanban-progress"><div><i style={{width:`${task.progress}%`}}/></div><b>{task.progress}%</b></div>
            <footer><span><FileText size={13}/>{task.deliverableCount}</span><span className={task.issueCount?"attention":""}><AlertTriangle size={13}/>{task.issueCount}</span>{task.roleCode&&<small>{task.roleCode}</small>}</footer>
          </article>)}
          {!column.length&&<div className="common-kanban-empty">해당 업무가 없습니다.</div>}
        </div>
      </section>;
    })}
  </section>;
}
