"use client";

import { CalendarDays,ChevronLeft,ChevronRight } from "lucide-react";
import { useMemo,useState } from "react";
import type { WorkTaskViewModel } from "./work-task-view-model";

type Props={tasks:WorkTaskViewModel[];onOpenTask?:(task:WorkTaskViewModel)=>void};
const pad=(value:number)=>String(value).padStart(2,"0");
const keyOf=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;

export default function CommonCalendarView({tasks,onOpenTask}:Props){
  const [cursor,setCursor]=useState(()=>new Date());
  const year=cursor.getFullYear(),month=cursor.getMonth();
  const first=new Date(year,month,1),last=new Date(year,month+1,0);
  const start=new Date(year,month,1-first.getDay());
  const days=Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date;});
  const byDate=useMemo(()=>{
    const map=new Map<string,WorkTaskViewModel[]>();
    for(const task of tasks.filter(item=>item.kind==="task")){
      for(const value of [task.plannedStart,task.plannedEnd]){
        if(!value)continue;const list=map.get(value)||[];if(!list.some(item=>item.id===task.id))list.push(task);map.set(value,list);
      }
    }
    return map;
  },[tasks]);
  const move=(delta:number)=>setCursor(new Date(year,month+delta,1));

  return <section className="common-calendar-view" aria-label="업무 캘린더">
    <header><div><strong>{year}년 {month+1}월</strong><small>시작일·마감일·Gate 일정을 월 단위로 확인합니다.</small></div><div><button type="button" onClick={()=>move(-1)} aria-label="이전 달"><ChevronLeft size={15}/></button><button type="button" onClick={()=>setCursor(new Date())}>오늘</button><button type="button" onClick={()=>move(1)} aria-label="다음 달"><ChevronRight size={15}/></button></div></header>
    <div className="common-calendar-weekdays">{["일","월","화","수","목","금","토"].map(day=><span key={day}>{day}</span>)}</div>
    <div className="common-calendar-grid">{days.map(date=>{const key=keyOf(date),items=byDate.get(key)||[],outside=date.getMonth()!==month,today=key===keyOf(new Date());return <article key={key} className={`${outside?"outside":""} ${today?"today":""}`}><b>{date.getDate()}</b><div>{items.slice(0,4).map(task=><button type="button" key={task.id} className={`${task.isDelayed?"delayed":""} ${task.taskType==="gate"?"gate":""}`} onClick={()=>onOpenTask?.(task)}><span>{task.wbsCode}</span><strong>{task.name}</strong></button>)}{items.length>4&&<small>+{items.length-4}건</small>}</div></article>})}</div>
    {!last&&<CalendarDays size={14}/>} 
  </section>;
}
