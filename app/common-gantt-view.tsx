"use client";

import { useMemo,useState,type PointerEvent as ReactPointerEvent } from "react";
import { AlertTriangle,ChevronRight,Diamond,Link2,MoveHorizontal } from "lucide-react";
import type { WorkTaskViewModel } from "./work-task-view-model";

type Zoom="fit"|"week"|"month";
type ScheduleChange=(task:WorkTaskViewModel,plannedStart:string,plannedEnd:string,autoShiftSuccessors:boolean)=>void|Promise<void>;
type Props={tasks:WorkTaskViewModel[];onOpenTask?:(task:WorkTaskViewModel)=>void;onScheduleChange?:ScheduleChange};
type Gesture={task:WorkTaskViewModel;mode:"move"|"start"|"end";clientX:number;laneWidth:number;start:string;end:string;draftStart:string;draftEnd:string};
const DAY=86400000,LEFT=300,ROW=48;
function at(value?:string){if(!value)return null;const date=new Date(`${value}T00:00:00`);return Number.isFinite(date.getTime())?date:null;}
function short(value:Date){return `${value.getMonth()+1}/${String(value.getDate()).padStart(2,"0")}`;}
function iso(value:Date){return value.toISOString().slice(0,10);}
function shift(value:string,days:number){const date=at(value)!;date.setDate(date.getDate()+days);return iso(date);}
function duration(start:string,end:string){return Math.max(1,Math.round((at(end)!.getTime()-at(start)!.getTime())/DAY)+1);}

export default function CommonGanttView({tasks,onOpenTask,onScheduleChange}:Props){
  const [zoom,setZoom]=useState<Zoom>("fit");
  const [autoShift,setAutoShift]=useState(true);
  const [gesture,setGesture]=useState<Gesture|null>(null);
  const visible=useMemo(()=>tasks.filter(task=>Boolean(at(task.plannedStart)&&at(task.plannedEnd))),[tasks]);
  const displayTasks=useMemo(()=>visible.map(task=>gesture?.task.id===task.id?{...task,plannedStart:gesture.draftStart,plannedEnd:gesture.draftEnd}:task),[visible,gesture]);
  const startTimes=displayTasks.map(task=>at(task.plannedStart)!.getTime());
  const endTimes=displayTasks.map(task=>at(task.plannedEnd)!.getTime());
  const today=new Date();today.setHours(0,0,0,0);
  const min=startTimes.length?Math.min(...startTimes,today.getTime()):today.getTime();
  const max=endTimes.length?Math.max(...endTimes,today.getTime()+DAY):today.getTime()+DAY*14;
  const first=new Date(min-DAY*2),last=new Date(max+DAY*2);
  const total=Math.max(1,Math.round((last.getTime()-first.getTime())/DAY)+1);
  const timelineWidth=zoom==="week"?Math.max(900,total*34):zoom==="month"?Math.max(820,total*17):Math.max(760,total*9);
  const tickStep=zoom==="week"?7:zoom==="month"?14:Math.max(7,Math.ceil(total/10));
  const ticks:Array<{date:Date;left:number}>=[];
  for(let day=0;day<total;day+=tickStep){const date=new Date(first);date.setDate(first.getDate()+day);ticks.push({date,left:day/total*100});}
  const todayLeft=((today.getTime()-first.getTime())/DAY/total)*100;
  const byCode=new Map(displayTasks.map((task,index)=>[task.wbsCode,{task,index}]));

  const pos=(task:WorkTaskViewModel)=>{
    const start=at(task.plannedStart)!,end=at(task.plannedEnd)!;
    const left=Math.max(0,((start.getTime()-first.getTime())/DAY/total)*timelineWidth);
    const width=Math.max(task.taskType==="gate"?12:6,Math.min(timelineWidth-left,((end.getTime()-start.getTime())/DAY+1)/total*timelineWidth));
    return {left,width};
  };

  const begin=(event:ReactPointerEvent<HTMLElement>,task:WorkTaskViewModel,mode:Gesture["mode"])=>{
    if(!onScheduleChange||task.kind!=="task"||!task.plannedStart||!task.plannedEnd)return;
    event.preventDefault();event.stopPropagation();
    const lane=event.currentTarget.closest(".common-gantt-lane") as HTMLElement|null;
    setGesture({task,mode,clientX:event.clientX,laneWidth:lane?.clientWidth||timelineWidth,start:task.plannedStart,end:task.plannedEnd,draftStart:task.plannedStart,draftEnd:task.plannedEnd});
    const move=(pointer:PointerEvent)=>{
      setGesture(current=>{
        if(!current||current.task.id!==task.id)return current;
        const delta=Math.round((pointer.clientX-current.clientX)/(current.laneWidth/total));
        if(current.mode==="move")return {...current,draftStart:shift(current.start,delta),draftEnd:shift(current.end,delta)};
        if(current.mode==="start"){
          const next=shift(current.start,delta);return at(next)!.getTime()<=at(current.end)!.getTime()?{...current,draftStart:next}:current;
        }
        const next=shift(current.end,delta);return at(next)!.getTime()>=at(current.start)!.getTime()?{...current,draftEnd:next}:current;
      });
    };
    const up=()=>{
      document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);
      setGesture(current=>{
        if(current&&current.task.id===task.id&&(current.draftStart!==current.start||current.draftEnd!==current.end))void onScheduleChange(task,current.draftStart,current.draftEnd,autoShift);
        return null;
      });
    };
    document.addEventListener("pointermove",move);document.addEventListener("pointerup",up,{once:true});
  };

  return <section className="common-gantt-view" aria-label="프로젝트 간트">
    <header><div><strong>프로젝트 간트</strong><small>계획·실적·선행관계와 지연을 실제 WBS 기준으로 관리합니다.</small></div><div className="common-gantt-tools"><label><input type="checkbox" checked={autoShift} onChange={event=>setAutoShift(event.target.checked)}/><span>후속 일정 자동 조정</span></label><div>{(["week","month","fit"] as Zoom[]).map(value=><button type="button" key={value} className={zoom===value?"active":""} onClick={()=>setZoom(value)}>{value==="week"?"주":value==="month"?"월":"전체"}</button>)}</div></div></header>
    <div className="common-gantt-range"><span>{short(first)} — {short(last)}</span>{onScheduleChange&&<small><MoveHorizontal size={12}/> Bar 이동·양끝 Resize 가능</small>}</div>
    <div className="common-gantt-scroll">
      <div className="common-gantt-head" style={{gridTemplateColumns:`${LEFT}px ${timelineWidth}px`}}><span>WBS / Task</span><div>{ticks.map(({date,left},index)=><b key={`${date.toISOString()}-${index}`} style={{left:`${left}%`}}>{short(date)}</b>)}</div></div>
      <div className="common-gantt-body" style={{width:LEFT+timelineWidth}}>
        {todayLeft>=0&&todayLeft<=100&&<i className="common-gantt-today" style={{left:LEFT+timelineWidth*todayLeft/100}}><em>오늘</em></i>}
        <svg className="common-gantt-dependencies" width={LEFT+timelineWidth} height={displayTasks.length*ROW} aria-hidden="true">
          <defs><marker id="gantt-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
          {displayTasks.map((task,index)=>{if(!task.predecessorCode)return null;const predecessor=byCode.get(task.predecessorCode);if(!predecessor)return null;const from=pos(predecessor.task),to=pos(task);const x1=LEFT+from.left+from.width,x2=LEFT+to.left,y1=predecessor.index*ROW+ROW/2,y2=index*ROW+ROW/2,mid=Math.max(x1+12,(x1+x2)/2);return <path key={`${task.id}-${task.predecessorCode}`} d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2-4}`} markerEnd="url(#gantt-arrow)"/>})}
        </svg>
        {displayTasks.map(task=>{
          const {left,width}=pos(task),gate=task.taskType==="gate";
          return <div role="button" tabIndex={0} className={`common-gantt-row ${task.kind} ${task.isDelayed?"delayed":""} ${gate?"gate":""}`} style={{gridTemplateColumns:`${LEFT}px ${timelineWidth}px 24px`}} key={task.id} onClick={()=>onOpenTask?.(task)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onOpenTask?.(task)}}}>
            <span className="common-gantt-task" style={{paddingLeft:`${Math.max(0,task.level-1)*14+10}px`}}><b>{task.wbsCode}</b><strong>{task.name}</strong><small>{task.assigneeName||task.roleCode||"담당 미지정"}</small></span>
            <span className="common-gantt-lane">
              {gate?<i className="common-gantt-gate" style={{left}} onPointerDown={event=>begin(event,task,"move")} title={`${task.plannedStart} · Gate`}><Diamond size={15}/></i>:<i className={`common-gantt-plan ${gesture?.task.id===task.id?"editing":""}`} style={{left,width}} onPointerDown={event=>begin(event,task,"move")} title={`${task.plannedStart} → ${task.plannedEnd} · ${duration(task.plannedStart!,task.plannedEnd!)}일`}><button type="button" className="gantt-resize start" aria-label="시작일 조정" onPointerDown={event=>begin(event,task,"start")}/><u style={{width:`${Math.max(0,Math.min(100,task.progress))}%`}}/><em>{task.progress}%</em><button type="button" className="gantt-resize end" aria-label="종료일 조정" onPointerDown={event=>begin(event,task,"end")}/></i>}
              {task.predecessorCode&&<small className="common-gantt-predecessor"><Link2 size={11}/>{task.predecessorCode}</small>}{task.isDelayed&&<small className="common-gantt-delay"><AlertTriangle size={11}/>지연</small>}
            </span>
            <ChevronRight size={14}/>
          </div>;
        })}
        {!displayTasks.length&&<div className="common-work-empty">계획 시작일과 종료일이 등록된 Task가 없습니다.</div>}
      </div>
    </div>
  </section>;
}
