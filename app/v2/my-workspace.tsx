"use client";

/* eslint-disable react-hooks/exhaustive-deps */
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {AlertTriangle,Check,ChevronRight,Clock3,FileText,Filter,Search} from "lucide-react";
import {FilterChipGroup,FilterDateRange,FilterSection,FilterSelect,FilterText,type WorkspaceFilterConfig} from "./workspace-filter-panel";
import {useAiContextSelection} from "./ai-context-selection";
import {readMyWorkPageCache,readMyWorkSummaryCache,writeMyWorkPageCache,writeMyWorkSummaryCache} from "./my-work-data-store";

type Task={id:string;projectId:string;projectCode:string;projectName:string;wbsCode:string;name:string;kind:string;status:string;progress:number;plannedStart?:string;plannedEnd?:string;assigneeName?:string;roleCode?:string;completionActor?:string;deliverableCount:number;issueCount:number;deliverableActionCount:number;unregisteredDeliverableCount:number;issueActionCount:number;issueTypeActionCount:number;riskActionCount:number;collaborationActionCount:number};
type ProjectOption={id:string;code:string;name:string};
export type MyWorkScope="all"|"review"|"today"|"active"|"delayed"|"deliverable"|"issue"|"workflow";
type MyWorkSummary={total:number;active:number;today:number;delayed:number;review:number;deliverable:number;issue:number};
type MyWorkResponse={tasks:Task[];projects:ProjectOption[];total:number;reviewCount:number;openCount:number;summary?:MyWorkSummary;hasMore:boolean;error?:string};
type MyWorkSummaryResponse={summary?:MyWorkSummary;error?:string};
type MyWorkFilters={projectId:string;statuses:string[];actions:string[];deliverableStatuses:string[];issueTypes:string[];role:string;dueFrom:string;dueTo:string};

const PAGE_SIZE=50;
const statusLabel=(status:string)=>status==="completed"?"완료":status==="review"?"승인 대기":status==="active"?"진행 중":status==="hold"?"보류":"예정";
const emptySummary:MyWorkSummary={total:0,active:0,today:0,delayed:0,review:0,deliverable:0,issue:0};
const emptyMyWorkFilters:MyWorkFilters={projectId:"",statuses:[],actions:[],deliverableStatuses:[],issueTypes:[],role:"",dueFrom:"",dueTo:""};
const issueTypesOf=(value:Partial<MyWorkFilters>)=>Array.isArray(value.issueTypes)?value.issueTypes:[];
const deliverableStatusesOf=(value:Partial<MyWorkFilters>)=>Array.isArray(value.deliverableStatuses)?value.deliverableStatuses:[];

export function FilteredMyWorkWorkspace({scope,onScopeChange,onOpenTask,onOpenFilter}:{scope:MyWorkScope;onScopeChange:(scope:MyWorkScope)=>void;onOpenTask:(projectId:string,taskId:string,panel?:"actual"|"deliverable"|"issue")=>void;onOpenFilter:(config:WorkspaceFilterConfig)=>void}){
  const selection=useAiContextSelection("MY WORK");
  const [tasks,setTasks]=useState<Task[]>([]);
  const [projects,setProjects]=useState<ProjectOption[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [hasMore,setHasMore]=useState(false);
  const [error,setError]=useState("");
  const [moreError,setMoreError]=useState("");
  const [total,setTotal]=useState(0);
  const [summary,setSummary]=useState<MyWorkSummary>(emptySummary);
  const [query,setQuery]=useState("");
  const [debouncedQuery,setDebouncedQuery]=useState("");
  const [filterOpen,setFilterOpen]=useState(false);
  const [filters,setFilters]=useState<MyWorkFilters>(emptyMyWorkFilters);
  const [draftFilters,setDraftFilters]=useState<MyWorkFilters>(emptyMyWorkFilters);
  const [draftTotal,setDraftTotal]=useState(0);
  const [draftCounting,setDraftCounting]=useState(false);
  const [workflowCount,setWorkflowCount]=useState(0);
  const moduleRef=useRef<HTMLElement|null>(null);
  const sentinelRef=useRef<HTMLDivElement|null>(null);
  const requestKeyRef=useRef("");
  const perfStartRef=useRef(typeof performance!=="undefined"?performance.now():0);
  const today=new Date().toISOString().slice(0,10);

  useEffect(()=>{console.info("[MY_WORK_CLIENT] mount",Math.round(performance.now()-perfStartRef.current));return()=>console.info("[MY_WORK_CLIENT] unmount",Math.round(performance.now()-perfStartRef.current))},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>setDebouncedQuery(query.trim()),250);return()=>window.clearTimeout(timer)},[query]);
  useEffect(()=>{const controller=new AbortController();fetch("/api/workflows/my-work?scope=pending",{cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(data=>setWorkflowCount(Number(data.counts?.pending||0))).catch(()=>setWorkflowCount(0));return()=>controller.abort()},[]);

  const requestKey=useMemo(()=>JSON.stringify({q:debouncedQuery,scope,filters,today}),[debouncedQuery,scope,filters,today]);
  const buildParams=useCallback((value:MyWorkFilters,limit:number,offset:number)=>{
    const params=new URLSearchParams({limit:String(limit),offset:String(offset),scope,today,includeSummary:"0"});
    if(debouncedQuery)params.set("q",debouncedQuery);
    if(value.projectId)params.set("projectId",value.projectId);
    if(value.statuses.length)params.set("statuses",value.statuses.join(","));
    if(value.actions.length)params.set("actions",value.actions.join(","));
    const deliverableStatuses=deliverableStatusesOf(value);if(deliverableStatuses.length)params.set("deliverableStatuses",deliverableStatuses.join(","));
    const issueTypes=issueTypesOf(value);if(issueTypes.length)params.set("issueTypes",issueTypes.join(","));
    if(value.role)params.set("role",value.role);
    if(value.dueFrom)params.set("dueFrom",value.dueFrom);
    if(value.dueTo)params.set("dueTo",value.dueTo);
    return params;
  },[debouncedQuery,scope,today]);
  const fetchPage=useCallback(async(offset:number,signal?:AbortSignal)=>{
    const started=performance.now();
    console.info("[MY_WORK_CLIENT] fetch-start",{offset,at:Math.round(started-perfStartRef.current)});
    const response=await fetch(`/api/my-work?${buildParams(filters,PAGE_SIZE,offset).toString()}`,{cache:"no-store",signal});
    console.info("[MY_WORK_CLIENT] fetch-response",{offset,at:Math.round(performance.now()-perfStartRef.current),duration:Math.round(performance.now()-started)});
    const data=await response.json() as MyWorkResponse;
    if(!response.ok)throw new Error(data.error||"MY WORK를 불러오지 못했습니다.");
    return data;
  },[buildParams,filters]);

  useEffect(()=>{
    const controller=new AbortController();
    requestKeyRef.current=requestKey;
    const cached=readMyWorkPageCache<MyWorkResponse>(requestKey);
    setLoadingMore(false);setError("");setMoreError("");
    if(cached){
      const data=cached.value;
      setTasks(data.tasks??[]);setProjects(data.projects??[]);setTotal(Number(data.total||0));setHasMore(Boolean(data.hasMore));setLoading(false);
      if(cached.fresh)return()=>controller.abort();
    }else{
      setLoading(true);setTasks([]);
    }
    fetchPage(0,controller.signal).then(data=>{
      writeMyWorkPageCache(requestKey,data);
      console.info("[MY_WORK_CLIENT] before-setTasks",{at:Math.round(performance.now()-perfStartRef.current),count:(data.tasks??[]).length});
      setTasks(data.tasks??[]);setProjects(data.projects??[]);setTotal(Number(data.total||0));setHasMore(Boolean(data.hasMore));
      queueMicrotask(()=>console.info("[MY_WORK_CLIENT] after-setTasks-microtask",{at:Math.round(performance.now()-perfStartRef.current)}));
    }).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError"))setError(reason instanceof Error?reason.message:"MY WORK를 불러오지 못했습니다.")}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[requestKey,fetchPage]);

  useEffect(()=>{
    const controller=new AbortController();
    const cached=readMyWorkSummaryCache<MyWorkSummaryResponse>(requestKey);
    if(cached){
      setSummary(cached.value.summary??emptySummary);
      if(cached.fresh)return()=>controller.abort();
    }
    const params=buildParams(filters,1,0);
    fetch(`/api/my-work/summary?${params.toString()}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json() as MyWorkSummaryResponse;if(!response.ok)throw new Error(data.error||"MY WORK 요약을 불러오지 못했습니다.");return data})
      .then(data=>{writeMyWorkSummaryCache(requestKey,data);setSummary(data.summary??emptySummary)})
      .catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError")&&!cached)setSummary(emptySummary)});
    return()=>controller.abort();
  },[requestKey,buildParams,filters]);

  const loadMore=useCallback(async()=>{
    if(loading||loadingMore||!hasMore)return;
    const activeKey=requestKeyRef.current;
    setLoadingMore(true);setMoreError("");
    try{
      const data=await fetchPage(tasks.length);
      if(requestKeyRef.current!==activeKey)return;
      setTasks(current=>{const known=new Set(current.map(task=>task.id));return [...current,...(data.tasks??[]).filter(task=>!known.has(task.id))]});
      setTotal(Number(data.total||0));setHasMore(Boolean(data.hasMore));
    }catch(reason){if(requestKeyRef.current===activeKey)setMoreError(reason instanceof Error?reason.message:"추가 업무를 불러오지 못했습니다.")}
    finally{if(requestKeyRef.current===activeKey)setLoadingMore(false)}
  },[fetchPage,hasMore,loading,loadingMore,tasks.length]);

  useEffect(()=>{
    if(loading||!tasks.length)return;
    const frame=window.requestAnimationFrame(()=>console.info("[MY_WORK_CLIENT] painted",{at:Math.round(performance.now()-perfStartRef.current),count:tasks.length}));
    return()=>window.cancelAnimationFrame(frame);
  },[loading,tasks.length]);

  useEffect(()=>{
    const target=sentinelRef.current;if(!target||loading||!hasMore)return;
    const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void loadMore()},{root:moduleRef.current,rootMargin:"320px 0px"});
    observer.observe(target);return()=>observer.disconnect();
  },[hasMore,loading,loadingMore,loadMore,tasks.length]);

  useEffect(()=>{
    if(!filterOpen)return;
    const controller=new AbortController();
    setDraftCounting(true);
    const timer=window.setTimeout(()=>{
      fetch(`/api/my-work?${buildParams(draftFilters,10,0).toString()}`,{cache:"no-store",signal:controller.signal})
        .then(async response=>{const data=await response.json() as MyWorkResponse;if(!response.ok)throw new Error(data.error||"상세필터 결과를 집계하지 못했습니다.");return data})
        .then(data=>setDraftTotal(Number(data.total||0)))
        .catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError"))setDraftTotal(0)})
        .finally(()=>{if(!controller.signal.aborted)setDraftCounting(false)});
    },350);
    return()=>{window.clearTimeout(timer);controller.abort()};
  },[filterOpen,draftFilters,buildParams]);
  const activeFilterCount=Number(Boolean(filters.projectId))+filters.statuses.length+filters.actions.length+deliverableStatusesOf(filters).length+issueTypesOf(filters).length+Number(Boolean(filters.role))+Number(Boolean(filters.dueFrom))+Number(Boolean(filters.dueTo));
  const contextFor=(task:Task)=>({id:task.id,kind:"WBS",title:`${task.wbsCode} ${task.name}`,meta:`${task.projectCode} ${task.projectName} · ${statusLabel(task.status)} · 마감 ${task.plannedEnd||"미정"}`});
  const toggleDraftStatus=(status:string)=>{setDraftCounting(true);setDraftFilters(current=>({...current,statuses:current.statuses.includes(status)?current.statuses.filter(item=>item!==status):[...current.statuses,status]}))};
  const toggleDraftAction=(action:string)=>{setDraftCounting(true);setDraftFilters(current=>({...current,actions:current.actions.includes(action)?current.actions.filter(item=>item!==action):[...current.actions,action]}))};
  const toggleDraftDeliverableStatus=(status:string)=>{setDraftCounting(true);setDraftFilters(current=>status==="all"?{...current,deliverableStatuses:[]}:{...current,deliverableStatuses:deliverableStatusesOf(current).includes(status)?deliverableStatusesOf(current).filter(item=>item!==status):[...deliverableStatusesOf(current),status]})};
  const toggleDraftIssueType=(issueType:string)=>{setDraftCounting(true);setDraftFilters(current=>issueType==="all"?{...current,issueTypes:[]}:{...current,issueTypes:issueTypesOf(current).includes(issueType)?issueTypesOf(current).filter(item=>item!==issueType):[...issueTypesOf(current),issueType]})};
  const draftActiveCount=draftFilters.statuses.length+draftFilters.actions.length+deliverableStatusesOf(draftFilters).length+issueTypesOf(draftFilters).length+Number(Boolean(draftFilters.projectId))+Number(Boolean(draftFilters.role))+Number(Boolean(draftFilters.dueFrom))+Number(Boolean(draftFilters.dueTo));
  const hubCards=([
    {key:"all",label:"처리할 업무",count:summary.total,description:"완료 제외",icon:<Check size={18}/>},
    {key:"active",label:"정상 진행",count:summary.active,description:"일정 내 진행",icon:<Clock3 size={18}/>},
    {key:"today",label:"오늘 마감",count:summary.today,description:"오늘 처리",icon:<Clock3 size={18}/>},
    {key:"delayed",label:"지연 업무",count:summary.delayed,description:"즉시 확인",icon:<AlertTriangle size={18}/>},
    {key:"review",label:"승인 대기",count:summary.review,description:"완료 검토",icon:<Check size={18}/>},
    {key:"deliverable",label:"산출물 처리",count:summary.deliverable,description:"등록·검토·승인 필요",icon:<FileText size={18}/>},
    {key:"issue",label:"이슈·협업",count:summary.issue,description:"내 담당 미처리",icon:<AlertTriangle size={18}/>},
    {key:"workflow",label:"워크플로우",count:workflowCount,description:"승인·검토·합의·처리",icon:<Check size={18}/>},
  ] as const);

  useEffect(()=>{if(!filterOpen)return;onOpenFilter({eyebrow:"MY WORK FILTER",title:"내 업무 상세 필터",description:"프로젝트, 처리 유형, 산출물 상태, 이슈 구분, 업무 상태와 마감 기간을 조합합니다.",resultCount:draftTotal,resultLoading:draftCounting,activeCount:draftActiveCount,onCancel:()=>setFilterOpen(false),onApply:()=>{if(draftCounting)return;setFilters({...draftFilters,statuses:[...draftFilters.statuses],actions:[...draftFilters.actions],deliverableStatuses:[...deliverableStatusesOf(draftFilters)],issueTypes:[...issueTypesOf(draftFilters)]});setFilterOpen(false)},onReset:()=>{setDraftCounting(true);setDraftFilters({...emptyMyWorkFilters,statuses:[],actions:[],deliverableStatuses:[],issueTypes:[]})},content:<><FilterSelect label="프로젝트" value={draftFilters.projectId} allLabel="전체 프로젝트" options={projects.map(item=>({value:item.id,label:`${item.code} · ${item.name}`}))} onChange={value=>{setDraftCounting(true);setDraftFilters(current=>({...current,projectId:value}))}}/><FilterSection title="처리 유형"><FilterChipGroup options={[["task","담당 Task"],["review","완료 승인"],["deliverable","산출물 처리"],["issue","이슈·리스크·협업"]].map(([value,label])=>({value,label}))} selected={draftFilters.actions} onToggle={toggleDraftAction}/></FilterSection><FilterSection title="산출물 상태"><FilterChipGroup options={[["all","전체"],["pending","등록 예정"],["registered","등록 완료"]].map(([value,label])=>({value,label}))} selected={deliverableStatusesOf(draftFilters).length?deliverableStatusesOf(draftFilters):["all"]} onToggle={toggleDraftDeliverableStatus}/></FilterSection><FilterSection title="이슈 · 리스크 · 협업"><FilterChipGroup options={[["all","전체"],["issue","이슈"],["risk","리스크"],["collaboration","협업"]].map(([value,label])=>({value,label}))} selected={issueTypesOf(draftFilters).length?issueTypesOf(draftFilters):["all"]} onToggle={toggleDraftIssueType}/></FilterSection><FilterSection title="업무 상태"><FilterChipGroup options={[["planned","예정"],["active","진행 중"],["review","승인 대기"],["hold","보류"],["completed","완료"]].map(([value,label])=>({value,label}))} selected={draftFilters.statuses} onToggle={toggleDraftStatus}/></FilterSection><FilterText label="Role · 담당" value={draftFilters.role} placeholder="Role 또는 담당자 검색" onChange={value=>{setDraftCounting(true);setDraftFilters(current=>({...current,role:value}))}}/><FilterDateRange label="마감 기간" from={draftFilters.dueFrom} to={draftFilters.dueTo} onFrom={value=>{setDraftCounting(true);setDraftFilters(current=>({...current,dueFrom:value}))}} onTo={value=>{setDraftCounting(true);setDraftFilters(current=>({...current,dueTo:value}))}}/></>})},[filterOpen,draftFilters,draftTotal,draftCounting,projects,onOpenFilter]);

  return <section ref={moduleRef} className="wv2-module wv2-mywork-workspace" onScroll={event=>{const node=event.currentTarget;if(node.scrollHeight-node.scrollTop-node.clientHeight<420)void loadMore()}}><header className="wv2-module-head"><div><small>MY WORK</small><h1>내 업무</h1><p>많은 업무도 처리 유형별로 빠르게 찾아 바로 실행합니다.</p></div></header><div className="wv2-mywork-hub">{hubCards.map(card=><button key={card.key} className={`${scope===card.key?"active":""} ${card.key==="delayed"&&card.count?"risk":""}`} onClick={()=>onScopeChange(card.key)}><i>{card.icon}</i><span><small>{card.label}</small><b>{card.count}</b><em>{card.description}</em></span></button>)}</div><div className="wv2-module-toolbar"><label><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="프로젝트·WBS·업무·산출물·이슈·Role 검색"/></label><select className="wv2-mywork-project-filter" aria-label="프로젝트" value={filters.projectId} onChange={event=>{const projectId=event.target.value;setFilters(current=>({...current,projectId}));setDraftFilters(current=>({...current,projectId}))}}><option value="">전체 프로젝트</option>{projects.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select><button className={activeFilterCount?"active":""} onClick={()=>{setDraftFilters({...filters,statuses:[...filters.statuses],actions:[...filters.actions],deliverableStatuses:[...deliverableStatusesOf(filters)],issueTypes:[...issueTypesOf(filters)]});setDraftTotal(total);setDraftCounting(false);setFilterOpen(true)}}><Filter size={18}/>상세 필터{activeFilterCount>0&&<em>{activeFilterCount}</em>}</button>{scope!=="all"&&<button className="wv2-mywork-scope-clear" onClick={()=>onScopeChange("all")}>유형 필터 해제 ×</button>}<span>{total}개 업무</span></div>{loading?<Empty icon={Clock3} title="내 업무를 불러오는 중…"/>:error?<Empty icon={AlertTriangle} title={error}/>:tasks.length?<div className="wv2-mywork-list">{tasks.map(task=><button key={task.id} className={`${task.status==="review"?"approval":""} ${task.status!=="completed"&&task.progress<100&&Boolean(task.plannedEnd)&&task.plannedEnd!<today?"delayed":""} ${selection.has(contextFor(task))?"ai-selected":""}`} onClick={()=>onOpenTask(task.projectId,task.id,scope==="deliverable"||deliverableStatusesOf(filters).length>0?"deliverable":scope==="issue"||issueTypesOf(filters).length>0?"issue":"actual")}><span className="ai-select" onClick={event=>event.stopPropagation()}><input type="checkbox" checked={selection.has(contextFor(task))} onChange={()=>selection.toggle(contextFor(task))}/></span><span className="project"><small>{task.projectCode}</small><b>{task.projectName}</b></span><span className="task"><small>{task.wbsCode}</small><b>{task.name}</b><em>{task.status==="review"?`${task.completionActor||"PL"} 완료 검토`:task.roleCode||task.assigneeName||"담당"}</em></span><span className="due"><small>마감</small><b>{task.plannedEnd||"미정"}</b></span><span className="linked"><em><FileText size={18}/>{task.deliverableCount||0}</em><em><AlertTriangle size={18}/>{task.issueCount||0}</em></span><span className={`deliverable-state ${!task.deliverableCount?"none":Number(task.unregisteredDeliverableCount||0)>0?"pending":"registered"}`}><small>산출물</small><b>{!task.deliverableCount?"—":Number(task.unregisteredDeliverableCount||0)>0?"등록 예정":"등록 완료"}</b></span><span className="progress"><i><b style={{width:`${task.progress}%`}}/></i><em>{task.progress}%</em></span><span className={`status ${task.status}`}>{statusLabel(task.status)}</span><ChevronRight size={18}/></button>)}<div ref={sentinelRef} className="wv2-mywork-sentinel">{loadingMore?<><Clock3 size={17}/><span>업무를 더 불러오는 중…</span></>:moreError?<><AlertTriangle size={17}/><span>{moreError}</span><button onClick={()=>void loadMore()}>다시 시도</button></>:hasMore?<><span>{tasks.length} / {total}개 표시</span><button onClick={()=>void loadMore()}>다음 50개 불러오기</button></>:total>PAGE_SIZE?<><Check size={17}/><span>전체 {total}개를 불러왔습니다.</span></>:null}</div></div>:<Empty icon={Check} title="조건에 맞는 업무가 없습니다."/>}</section>;
}

function Empty({icon:Icon,title}:{icon:typeof Check;title:string}){return <div className="wv2-module-empty"><Icon size={30}/><b>{title}</b></div>}
