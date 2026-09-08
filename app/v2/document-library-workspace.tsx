"use client";

import {lazy,Suspense,useEffect,useRef,useState} from "react";
import {FileImage,FileSpreadsheet,FileText,FileType2,Filter,Plus,RefreshCw,Upload,X} from "lucide-react";
import type {V2Project} from "./project-workspaces";
import {useAiContextSelection} from "./ai-context-selection";
import {CommonProjectSelector} from "./common-project-selector";
import {drawingTypeLabel} from "./drawing-type-label";
import {FilterChipGroup,FilterSection,FilterSelect,type WorkspaceFilterConfig} from "./workspace-filter-panel";
import type {DocumentPreviewDeliverable,DocumentPreviewTab,DocumentPreviewVersion} from "./document-preview-renderer";

const DocumentPreviewRenderer=lazy(()=>import("./document-preview-renderer"));

type ModuleTask={id:string;wbsCode:string;kind:string;name:string};
type LibraryMode="document"|"drawing";
type DocumentFilters={review:string;required:string;source:string;category:string};
type Deliverable=DocumentPreviewDeliverable&{
  projectCode?:string;
  projectName?:string;
  taskId?:string;
  taskCode?:string;
  taskName?:string;
  type?:string;
  required?:boolean|number;
  status:string;
  source:string;
  revisionCount:number;
  drawingType?:string;
};
type DeliverableVersion=DocumentPreviewVersion&{
  taskId?:string;
  note?:string;
  createdAt:number;
  createdBy?:string;
};
type ListResponse={deliverables?:Deliverable[];versions?:DeliverableVersion[];total?:number;categories?:string[];error?:string};

type Props={
  project:V2Project|null;
  projects:V2Project[];
  tasks:ModuleTask[];
  initialDeliverableId?:string;
  onInitialOpened?:()=>void;
  onOpenTask:(projectId:string,taskId:string)=>void;
  onAddDeliverable:(projectId:string,taskId:string,mode?:"deliverable"|"drawing",deliverableId?:string)=>void;
  onOpenFilter?:(config:WorkspaceFilterConfig)=>void;
  libraryMode?:LibraryMode;
  onLibraryModeChange?:(mode:LibraryMode)=>void;
  onOpenDetail?:(deliverableId:string)=>void;
  refreshVersion?:number;
};

const emptyDocumentFilters:DocumentFilters={review:"",required:"",source:"",category:""};
const bytes=(value:number)=>value>=1024*1024?`${(value/1024/1024).toFixed(1)} MB`:value>=1024?`${Math.round(value/1024)} KB`:`${value||0} B`;
const iconFor=(name:string)=>/\.(png|jpe?g|gif|webp|svg)$/i.test(name)?FileImage:/\.xlsx?$/i.test(name)?FileSpreadsheet:/\.(docx?|pdf|pptx?)$/i.test(name)?FileType2:FileText;
const isDrawing=(item:Deliverable)=>item.documentKind==="drawing";
const statusLabel=(status:string)=>status==="approved"?"승인":status==="rejected"?"반려":"등록 완료";
const categoryLabel=(value?:string)=>{const text=(value||"").trim();if(!text)return "카테고리 미지정";const parts=text.split(/\s*(?:>|\/|›|→)\s*/).filter(Boolean);return parts[parts.length-1]||text};
const formatCreatedAt=(value?:number)=>{if(!value)return "작성일 미상";const date=new Date(value>1_000_000_000_000?value:value*1000);if(Number.isNaN(date.getTime()))return "작성일 미상";const pad=(n:number)=>String(n).padStart(2,"0");return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`};

export default function DocumentLibraryWorkspace({project,projects,tasks,initialDeliverableId,onInitialOpened,onOpenTask,onAddDeliverable,onOpenFilter,libraryMode="document",onLibraryModeChange,onOpenDetail,refreshVersion=0}:Props){
  const selection=useAiContextSelection("문서 · 산출물");
  const [items,setItems]=useState<Deliverable[]>([]);
  const [versions,setVersions]=useState<DeliverableVersion[]>([]);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState("");
  const [tabs,setTabs]=useState<DocumentPreviewTab[]>([]);
  const [activeTab,setActiveTab]=useState("library");
  const [query,setQuery]=useState("");
  const [debouncedQuery,setDebouncedQuery]=useState("");
  const [projectFilter,setProjectFilter]=useState("");
  const [filters,setFilters]=useState<DocumentFilters>(emptyDocumentFilters);
  const [draftFilters,setDraftFilters]=useState<DocumentFilters>(emptyDocumentFilters);
  const [filterOpen,setFilterOpen]=useState(false);
  const [categories,setCategories]=useState<string[]>([]);
  const [total,setTotal]=useState(0);
  const viewerRef=useRef<HTMLDivElement|null>(null);
  const handledInitialDeliverableRef=useRef("");

  const latestFor=(deliverableId:string)=>versions.find(version=>version.deliverableId===deliverableId);
  const activeFilterCount=Object.values(filters).filter(Boolean).length;
  const draftActiveCount=Object.values(draftFilters).filter(Boolean).length;
  const matchesQuery=(item:Deliverable,version?:DeliverableVersion,search=debouncedQuery)=>{const key=search.trim().toLowerCase();if(!key)return true;return `${item.name} ${item.type||""} ${item.projectCode||""} ${item.projectName||""} ${item.taskCode||""} ${item.taskName||""} ${item.drawingCode||""} ${version?.fileName||""} ${version?.createdBy||""}`.toLowerCase().includes(key)};

  useEffect(()=>{
    const timer=window.setTimeout(()=>setDebouncedQuery(query.trim()),300);
    return()=>window.clearTimeout(timer);
  },[query]);

  useEffect(()=>{
    const controller=new AbortController();
    const started=performance.now();
    const params=new URLSearchParams({documentKind:libraryMode,registration:"completed"});
    if(projectFilter)params.set("projectId",projectFilter);
    if(filters.review)params.set("review",filters.review);
    if(filters.required)params.set("required",filters.required);
    if(filters.source)params.set("source",filters.source);
    if(filters.category)params.set("category",filters.category);
    setLoading(true);
    setNotice("");
    console.info("[DOCUMENT_CLIENT] fetch-start",{libraryMode,at:Math.round(started)});
    fetch(`/api/deliverables?${params.toString()}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{
        const data=await response.json() as ListResponse;
        console.info("[DOCUMENT_CLIENT] fetch-response",{libraryMode,status:response.status,duration:Math.round(performance.now()-started)});
        if(!response.ok)throw new Error(data.error||"산출물을 불러오지 못했습니다.");
        return data;
      })
      .then(data=>{
        const nextVersions=data.versions??[];
        const registered=(data.deliverables??[]).filter(item=>nextVersions.some(version=>version.deliverableId===item.id));
        registered.sort((a,b)=>(nextVersions.find(version=>version.deliverableId===b.id)?.createdAt??0)-(nextVersions.find(version=>version.deliverableId===a.id)?.createdAt??0));
        setVersions(nextVersions);
        setItems(registered);
        setCategories(data.categories??[]);
      })
      .catch(reason=>{
        if(reason instanceof DOMException&&reason.name==="AbortError")return;
        setItems([]);
        setVersions([]);
        setTotal(0);
        setNotice(reason instanceof Error?reason.message:"산출물을 불러오지 못했습니다.");
      })
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[libraryMode,refreshVersion,projectFilter,filters]);

  const visibleItems=items.filter(item=>matchesQuery(item,latestFor(item.id)));
  useEffect(()=>setTotal(visibleItems.length),[items,versions,debouncedQuery]);

  useEffect(()=>{
    if(!filterOpen||!onOpenFilter)return;
    let alive=true;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      const params=new URLSearchParams({documentKind:libraryMode,registration:"completed"});
      if(projectFilter)params.set("projectId",projectFilter);
      if(draftFilters.review)params.set("review",draftFilters.review);
      if(draftFilters.required)params.set("required",draftFilters.required);
      if(draftFilters.source)params.set("source",draftFilters.source);
      if(draftFilters.category)params.set("category",draftFilters.category);
      void fetch(`/api/deliverables?${params.toString()}`,{cache:"no-store",signal:controller.signal})
        .then(async response=>{const data=await response.json() as ListResponse;if(!response.ok)throw new Error(data.error||"필터 결과를 불러오지 못했습니다.");return data})
        .then(data=>{
          if(!alive)return;
          const nextVersions=data.versions??[];
          const resultCount=(data.deliverables??[]).filter(item=>{const latest=nextVersions.find(version=>version.deliverableId===item.id);return Boolean(latest)&&matchesQuery(item,latest)}).length;
          onOpenFilter({
            eyebrow:"DOCUMENT FILTER",
            title:"문서 · 산출물 상세 필터",
            description:"등록된 문서를 상태, 생성 구분, 필수 여부와 카테고리로 찾습니다.",
            resultCount,
            activeCount:draftActiveCount,
            onCancel:()=>setFilterOpen(false),
            onApply:()=>{setFilters({...draftFilters});setFilterOpen(false)},
            onReset:()=>setDraftFilters({...emptyDocumentFilters}),
            content:<>
              <FilterSection title="상태"><FilterChipGroup options={[{value:"all",label:"전체"},{value:"pending",label:"미승인"},{value:"approved",label:"승인"},{value:"rejected",label:"반려"}]} selected={[draftFilters.review||"all"]} onToggle={value=>setDraftFilters(current=>({...current,review:value==="all"?"":value}))}/></FilterSection>
              <FilterSection title="생성 구분"><FilterChipGroup options={[{value:"all",label:"전체"},{value:"planned",label:"계획 산출물"},{value:"ad_hoc",label:"추가 산출물"},{value:"ai",label:"AI 문서"}]} selected={[draftFilters.source||"all"]} onToggle={value=>setDraftFilters(current=>({...current,source:value==="all"?"":value}))}/></FilterSection>
              <FilterSection title="필수 여부"><FilterChipGroup options={[{value:"all",label:"전체"},{value:"required",label:"필수"},{value:"optional",label:"선택"}]} selected={[draftFilters.required||"all"]} onToggle={value=>setDraftFilters(current=>({...current,required:value==="all"?"":value}))}/></FilterSection>
              <FilterSelect label="문서 카테고리" value={draftFilters.category} allLabel="전체 카테고리" options={categories.map(value=>({value,label:value}))} onChange={value=>setDraftFilters(current=>({...current,category:value}))}/>
            </>,
          });
        })
        .catch(()=>undefined);
    },250);
    return()=>{alive=false;window.clearTimeout(timer);controller.abort()};
  },[filterOpen,draftFilters,draftActiveCount,categories,debouncedQuery,projectFilter,libraryMode,onOpenFilter]);

  const loadVersionHistory=async(deliverableId:string)=>{
    const response=await fetch(`/api/deliverables?deliverableId=${encodeURIComponent(deliverableId)}`,{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Revision 이력을 불러오지 못했습니다.");
    const history=(data.versions??[]) as DeliverableVersion[];
    if(data.deliverable)setItems(current=>current.map(item=>item.id===deliverableId?{...item,...data.deliverable}:item));
    setVersions(current=>[...current.filter(version=>version.deliverableId!==deliverableId),...history]);
    return history;
  };

  const openPreview=(item:Deliverable,version=latestFor(item.id))=>{
    if(!version){setNotice("미리볼 Revision이 없습니다.");return}
    const id=`preview:${item.id}`;
    setTabs(current=>current.some(tab=>tab.id===id)?current.map(tab=>tab.id===id?{...tab,versionId:version.id,title:item.name,projectId:item.projectId}:tab):[...current,{id,projectId:item.projectId,deliverableId:item.id,title:item.name,versionId:version.id}]);
    setActiveTab(id);
    void loadVersionHistory(item.id).catch(reason=>setNotice(reason instanceof Error?reason.message:"Revision 이력을 불러오지 못했습니다."));
  };

  useEffect(()=>{
    const handler=(event:Event)=>{
      const detail=(event as CustomEvent<{deliverableId?:string;versionId?:string}>).detail;
      const item=items.find(row=>row.id===detail?.deliverableId);
      if(!item)return;
      const local=detail?.versionId?versions.find(version=>version.id===detail.versionId):latestFor(item.id);
      if(local){openPreview(item,local);return}
      void loadVersionHistory(item.id).then(history=>openPreview(item,detail?.versionId?history.find(version=>version.id===detail.versionId):history[0])).catch(()=>undefined);
    };
    window.addEventListener("v2-open-document-preview",handler);
    return()=>window.removeEventListener("v2-open-document-preview",handler);
  },[items,versions]);

  useEffect(()=>{
    if(!initialDeliverableId){handledInitialDeliverableRef.current="";return}
    if(!items.length||handledInitialDeliverableRef.current===initialDeliverableId)return;
    const item=items.find(row=>row.id===initialDeliverableId);
    if(!item)return;
    handledInitialDeliverableRef.current=initialDeliverableId;
    const latest=latestFor(item.id);
    if(latest)openPreview(item,latest);
    else void loadVersionHistory(item.id).then(history=>openPreview(item,history[0]));
    onInitialOpened?.();
  },[initialDeliverableId,items]);

  const closeTab=(id:string)=>{
    setTabs(current=>current.filter(tab=>tab.id!==id));
    if(activeTab===id)setActiveTab("library");
  };
  const updateTabVersion=(id:string,versionId:string)=>setTabs(current=>current.map(tab=>tab.id===id?{...tab,versionId}:tab));
  const active=tabs.find(tab=>tab.id===activeTab);
  const registrationProject=project||projects[0]||null;

  const getTasks=async(target:V2Project)=>{
    if(target.id===project?.id&&tasks.length)return tasks;
    const response=await fetch(`/api/projects/${target.id}/wbs`,{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Task를 불러오지 못했습니다.");
    return (data.tasks??[]) as ModuleTask[];
  };

  const openRegistration=async(mode:"deliverable"|"drawing")=>{
    if(!registrationProject){setNotice("등록할 프로젝트를 선택해 주세요.");return}
    try{
      const available=await getTasks(registrationProject);
      const task=available.find(row=>row.kind==="task");
      if(!task){setNotice("연결할 Task가 없습니다.");return}
      setActiveTab("library");
      onLibraryModeChange?.(mode==="drawing"?"drawing":"document");
      onAddDeliverable(registrationProject.id,task.id,mode);
    }catch(reason){setNotice(reason instanceof Error?reason.message:"Task를 불러오지 못했습니다.")}
  };

  const contextFor=(item:Deliverable)=>{
    const latest=latestFor(item.id);
    return {id:item.id,kind:isDrawing(item)?"도면":"문서",title:item.name,meta:`${item.projectCode||"프로젝트 미지정"} · ${item.taskCode||"WBS 미지정"} · ${latest?`Rev.${latest.revision}`:"Revision 없음"}`,fileName:latest?.fileName,revision:latest?.revision,fileAttached:Boolean(latest)};
  };

  const registerRevision=(item:DocumentPreviewDeliverable)=>{
    const target=items.find(row=>row.id===item.id);
    if(target?.taskId){onAddDeliverable(target.projectId,target.taskId,isDrawing(target)?"drawing":"deliverable",target.id);return}
    onOpenDetail?.(item.id);
  };

  return <section className="wv2-module wv2-document-workspace">
    <header className="wv2-module-head">
      <div><small>DOCUMENT · DELIVERABLE · PREVIEW</small><h1>문서 · 산출물</h1><p>시스템에 실제 등록된 문서를 빠르게 찾고 확인합니다.</p></div>
      <div className="wv2-module-head-actions"><button disabled={!registrationProject} onClick={()=>void openRegistration("drawing")}><FileText size={18}/>도면 등록</button><button className="primary" disabled={!registrationProject} onClick={()=>void openRegistration("deliverable")}><Upload size={18}/>추가 산출물 등록</button></div>
    </header>

    <nav className="wv2-preview-tabs">
      <button className={activeTab==="library"&&libraryMode==="document"?"active":""} onClick={()=>{setActiveTab("library");onLibraryModeChange?.("document")}}><FileText size={18}/>문서 라이브러리</button>
      <button className={activeTab==="library"&&libraryMode==="drawing"?"active":""} onClick={()=>{setActiveTab("library");onLibraryModeChange?.("drawing")}}><FileText size={18}/>도면 라이브러리</button>
      {tabs.map(tab=><button key={tab.id} className={activeTab===tab.id?"active":""} onClick={()=>setActiveTab(tab.id)}><span>{tab.title}</span><X size={18} onClick={event=>{event.stopPropagation();closeTab(tab.id)}}/></button>)}
      <button className="add" onClick={()=>setActiveTab("library")}><Plus size={18}/></button>
    </nav>

    {notice&&<p className="wv2-module-notice">{notice}</p>}

    {active?
      <Suspense fallback={<div className="wv2-preview-empty"><RefreshCw className="wv2-spin" size={24}/><b>미리보기를 여는 중…</b></div>}>
        <DocumentPreviewRenderer projectId={active.projectId} tab={active} item={items.find(item=>item.id===active.deliverableId)} versions={versions.filter(version=>version.deliverableId===active.deliverableId)} onVersion={versionId=>updateTabVersion(active.id,versionId)} onRegisterRevision={registerRevision} viewerRef={viewerRef}/>
      </Suspense>
      :<>
        <div className="wv2-module-toolbar">
          <label><FileText size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="산출물·카테고리·파일명·프로젝트·WBS·작성자 검색"/></label>
          <button className={activeFilterCount?"active":""} onClick={()=>{setDraftFilters({...filters});setFilterOpen(true)}}><Filter size={18}/>상세 필터{activeFilterCount>0&&<em>{activeFilterCount}</em>}</button>
          <CommonProjectSelector compact projects={projects} value={projectFilter} onChange={setProjectFilter} allLabel="전체 프로젝트"/>
          <span>{total}개 문서</span>
        </div>
        {loading&&!items.length?<div className="wv2-preview-empty"><RefreshCw className="wv2-spin" size={25}/><b>등록 문서를 불러오는 중…</b></div>
        :<div className="wv2-document-table wv2-preview-document-table">
          <header><span className="select"><input type="checkbox" checked={Boolean(visibleItems.length)&&visibleItems.every(item=>selection.has(contextFor(item)))} onChange={()=>visibleItems.every(item=>selection.has(contextFor(item)))?selection.clear():visibleItems.forEach(item=>{if(!selection.has(contextFor(item)))selection.toggle(contextFor(item))})}/></span><span>산출물</span><span>프로젝트 · WBS</span><span>작성자 · 작성일</span><span>Revision</span><span>상태</span><span/></header>
          {visibleItems.map(item=>{const latest=latestFor(item.id),Icon=latest?iconFor(latest.fileName):FileText,drawing=isDrawing(item);return <article key={item.id} onClick={()=>onOpenDetail?.(item.id)}>
            <span className="select"><input type="checkbox" checked={selection.has(contextFor(item))} onClick={event=>event.stopPropagation()} onChange={()=>selection.toggle(contextFor(item))}/></span>
            <button className="name"><Icon size={18}/><span><b>{item.name}</b><small>{drawing?`${item.drawingCode||"도면코드"} · ${drawingTypeLabel(item.drawingType)}`:categoryLabel(item.type)}</small></span></button>
            <button className="wv2-document-task"><b>{item.projectName||"프로젝트 미지정"}{item.projectCode?` · ${item.projectCode}`:""}</b><small>{item.taskName?`${item.taskName}${item.taskCode?` · ${item.taskCode}`:""}`:"WBS 미지정"}</small></button>
            <span className="wv2-document-author"><b>{latest?.createdBy||"작성자 미상"}</b><small>{formatCreatedAt(latest?.createdAt)}</small></span>
            <button className="wv2-revision-link">{latest?<><b>Rev.{String(latest.revision).padStart(2,"0")}</b><small>{latest.fileName}</small></>:"—"}</button>
            <span className="wv2-document-status"><i className="submitted">{statusLabel(item.status)}</i></span>
            <button type="button" className="wv2-document-wbs-link" disabled={!item.taskId} onClick={event=>{event.stopPropagation();if(item.taskId)onOpenTask(item.projectId,item.taskId)}}>WBS 이동</button>
            <button type="button" className="wv2-document-preview-link" disabled={!latest} onClick={event=>{event.stopPropagation();if(latest)openPreview(item,latest)}}>미리보기</button>
          </article>})}
        </div>}
      </>}
  </section>;
}
