"use client";

import type { ReactNode } from "react";
import CommonCalendarView from "./common-calendar-view";
import CommonGanttView from "./common-gantt-view";
import CommonKanbanView from "./common-kanban-view";
import CommonTimelineView from "./common-timeline-view";
import WorkViewSwitcher,{type WorkView} from "./work-view-switcher";
import type { WorkTaskScope,WorkTaskViewModel } from "./work-task-view-model";

type Props={
  scope:WorkTaskScope;
  view:WorkView;
  options:Array<{value:WorkView;label:string}>;
  tasks:WorkTaskViewModel[];
  onViewChange:(view:WorkView)=>void;
  onOpenTask?:(task:WorkTaskViewModel)=>void;
  onStatusChange?:(task:WorkTaskViewModel,status:WorkTaskViewModel["status"])=>void|Promise<void>;
  onScheduleChange?:(task:WorkTaskViewModel,plannedStart:string,plannedEnd:string,autoShiftSuccessors:boolean)=>void|Promise<void>;
  selectedTaskIds?:string[];
  board?:ReactNode;
  editor?:ReactNode;
  loading?:boolean;
  error?:string;
};

export default function WorkViewShell({scope,view,options,tasks,onViewChange,onOpenTask,onStatusChange,onScheduleChange,selectedTaskIds=[],board,editor,loading,error}:Props){
  const body=loading?<div className="common-work-view-state">업무 데이터를 불러오는 중입니다.</div>:error?<div className="common-work-view-state error">{error}</div>:view==="kanban"?<CommonKanbanView scope={scope} tasks={tasks} onOpenTask={onOpenTask} onStatusChange={onStatusChange}/>:view==="timeline"?<CommonTimelineView tasks={tasks} onOpenTask={onOpenTask}/>:view==="calendar"?<CommonCalendarView tasks={tasks} onOpenTask={onOpenTask}/>:view==="gantt"?<CommonGanttView tasks={tasks} onOpenTask={onOpenTask} onScheduleChange={onScheduleChange}/>:view==="editor"?editor:board;
  return <section className="common-work-view-shell"><header className="common-work-view-head"><WorkViewSwitcher value={view} options={options} onChange={onViewChange}/>{selectedTaskIds.length>0&&<span className="common-work-ai-count">AI 선택 {selectedTaskIds.length}</span>}</header><div className="common-work-view-body">{body||<div className="common-work-view-state">이 View에 연결된 화면이 없습니다.</div>}</div></section>;
}
