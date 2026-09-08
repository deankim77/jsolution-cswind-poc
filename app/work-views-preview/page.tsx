"use client";

import { useEffect,useState } from "react";
import { ArrowLeft,Bot,ChevronDown,Layers3,MousePointer2 } from "lucide-react";
import ProjectWbsWorkspace from "../project-wbs-workspace";
import MyWorkWorkspace from "../my-work-workspace";
import CommonAiChatPanel from "../common-ai-chat-panel";
import type { WorkTaskViewModel } from "../work-task-view-model";
import "./work-views-preview.css";

type Project={id:string;code:string;name:string;status:string;startDate:string;endDate:string;memberCount:number};
const taskKey=(task:WorkTaskViewModel)=>`${task.projectId||task.projectName}:${task.id}`;

export default function WorkViewsPreviewPage(){
  const [projects,setProjects]=useState<Project[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [mode,setMode]=useState<"project"|"my-work">("project");
  const [selectionMode,setSelectionMode]=useState(true);
  const [selectedTasks,setSelectedTasks]=useState<WorkTaskViewModel[]>([]);
  const [notice,setNotice]=useState("");
  useEffect(()=>{fetch("/api/projects",{cache:"no-store"}).then(response=>response.json()).then((data:{projects?:Project[]})=>{const items=data.projects||[];setProjects(items);setSelectedId(items[0]?.id||"")}).catch(()=>setNotice("프로젝트 목록을 불러오지 못했습니다."))},[]);
  const project=projects.find(item=>item.id===selectedId)||null;
  const explain=(text:string)=>{setNotice(text);window.setTimeout(()=>setNotice(""),1800)};
  const openTask=(task:WorkTaskViewModel)=>{
    if(!selectionMode){explain(`${task.wbsCode} · ${task.name}`);return;}
    const key=taskKey(task);
    setSelectedTasks(current=>current.some(item=>taskKey(item)===key)?current.filter(item=>taskKey(item)!==key):[...current,task]);
  };
  const contextItems=selectedTasks.map(task=>({id:taskKey(task),kind:"WBS",title:`${task.wbsCode} · ${task.name}`,meta:`${task.projectName} · ${task.assigneeName||task.roleCode||"미배정"} · ${task.plannedStart||"미정"} ~ ${task.plannedEnd||"미정"} · ${task.progress}%`}));
  return <main className="work-views-preview-page">
    <header className="work-views-preview-header"><a href="/"><ArrowLeft size={16}/> 기존 PMS</a><div><Layers3 size={17}/><strong>공통 Work View 검증</strong><span>실제 DB 연결 · 개발용</span></div><nav><button className={mode==="project"?"active":""} onClick={()=>setMode("project")}>프로젝트 WBS</button><button className={mode==="my-work"?"active":""} onClick={()=>setMode("my-work")}>MY WORK</button></nav><button className={`preview-ai-select-mode ${selectionMode?"active":""}`} onClick={()=>setSelectionMode(current=>!current)}><MousePointer2 size={15}/> AI 선택 모드 {selectionMode?"ON":"OFF"}</button>{mode==="project"&&<label><span>프로젝트</span><select value={selectedId} onChange={event=>setSelectedId(event.target.value)}>{projects.map(item=><option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select><ChevronDown size={14}/></label>}</header>
    <section className={`work-views-preview-body ${selectedTasks.length?"with-ai":""}`}><div className="work-views-preview-main">{mode==="project"?<ProjectWbsWorkspace project={project} onOpenTask={openTask} onOpenDeliverables={openTask} onOpenIssues={openTask} onOpenEditor={()=>explain("본 화면 연결 후 기존 Native WBS 편집기로 이동합니다.")}/>:<MyWorkWorkspace onOpenTask={openTask}/>}</div>{selectedTasks.length>0&&<aside className="work-views-preview-ai"><header><Bot size={16}/><strong>AI Context · {selectedTasks.length}건</strong><small>다른 View로 이동해도 선택이 유지됩니다.</small></header><CommonAiChatPanel items={contextItems} projectName={mode==="project"?(project?.name||"현재 프로젝트"):"MY WORK 선택 업무"} source={mode==="project"?"프로젝트 업무":"MY WORK"} contextType={mode} contextTitle="선택 업무 AI 분석" onRemove={item=>setSelectedTasks(current=>current.filter(task=>taskKey(task)!==item.id))} onClear={()=>setSelectedTasks([])}/></aside>}</section>
    {notice&&<div className="work-views-preview-toast">{notice}</div>}
  </main>;
}
