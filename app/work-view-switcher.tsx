"use client";

import { CalendarDays,Check,Columns3,GanttChartSquare,LayoutList,PanelTop,Rows3 } from "lucide-react";

export type WorkView="board"|"timeline"|"gantt"|"kanban"|"calendar"|"editor"|"list";
type Option={value:WorkView;label:string};
type Props={value:WorkView;options:Option[];onChange:(value:WorkView)=>void;ariaLabel?:string};
const icons={board:Rows3,timeline:PanelTop,gantt:GanttChartSquare,kanban:Columns3,calendar:CalendarDays,editor:LayoutList,list:LayoutList} as const;

export default function WorkViewSwitcher({value,options,onChange,ariaLabel="업무 보기 전환"}:Props){
  return <div className="work-view-switcher" role="tablist" aria-label={ariaLabel}>{options.map(option=>{const Icon=icons[option.value];return <button key={option.value} type="button" role="tab" aria-selected={value===option.value} className={value===option.value?"active":""} onClick={()=>onChange(option.value)}><Icon size={15}/><span>{option.label}</span></button>})}</div>;
}

export function WorkTaskSelectionButton({selected,onToggle}:{selected:boolean;onToggle:()=>void}){
  return <button type="button" className={`work-task-selection ${selected?"selected":""}`} aria-pressed={selected} onClick={event=>{event.stopPropagation();onToggle();}}>{selected?<Check size={12}/>:<span/>}</button>;
}

export const projectWorkViewOptions:Option[]=[{value:"board",label:"보드"},{value:"timeline",label:"타임라인"},{value:"gantt",label:"간트"},{value:"kanban",label:"칸반"},{value:"calendar",label:"캘린더"},{value:"editor",label:"WBS 편집"}];
export const myWorkViewOptions:Option[]=[{value:"list",label:"리스트"},{value:"kanban",label:"칸반"},{value:"calendar",label:"캘린더"}];
