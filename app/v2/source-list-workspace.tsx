"use client";
/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps */
import {useEffect,useMemo,useState} from "react";
import {Filter,GitPullRequestArrow,Plus,RefreshCw,Search,ShieldCheck} from "lucide-react";
import {CommonProjectSelector} from "./common-project-selector";
import {SourceStageList} from "./source-stage-list";
import {WorkflowDetailPanel as WorkflowDetail} from "./workflow-detail-panel";
import "./workflow-document.css";

type Project={id:string;code:string;name:string};
type SourceWorkspaceProps={projects:Project[];onCreate:(projectId:string)=>void;onEdit:(id:string)=>void;initialDetailId?:string;onInitialDetailOpened?:()=>void;onOpenDocuments:(deliverableId:string)=>void};
const json=async(response:Response)=>{const text=await response.text();let data:any={};if(text){try{data=JSON.parse(text)}catch{data={error:text}}}if(!response.ok)throw new Error(data.error||`요청을 처리하지 못했습니다. (${response.status})`);return data};

export function EcrWorkspace(props:SourceWorkspaceProps){return <SourceWorkspace kind="ECR" {...props}/>}
export function QualityWorkspace(props:SourceWorkspaceProps){return <SourceWorkspace kind="QUALITY" {...props}/>}

function SourceWorkspace({kind,projects,onCreate,onEdit,initialDetailId,onInitialDetailOpened,onOpenDocuments}:SourceWorkspaceProps&{kind:"ECR"|"QUALITY"}){
  const ecr=kind==="ECR",endpoint=ecr?"/api/ecr":"/api/quality";
  const [items,setItems]=useState<any[]>([]),[projectId,setProjectId]=useState(""),[query,setQuery]=useState(""),[detailId,setDetailId]=useState(""),[loading,setLoading]=useState(true),[notice,setNotice]=useState("");
  const load=()=>{setLoading(true);setNotice("");fetch(`${endpoint}?projectId=${encodeURIComponent(projectId)}`,{cache:"no-store"}).then(json).then(data=>setItems(data.items??[])).catch(reason=>setNotice(reason instanceof Error?reason.message:"목록을 불러오지 못했습니다.")).finally(()=>setLoading(false))};
  useEffect(load,[projectId]);
  useEffect(()=>{if(!initialDetailId)return;setDetailId(initialDetailId);onInitialDetailOpened?.()},[initialDetailId]);
  const visible=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return items;return items.filter(item=>`${item.ecrNumber||item.qualityNumber||""} ${item.title||""} ${item.projectCode||""} ${item.projectName||""} ${item.partNumber||""} ${item.partName||""} ${item.drawingCode||""} ${item.drawingName||""}`.toLowerCase().includes(q))},[items,query]);
  return <section className="wv2-module wv2-workflow-module"><header className="wv2-module-head"><div><small>{ecr?"ENGINEERING CHANGE REQUEST":"QUALITY ACTION"}</small><h1>{ecr?"설계변경":"품질관리"}</h1><p>{ecr?"프로젝트 연결 전 변경 요청도 먼저 등록하고 필요할 때 Workflow로 전환합니다.":"프로젝트 연결 전 품질문제도 먼저 등록하고 필요할 때 Workflow로 전환합니다."}</p></div><button className="primary" onClick={()=>onCreate(projectId)}><Plus size={18}/>{ecr?"설계변경 등록":"품질문제 등록"}</button></header><div className="wv2-module-toolbar"><label><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={ecr?"번호·제목·PART·도면 검색":"품질번호·제목·PART·도면 검색"}/></label><button><Filter size={18}/>상세 필터</button><CommonProjectSelector compact projects={projects} value={projectId} onChange={setProjectId}/><span>{visible.length}개</span></div>{notice&&<p className="wv2-workflow-notice">{notice}</p>}{loading?<Empty title="목록을 불러오는 중…" icon={RefreshCw}/>:visible.length?<SourceStageList kind={kind} rows={visible} onOpen={setDetailId} onEditSource={onEdit}/>:<Empty title={ecr?"등록된 설계변경이 없습니다.":"등록된 품질문제가 없습니다."} icon={ecr?GitPullRequestArrow:ShieldCheck}/>} {detailId&&<WorkflowDetail id={detailId} onClose={()=>setDetailId("")} onChanged={load} onOpenDocuments={onOpenDocuments} onEdit={onEdit} onDeleted={()=>{setDetailId("");load()}}/>}</section>
}

function Empty({title,icon:Icon}:{title:string;icon:any}){return <div className="wv2-module-empty"><Icon size={30}/><b>{title}</b></div>}
