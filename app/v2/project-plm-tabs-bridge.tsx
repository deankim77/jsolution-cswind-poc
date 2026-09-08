"use client";

import {useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {Box,FileText,GitBranch,Image as DrawingIcon} from "lucide-react";
import {drawingTypeLabel} from "./drawing-type-label";
import "./project-plm-tabs-bridge.css";

type Project={id:string;code:string;name:string};
type Task={id:string;wbsCode:string;name:string;kind:string;roleCode?:string;deliverables?:Array<{name:string}>};
type Deliverable={id:string;taskId?:string;name:string;type?:string;required?:number|boolean;status:string;source?:string;revisionCount?:number;documentKind?:string;drawingCode?:string;drawingType?:string;internalDrawingNumber?:string;version?:string};
type Version={deliverableId:string;fileName:string;revision:number};
type BomRow={parentPartId:string;parentNumber:string;parentName:string;childPartId:string;childNumber:string;childName:string;quantity:number;unit:string;note?:string};
type Part={id:string;partNumber:string;name:string;partType:string;revision:string;status:string;rollupCost?:number};
type PlmView="deliverables"|"drawings"|"bom"|null;

type BomGroup={id:string;number:string;name:string;children:BomRow[];level:number;rollupCost:number};

const statusLabel=(value:string)=>value==="approved"?"승인":value==="submitted"?"등록":value==="rejected"?"반려":value==="completed"?"완료":"미등록";
const sourceLabel=(item:Deliverable)=>{
  const source=String(item.source||"").toLowerCase(),type=String(item.type||"").toLowerCase(),name=item.name.toLowerCase();
  if(source.includes("ai")||type.includes("ai")||name.startsWith("ai ")||name.includes("ai 문서"))return "AI 문서";
  if(source==="ad_hoc"||source==="additional")return "추가 산출물";
  return Number(item.required)===1||item.required===true?"필수 산출물":"선택 산출물";
};
const registered=(item:Deliverable,versions:Version[])=>Number(item.revisionCount||0)>0||versions.some(version=>version.deliverableId===item.id)||["submitted","approved","completed"].includes(item.status);

function findButton(root:ParentNode|null,label:string){return [...(root?.querySelectorAll<HTMLButtonElement>("button")||[])].find(button=>button.textContent?.trim().includes(label));}

export default function ProjectPlmTabsBridge(){
  const [tabHost,setTabHost]=useState<HTMLElement|null>(null),[canvasHost,setCanvasHost]=useState<HTMLElement|null>(null);
  const [bomTabHost,setBomTabHost]=useState<HTMLElement|null>(null),[bomBodyHost,setBomBodyHost]=useState<HTMLElement|null>(null);
  const [active,setActive]=useState<PlmView>(null),[project,setProject]=useState<Project|null>(null),[tasks,setTasks]=useState<Task[]>([]);
  const [deliverables,setDeliverables]=useState<Deliverable[]>([]),[versions,setVersions]=useState<Version[]>([]),[parts,setParts]=useState<Part[]>([]),[bom,setBom]=useState<BomRow[]>([]);
  const [loading,setLoading]=useState(false),[error,setError]=useState(""),[selectedBom,setSelectedBom]=useState<BomGroup|null>(null);

  useEffect(()=>{
    const attach=()=>{
      const nav=document.querySelector<HTMLElement>(".wv2-view-tabs"),canvas=document.querySelector<HTMLElement>(".wv2-canvas");
      if(nav){let host=nav.querySelector<HTMLElement>(".project-plm-tab-host");if(!host){host=document.createElement("span");host.className="project-plm-tab-host";const edit=[...nav.querySelectorAll("button")].find(button=>button.textContent?.includes("WBS 편집"));nav.insertBefore(host,edit||null)}setTabHost(host)}else setTabHost(null);
      if(canvas){let host=canvas.querySelector<HTMLElement>(".project-plm-canvas-host");if(!host){host=document.createElement("div");host.className="project-plm-canvas-host";canvas.appendChild(host)}setCanvasHost(host)}else setCanvasHost(null);
    };
    attach();const observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    const nativeClick=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest(".wv2-view-tabs > button");if(button&&!button.closest(".project-plm-tab-host")){setActive(null);setSelectedBom(null)}};
    document.addEventListener("click",nativeClick,true);return()=>document.removeEventListener("click",nativeClick,true);
  },[]);

  useEffect(()=>{
    const canvas=canvasHost?.parentElement;if(!canvas)return;canvas.classList.toggle("project-plm-active",Boolean(active));return()=>canvas.classList.remove("project-plm-active");
  },[active,canvasHost]);

  useEffect(()=>{
    if(!tabHost)return;
    const code=document.querySelector<HTMLElement>(".wv2-project-code")?.textContent?.trim();if(!code){setProject(null);return}
    let cancelled=false;fetch("/api/projects",{cache:"no-store"}).then(response=>response.ok?response.json():Promise.reject()).then(data=>{if(cancelled)return;setProject((data.projects||[]).find((item:Project)=>item.code===code)||null)}).catch(()=>{if(!cancelled)setProject(null)});return()=>{cancelled=true};
  },[tabHost,document.querySelector<HTMLElement>(".wv2-project-code")?.textContent]);

  useEffect(()=>{
    if(!project?.id||!active)return;let cancelled=false;setLoading(true);setError("");
    Promise.all([
      fetch(`/api/projects/${project.id}/wbs`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()),
      fetch(`/api/projects/${project.id}/deliverables`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()),
      active==="bom"?fetch("/api/product-data",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):Promise.resolve({parts:[],bom:[]}),
    ]).then(([wbsData,docData,productData])=>{if(cancelled)return;setTasks(wbsData.tasks||[]);setDeliverables(docData.deliverables||[]);setVersions(docData.versions||[]);setParts(productData.parts||[]);setBom(productData.bom||[])}).catch(()=>{if(!cancelled)setError("프로젝트 PLM 데이터를 불러오지 못했습니다.")}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true};
  },[project?.id,active]);

  const taskMap=useMemo(()=>new Map(tasks.map(task=>[task.id,task])),[tasks]);
  const documentRows=useMemo(()=>deliverables.filter(item=>item.documentKind!=="drawing"),[deliverables]);
  const drawingRows=useMemo(()=>deliverables.filter(item=>item.documentKind==="drawing"),[deliverables]);
  const projectBom=useMemo(()=>bom.filter(row=>String(row.note||"").includes(project?.name||"__no_project__")),[bom,project?.name]);
  const bomGroups=useMemo(()=>{
    const partMap=new Map(parts.map(part=>[part.id,part])),parents=new Map<string,BomRow[]>(),childIds=new Set<string>();
    for(const row of projectBom){parents.set(row.parentPartId,[...(parents.get(row.parentPartId)||[]),row]);childIds.add(row.childPartId)}
    const roots=[...parents.keys()].filter(id=>!childIds.has(id));const levels=new Map<string,number>();const walk=(id:string,level:number)=>{if((levels.get(id)??99)<=level)return;levels.set(id,level);for(const row of parents.get(id)||[])if(parents.has(row.childPartId))walk(row.childPartId,level+1)};roots.forEach(id=>walk(id,1));
    return [...parents.entries()].map(([id,children])=>{const part=partMap.get(id);return {id,number:part?.partNumber||children[0]?.parentNumber||"-",name:part?.name||children[0]?.parentName||"BOM",children,level:levels.get(id)||2,rollupCost:Number(part?.rollupCost||0)}}).sort((a,b)=>a.level-b.level||a.number.localeCompare(b.number));
  },[parts,projectBom]);

  const openTask=(taskId:string,panelLabel="산출물")=>{
    const task=taskMap.get(taskId);if(!task)return;
    setActive(null);
    const nav=document.querySelector<HTMLElement>(".wv2-view-tabs");findButton(nav,"목록")?.click();
    window.setTimeout(()=>{
      const rows=[...document.querySelectorAll<HTMLTableRowElement>(".wv2-table tbody tr")];const row=rows.find(item=>item.textContent?.includes(task.wbsCode));row?.click();
      window.setTimeout(()=>{const panel=document.querySelector<HTMLElement>(".wv2-panel");findButton(panel?.querySelector("nav")||null,panelLabel)?.click()},80);
    },80);
  };
  const openDrawingPreview=(item:Deliverable)=>{if(!project?.id)return;window.dispatchEvent(new CustomEvent("v2-open-document-overlay",{detail:{deliverableId:item.id,projectId:project.id,name:item.name}}))};
  const bomTask=()=>tasks.find(task=>task.kind==="task"&&(task.deliverables||[]).some(output=>output.name.toLowerCase().includes("bom")))||tasks.find(task=>task.kind==="task"&&task.roleCode==="DESIGN")||tasks.find(task=>task.kind==="task");
  const openBom=(group:BomGroup)=>{
    const task=bomTask();if(!task)return;setSelectedBom(group);setActive(null);const nav=document.querySelector<HTMLElement>(".wv2-view-tabs");findButton(nav,"목록")?.click();window.setTimeout(()=>{const row=[...document.querySelectorAll<HTMLTableRowElement>(".wv2-table tbody tr")].find(item=>item.textContent?.includes(task.wbsCode));row?.click();},70);
  };

  useEffect(()=>{
    if(!selectedBom)return;
    const attach=()=>{
      const panel=document.querySelector<HTMLElement>(".wv2-panel"),nav=panel?.querySelector<HTMLElement>("nav"),body=panel?.querySelector<HTMLElement>(".wv2-panel-body");
      if(!nav||!body)return false;
      let tab=nav.querySelector<HTMLElement>(".project-bom-panel-tab-host");if(!tab){tab=document.createElement("span");tab.className="project-bom-panel-tab-host";nav.appendChild(tab)}
      let content=body.querySelector<HTMLElement>(".project-bom-panel-body-host");if(!content){content=document.createElement("div");content.className="project-bom-panel-body-host";body.appendChild(content)}
      body.classList.add("project-bom-panel-active");setBomTabHost(tab);setBomBodyHost(content);return true;
    };
    if(!attach()){const timer=window.setInterval(()=>{if(attach())window.clearInterval(timer)},40);window.setTimeout(()=>window.clearInterval(timer),1500);return()=>window.clearInterval(timer)}
  },[selectedBom]);
  useEffect(()=>{if(selectedBom)return;document.querySelector(".wv2-panel-body")?.classList.remove("project-bom-panel-active");document.querySelector(".project-bom-panel-tab-host")?.remove();document.querySelector(".project-bom-panel-body-host")?.remove();setBomTabHost(null);setBomBodyHost(null)},[selectedBom]);
  useEffect(()=>{const listener=(event:MouseEvent)=>{if(!selectedBom)return;const target=(event.target as HTMLElement).closest(".wv2-panel nav button");if(target)setSelectedBom(null)};document.addEventListener("click",listener,true);return()=>document.removeEventListener("click",listener,true)},[selectedBom]);

  if(!tabHost||!canvasHost)return null;
  return <>
    {createPortal(<><button data-project-plm-tab="deliverables" className={active==="deliverables"?"active":""} onClick={()=>setActive("deliverables")}><FileText size={18}/>산출물</button><button data-project-plm-tab="drawings" className={active==="drawings"?"active":""} onClick={()=>setActive("drawings")}><DrawingIcon size={18}/>도면</button><button data-project-plm-tab="bom" className={active==="bom"?"active":""} onClick={()=>setActive("bom")}><GitBranch size={18}/>BOM</button></>,tabHost)}
    {active&&createPortal(<section className="project-plm-view">{loading?<div className="project-plm-state">데이터를 불러오는 중…</div>:error?<div className="project-plm-state error">{error}</div>:active==="deliverables"?<DeliverableList rows={documentRows} versions={versions} taskMap={taskMap} onOpen={item=>item.taskId&&openTask(item.taskId)}/>:active==="drawings"?<DrawingList rows={drawingRows} versions={versions} taskMap={taskMap} onOpen={item=>item.taskId&&openTask(item.taskId)} onPreview={openDrawingPreview}/>:<BomList groups={bomGroups} onOpen={openBom}/>}</section>,canvasHost)}
    {selectedBom&&bomTabHost&&createPortal(<button className="project-bom-panel-tab active"><GitBranch size={14}/>BOM</button>,bomTabHost)}
    {selectedBom&&bomBodyHost&&createPortal(<BomPanel group={selectedBom}/>,bomBodyHost)}
  </>;
}

function DeliverableList({rows,versions,taskMap,onOpen}:{rows:Deliverable[];versions:Version[];taskMap:Map<string,Task>;onOpen:(item:Deliverable)=>void}){
  const registeredCount=rows.filter(item=>registered(item,versions)).length,requiredMissing=rows.filter(item=>(Number(item.required)===1||item.required===true)&&!registered(item,versions)).length;
  return <><header className="project-plm-summary"><div><b>프로젝트 산출물</b><span>필수·선택·추가·AI 문서를 하나의 목록에서 관리합니다.</span></div><div><strong>{rows.length}</strong><span>전체</span><strong>{registeredCount}</strong><span>등록</span><strong className="warn">{requiredMissing}</strong><span>필수 미등록</span></div></header><div className="project-plm-table"><div className="head"><span>구분</span><span>산출물명</span><span>WBS / Task</span><span>등록</span><span>상태</span><span>Revision</span></div>{rows.map(item=>{const task=item.taskId?taskMap.get(item.taskId):undefined,done=registered(item,versions);return <button key={item.id} onClick={()=>onOpen(item)} disabled={!item.taskId}><span><em className={`kind ${sourceLabel(item).replace(/ /g,"-")}`}>{sourceLabel(item)}</em></span><span className="name"><b>{item.name}</b><small>{item.type||"문서"}</small></span><span>{task?<><b>{task.wbsCode}</b><small>{task.name}</small></>:"프로젝트 공통"}</span><span><em className={`registration ${done?"done":"missing"}`}>{done?"등록":"미등록"}</em></span><span>{statusLabel(item.status)}</span><span>{item.version||((item.revisionCount||0)>0?`Rev.${String(item.revisionCount).padStart(2,"0")}`:"-")}</span></button>})}{!rows.length&&<div className="empty">등록된 프로젝트 산출물이 없습니다.</div>}</div></>;
}
function DrawingList({rows,versions,taskMap,onOpen,onPreview}:{rows:Deliverable[];versions:Version[];taskMap:Map<string,Task>;onOpen:(item:Deliverable)=>void;onPreview:(item:Deliverable)=>void}){return <><header className="project-plm-summary"><div><b>프로젝트 도면</b><span>현재 프로젝트와 연결된 도면 및 연결 Task를 표시합니다.</span></div><div><strong>{rows.length}</strong><span>도면</span><strong>{rows.filter(item=>registered(item,versions)).length}</strong><span>등록</span></div></header><div className="project-plm-table drawings"><div className="head"><span>도면번호</span><span>도면명</span><span>구분</span><span>WBS / Task</span><span>Revision</span><span>상태</span><span>미리보기</span></div>{rows.map(item=>{const task=item.taskId?taskMap.get(item.taskId):undefined,done=registered(item,versions),latest=versions.find(version=>version.deliverableId===item.id);return <button key={item.id} onClick={()=>{if(item.taskId)onOpen(item)}}><span><b>{item.drawingCode||item.internalDrawingNumber||"자동부여"}</b></span><span className="name"><b>{item.name}</b><small>{item.internalDrawingNumber||""}</small></span><span>{drawingTypeLabel(item.drawingType)}</span><span>{task?<><b>{task.wbsCode}</b><small>{task.name}</small></>:"프로젝트 공통"}</span><span className="name"><b>{item.version||((item.revisionCount||0)>0?`Rev.${String(item.revisionCount).padStart(2,"0")}`:"-")}</b><small>{latest?.fileName||"등록 파일 없음"}</small></span><span>{done?statusLabel(item.status):"미등록"}</span><span className={`project-plm-preview-action ${done?"":"disabled"}`} role="button" aria-disabled={!done} tabIndex={done?0:-1} onClick={event=>{event.stopPropagation();if(done)onPreview(item)}} onKeyDown={event=>{if(done&&(event.key==="Enter"||event.key===" ")){event.preventDefault();event.stopPropagation();onPreview(item)}}}>미리보기</span></button>})}{!rows.length&&<div className="empty">프로젝트에 연결된 도면이 없습니다.</div>}</div></>}
function BomList({groups,onOpen}:{groups:BomGroup[];onOpen:(group:BomGroup)=>void}){return <><header className="project-plm-summary"><div><b>프로젝트 BOM</b><span>이 프로젝트에 지정·연결된 BOM Root 및 Assembly 목록입니다.</span></div><div><strong>{groups.length}</strong><span>BOM</span><strong>{groups.reduce((sum,item)=>sum+item.children.length,0)}</strong><span>구성 연결</span></div></header><div className="project-plm-table bom"><div className="head"><span>Level</span><span>BOM / Assembly</span><span>품번</span><span>하위 품목</span><span>Roll-up 원가</span><span>상태</span></div>{groups.map(group=><button key={group.id} onClick={()=>onOpen(group)}><span><em className="bom-level">L{group.level}</em></span><span className="name"><Box size={16}/><b>{group.name}</b></span><span>{group.number}</span><span>{group.children.length}개</span><span>{group.rollupCost?`${Math.round(group.rollupCost).toLocaleString()}원`:"-"}</span><span>사용 중</span></button>)}{!groups.length&&<div className="empty">이 프로젝트에 지정된 BOM이 없습니다.</div>}</div></>}
function BomPanel({group}:{group:BomGroup}){return <div className="project-bom-panel"><header><small>PROJECT · BOM</small><h3>{group.name}</h3><span>{group.number} · 하위 {group.children.length}개</span></header><div className="project-bom-panel-summary"><div><span>Level</span><b>L{group.level}</b></div><div><span>Roll-up 원가</span><b>{group.rollupCost?`${Math.round(group.rollupCost).toLocaleString()}원`:"-"}</b></div></div><section><h4>하위 BOM 구성</h4>{group.children.map((row,index)=><article key={`${row.childPartId}-${index}`}><span>{row.childNumber}</span><b>{row.childName}</b><em>{row.quantity} {row.unit}</em></article>)}</section></div>}
