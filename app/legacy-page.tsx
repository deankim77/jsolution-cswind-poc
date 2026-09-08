"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDot,
  Copy,
  Clock3,
  FileText,
  FileCheck2,
  FolderOpen,
  Eye,
  Download,
  Upload,
  GanttChartSquare,
  Layers3,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  History,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  UserCog,
  Workflow,
  Trash2,
  IndentIncrease,
  IndentDecrease,
  ArrowUp,
  ArrowDown,
  Archive,
  Star,
  X,
} from "lucide-react";

import NewWorkViewApp from "./v2/NewWorkViewApp";

import ArtifactPreviewView, { type ArtifactPreviewData } from "./artifact-preview-view";
import DocumentFilePreviewView, { type DocumentPreviewData } from "./document-file-preview-view";
import { artifactLabel, detectAiArtifactType } from "./ai-artifact-download";
import { saveAiArtifactResult } from "./ai-artifact-library";
import ProjectIssueWorkspace, { type IssueAiContext } from "./project-issue-workspace";
import ProjectDocumentWorkspace, { type DocumentAiContext } from "./project-document-workspace";
import AiContextSelectionBlock from "./ai-context-selection-block";
import CommonAiChatPanel,{type CommonAiContextItem} from "./common-ai-chat-panel";

const nav = [
  { label: "MY AI HOME", icon: Sparkles, active: true },
  { label: "프로젝트 AI HOME", icon: LayoutDashboard },
  { label: "전사 AI HOME", icon: BriefcaseBusiness },
  { label: "MY WORK", icon: CircleCheck, badge: "7" },
  { label: "프로젝트", icon: Target },
  { label: "일정 · WBS", icon: GanttChartSquare },
  { label: "문서 · 산출물", icon: FileText },
  { label: "이슈 · 리스크", icon: AlertTriangle },
  { label: "보고 · 회의", icon: MessageSquareText },
];

const tasks = [
  { id: 1, title: "A사 PMS 구축안 최종 검토", project: "A사 AI PMS 구축", due: "오늘 14:00", status: "긴급", tone: "red", done: false },
  { id: 2, title: "WBS 2차 일정 확정", project: "패션 PLM 고도화", due: "오늘 17:00", status: "의사결정", tone: "amber", done: false },
  { id: 3, title: "주간 프로젝트 보고서 확인", project: "사내 AI 전환", due: "내일", status: "검토", tone: "blue", done: false },
];

const projects = [
  { name: "A사 AI PMS 구축", progress: 68, state: "주의", issue: "핵심 Task 3일 지연", color: "#e55858" },
  { name: "패션 PLM 고도화", progress: 81, state: "정상", issue: "계획대로 진행 중", color: "#21a889" },
  { name: "사내 AI 전환", progress: 43, state: "관찰", issue: "의사결정 2건 대기", color: "#e5a33e" },
];

const initialWbsItems = [
  { id:"1", title:"요구사항 분석", owner:"김서준", due:"8월 2일", progress:91, state:"주의", tone:"warn", level:1, group:"1", children:true, outputs:4, issues:1 },
  { id:"1.1", title:"현행 프로세스 분석", owner:"김서준", due:"7월 12일", progress:100, state:"완료", tone:"done", level:2, group:"1", outputs:2, issues:0 },
  { id:"1.2", title:"요구사항 정의", owner:"Dean Kim", due:"8월 2일", progress:82, state:"3일 지연", tone:"risk", level:2, group:"1", children:true, outputs:2, issues:1 },
  { id:"1.2.1", title:"부서별 요구사항 취합", owner:"박지연", due:"7월 29일", progress:100, state:"완료", tone:"done", level:3, group:"1.2", outputs:1, issues:0 },
  { id:"1.2.2", title:"요구사항 최종 확정", owner:"Dean Kim", due:"8월 2일", progress:72, state:"3일 지연", tone:"risk", level:3, group:"1.2", outputs:1, issues:1 },
  { id:"2", title:"프로세스·화면 설계", owner:"박지연", due:"8월 9일", progress:66, state:"진행 중", tone:"active", level:1, group:"2", children:true, outputs:5, issues:1 },
  { id:"2.1", title:"프로세스 설계", owner:"박지연", due:"8월 8일", progress:74, state:"진행 중", tone:"active", level:2, group:"2", outputs:3, issues:0 },
  { id:"2.2", title:"외부 연계 API 설계", owner:"이도현", due:"8월 9일", progress:55, state:"검토 필요", tone:"warn", level:2, group:"2", outputs:2, issues:1 },
  { id:"3", title:"개발", owner:"개발팀", due:"8월 22일", progress:23, state:"선행 영향", tone:"warn", level:1, group:"3", children:true, outputs:3, issues:1 },
  { id:"3.1", title:"프로젝트·WBS 모듈 개발", owner:"개발팀", due:"8월 19일", progress:28, state:"선행 영향", tone:"warn", level:2, group:"3", outputs:2, issues:1 },
  { id:"3.2", title:"MY AI 대화 연계", owner:"AI팀", due:"8월 22일", progress:18, state:"예정", tone:"planned", level:2, group:"3", outputs:1, issues:0 },
];

const issueItems = [
  { id:"ISSUE-024", title:"고객 요구사항 승인 지연", project:"A사 AI PMS 구축", projectState:"주의", link:"WBS 1.2.2", linkedWork:"요구사항 최종 확정", owner:"Dean Kim", due:"오늘", severity:"높음", status:"조치 중", tone:"risk", impact:"설계·개발 착수 3일 지연" },
  { id:"RISK-011", title:"외부 연계 API 방식 미확정", project:"A사 AI PMS 구축", projectState:"주의", link:"WBS 2.2", linkedWork:"외부 연계 API 설계", owner:"이도현", due:"오늘", severity:"중간", status:"검토 중", tone:"warn", impact:"인터페이스 개발 재작업 가능" },
  { id:"ISSUE-019", title:"개발 인력 1명 추가 필요", project:"패션 PLM 고도화", projectState:"정상", link:"WBS 3.1", linkedWork:"프로젝트·WBS 모듈 개발", owner:"박지연", due:"8월 7일", severity:"중간", status:"승인 대기", tone:"blue", impact:"2차 개발 일정 2일 영향" },
  { id:"RISK-008", title:"사용자 교육 일정 중복", project:"사내 AI 전환", projectState:"관찰", link:"WBS 4.3", linkedWork:"사용자 교육 운영", owner:"김서준", due:"8월 12일", severity:"낮음", status:"관찰", tone:"planned", impact:"교육 참여율 저하 가능" },
];

const documentItems = [
  { id:"DOC-104", title:"요구사항 정의서", version:"v1.3", project:"A사 AI PMS 구축", link:"WBS 1.2.2", issue:"ISSUE-024", owner:"Dean Kim", updated:"오늘 09:30", status:"검토 중", tone:"warn", type:"필수 산출물" },
  { id:"DOC-108", title:"요구사항 추적표", version:"v2.1", project:"A사 AI PMS 구축", link:"WBS 1.2.2", issue:"-", owner:"박지연", updated:"어제 17:12", status:"승인", tone:"done", type:"필수 산출물" },
  { id:"DOC-121", title:"외부 연계 API 설계서", version:"v0.8", project:"A사 AI PMS 구축", link:"WBS 2.2", issue:"RISK-011", owner:"이도현", updated:"8월 4일", status:"작성 중", tone:"active", type:"설계 문서" },
  { id:"DOC-087", title:"프로젝트 수행계획서", version:"v1.0", project:"A사 AI PMS 구축", link:"WBS 1", issue:"-", owner:"김서준", updated:"7월 10일", status:"배포", tone:"planned", type:"관리 문서" },
];

const suggestions = [
  "오늘 가장 먼저 처리할 업무는?",
  "지연 중인 프로젝트 원인을 알려줘",
  "이번 주 업무보고 초안을 작성해줘",
];

const initialAiAnalysisResults:AiAnalysisResult[] = [
  {id:"AI-P-001",title:"A사 프로젝트 지연 원인 분석",summary:"요구사항 확정 지연이 설계·개발 착수에 미치는 영향과 우선 조치를 정리했습니다.",location:"project",project:"A사 AI PMS 구축",source:"프로젝트 AI HOME",createdAt:"오늘 09:42",author:"Dean Kim"},
  {id:"AI-M-001",title:"주간 업무 우선순위 검토",summary:"이번 주 개인 업무의 마감일과 프로젝트 영향을 기준으로 우선순위를 정리했습니다.",location:"personal",project:"개인 업무",source:"MY AI 대화",createdAt:"어제 16:18",author:"Dean Kim"},
];

const initialConversations = [
  { id: "sample-1", title: "A사 프로젝트 지연 원인 분석", context: "A사 AI PMS 구축", source: "프로젝트 AI HOME", time: "오늘 09:42", contextItems:[] as AiContextItem[] },
  { id: "sample-2", title: "WBS 일정 회복안 검토", context: "패션 PLM 고도화 · WBS-204", source: "일정 · WBS", time: "어제 16:18", contextItems:[] as AiContextItem[] },
  { id: "sample-3", title: "주간 프로젝트 보고서 초안", context: "사내 AI 전환", source: "보고 · 회의", time: "8월 3일", contextItems:[] as AiContextItem[] },
];

type AiContextItem={id:string;kind:"프로젝트"|"WBS"|"이슈"|"문서";title:string;meta:string};
type Conversation={id:string;title:string;context:string;source:string;time:string;contextItems:AiContextItem[];favorite?:boolean;archived?:boolean};
type AiMessage={id:string;role:"user"|"assistant";content:string;createdAt:number};
type AiAnalysisResult={id:string;title:string;summary:string;location:"personal"|"project";project:string;source:string;createdAt:string;author:string};

type SelectedItem = { kind: "업무" | "프로젝트" | "WBS" | "이슈" | "문서"; title: string; subtitle: string; wbsId?: string; issueId?: string; documentId?: string } | null;
type PanelMode = "detail" | "deliverables" | "issues" | "history" | "preview" | "versions" | "ai";
type FilterScope = "issues" | "documents" | null;
type AdvancedFilters = { projects: string[]; logic: "AND" | "OR"; criteria: string[]; owners: string[] };
type AiResultFilters = { logic:"AND"|"OR"; locations:Array<"personal"|"project">; projects:string[]; sources:string[]; authors:string[] };
type WbsMode = "list" | "gantt";
type WbsSection = "actual" | "gantt" | "edit";
type WbsWorkMode = "operate" | "edit";
type WbsTaskFilter = "전체 업무" | "진행 중" | "내 업무" | "미시작 Task" | "지연 Task" | "이슈 Task" | "완료" | "보류";
type WbsFilters = { logic:"AND"|"OR"; statuses:string[]; attention:string[]; owners:string[]; levels:string[] };
type WbsDialog = { mode:"edit" | "task"; id:string } | null;
type AdminTab = "organization" | "template" | "project";
type View = "home" | "ai-conversations" | "ai-library" | "artifact-preview" | "document-preview" | "ai-result-preview" | "search" | "work" | "project" | "project-dashboard" | "wbs" | "wbs-editor" | "issues" | "documents" | "admin";
type WorkspaceTab = { key:string; label:string; view:View; adminTab?:AdminTab; fixed?:boolean; searchQuery?:string; resultId?:string; artifact?:ArtifactPreviewData; documentPreview?:DocumentPreviewData };
type TemplateWbs = { id:string; parentId?:string; level:number; kind:"summary"|"task"; name:string; durationDays:number; predecessor?:string; role:string; roleAlias?:string; taskType:"normal"|"gate"; deliverable?:string; deliverableRequired:boolean; deliverables:Array<{name:string;type:string;required?:boolean;quantity?:number}>; completionActor:"assignee"|"PL"|"PM"; completionCriteria:string };
type ProjectRole = { id:string; group:string; code:string; name:string; description:string; required:boolean; multiple:boolean; gateApprover:boolean; enabled:boolean };
type ProjectType = { id:string; code:string; name:string; enabled:boolean; order:number };
type PartnerType = { id:string; code:string; name:string; enabled:boolean; order:number };
type Partner = { id:string; enabled:boolean; name:string; code:string; typeId:string; contactName:string; contactPhone:string; contactEmail:string; mainPhone:string; englishName:string; country:string; industry:string; representative:string; businessNumber:string; address:string; extra:string; note:string };
type DocumentCategory = { id:string; code:string; name:string; enabled:boolean; children:Array<{id:string;code:string;name:string;enabled:boolean}> };
type ProjectTemplate = { id:string; code:string; name:string; status:"draft"|"active"|"inactive"; versionId:string; version:string; updatedAt:number; createdBy?:string; createdByName?:string; canDelete?:boolean; definition:{description?:string;roles:string[];wbs:TemplateWbs[]} };
type ProjectRecord = { id:string; code:string; name:string; customerName?:string; startDate:string; endDate:string; status:string; templateVersion?:string; templateName?:string; memberCount:number };
type ProjectWbsApiTask={id:string;wbsCode:string;parentId?:string|null;parentCode?:string|null;level:number;sortOrder:number;kind:"summary"|"task";name:string;taskType:"normal"|"gate";durationDays:number;plannedStart?:string;plannedEnd?:string;predecessorId?:string;predecessorCode?:string;roleCode?:string;assigneeUserId?:string;assigneeName?:string;progress:number;status:string;completionActor?:string;completionCriteria?:string;deliverables:Array<{id?:string;name:string;type?:string;required?:boolean}>};

let projectTemplateCache:ProjectTemplate[]|null=null;
let projectTemplateRequest:Promise<ProjectTemplate[]>|null=null;

async function requestProjectTemplates(force=false) {
  if(!force&&projectTemplateCache)return projectTemplateCache;
  if(projectTemplateRequest)return projectTemplateRequest;
  projectTemplateRequest=fetch("/api/templates",{cache:"no-store"})
    .then(async response=>{
      if(!response.ok)throw new Error("템플릿 목록을 불러오지 못했습니다.");
      const result=await response.json() as {templates?:ProjectTemplate[]};
      projectTemplateCache=result.templates??[];
      return projectTemplateCache;
    })
    .finally(()=>{projectTemplateRequest=null;});
  return projectTemplateRequest;
}

const emptyFilters: AdvancedFilters = { projects: [], logic: "AND", criteria: [], owners: [] };

const defaultDocumentCategories:DocumentCategory[] = [
  {id:"cat-01",code:"PM",name:"사업·프로젝트 관리",enabled:true,children:[
    {id:"cat-01-01",code:"PM-PLAN",name:"수행계획",enabled:true},
    {id:"cat-01-02",code:"PM-SCHEDULE",name:"일정·진척",enabled:true},
    {id:"cat-01-03",code:"PM-COST",name:"예산·원가",enabled:true},
    {id:"cat-01-04",code:"PM-REPORT",name:"주간·월간보고",enabled:true},
  ]},
  {id:"cat-02",code:"RQ",name:"요구사항·기획",enabled:true,children:[
    {id:"cat-02-01",code:"RQ-MARKET",name:"시장·고객조사",enabled:true},
    {id:"cat-02-02",code:"RQ-PLAN",name:"제품·서비스기획",enabled:true},
    {id:"cat-02-03",code:"RQ-REQ",name:"요구사항",enabled:true},
    {id:"cat-02-04",code:"RQ-SPEC",name:"사양·규격",enabled:true},
  ]},
  {id:"cat-03",code:"DV",name:"설계·개발",enabled:true,children:[
    {id:"cat-03-01",code:"DV-DESIGN",name:"설계서",enabled:true},
    {id:"cat-03-02",code:"DV-DRAWING",name:"도면·모델",enabled:true},
    {id:"cat-03-03",code:"DV-BOM",name:"BOM·품목",enabled:true},
    {id:"cat-03-04",code:"DV-INTERFACE",name:"인터페이스·연계",enabled:true},
    {id:"cat-03-05",code:"DV-DEV",name:"개발명세·구현",enabled:true},
  ]},
  {id:"cat-04",code:"QA",name:"시험·품질",enabled:true,children:[
    {id:"cat-04-01",code:"QA-PLAN",name:"시험·검사계획",enabled:true},
    {id:"cat-04-02",code:"QA-RESULT",name:"시험·검사결과",enabled:true},
    {id:"cat-04-03",code:"QA-QUALITY",name:"품질관리",enabled:true},
    {id:"cat-04-04",code:"QA-CERT",name:"인증·규제",enabled:true},
  ]},
  {id:"cat-05",code:"CH",name:"변경·이슈",enabled:true,children:[
    {id:"cat-05-01",code:"CH-REQUEST",name:"변경요청",enabled:true},
    {id:"cat-05-02",code:"CH-REVIEW",name:"변경검토·승인",enabled:true},
    {id:"cat-05-03",code:"CH-ISSUE",name:"이슈·조치",enabled:true},
    {id:"cat-05-04",code:"CH-RISK",name:"리스크",enabled:true},
  ]},
  {id:"cat-06",code:"CM",name:"회의·의사결정",enabled:true,children:[
    {id:"cat-06-01",code:"CM-MEETING",name:"회의록",enabled:true},
    {id:"cat-06-02",code:"CM-REVIEW",name:"검토자료",enabled:true},
    {id:"cat-06-03",code:"CM-DECISION",name:"의사결정",enabled:true},
    {id:"cat-06-04",code:"CM-COLLAB",name:"협업·커뮤니케이션",enabled:true},
  ]},
  {id:"cat-07",code:"SC",name:"구매·생산·협력",enabled:true,children:[
    {id:"cat-07-01",code:"SC-QUOTE",name:"견적·원가",enabled:true},
    {id:"cat-07-02",code:"SC-PO",name:"구매·발주",enabled:true},
    {id:"cat-07-03",code:"SC-SUPPLIER",name:"협력사·소싱",enabled:true},
    {id:"cat-07-04",code:"SC-PRODUCTION",name:"생산·작업",enabled:true},
  ]},
  {id:"cat-08",code:"DL",name:"계약·납품",enabled:true,children:[
    {id:"cat-08-01",code:"DL-CONTRACT",name:"계약·협약",enabled:true},
    {id:"cat-08-02",code:"DL-DELIVERY",name:"납품·인도",enabled:true},
    {id:"cat-08-03",code:"DL-ACCEPT",name:"검수·인수",enabled:true},
    {id:"cat-08-04",code:"DL-CLOSE",name:"완료·종료보고",enabled:true},
  ]},
  {id:"cat-09",code:"AI",name:"AI 분석",enabled:true,children:[
    {id:"cat-09-01",code:"AI-SUMMARY",name:"요약·질의응답",enabled:true},
    {id:"cat-09-02",code:"AI-COMPARE",name:"비교·검토",enabled:true},
    {id:"cat-09-03",code:"AI-RISK",name:"리스크·이슈분석",enabled:true},
    {id:"cat-09-04",code:"AI-FORECAST",name:"일정·성과예측",enabled:true},
  ]},
  {id:"cat-10",code:"ETC",name:"기타",enabled:true,children:[
    {id:"cat-10-01",code:"ETC-GENERAL",name:"일반문서",enabled:true},
    {id:"cat-10-02",code:"ETC-REFERENCE",name:"참고자료",enabled:true},
    {id:"cat-10-03",code:"ETC-UNCLASSIFIED",name:"미분류",enabled:true},
  ]},
];
const defaultDocumentCategoryOptions = defaultDocumentCategories.flatMap(level1=>level1.children.map(level2=>`${level1.name} > ${level2.name}`));

const DOCUMENT_CATEGORY_STORAGE_KEY="jsolution-document-categories-v1";
const DOCUMENT_CATEGORY_EVENT="jsolution-document-categories-changed";
const PROJECT_TYPE_STORAGE_KEY="jsolution-project-types-v1";
const PROJECT_TYPE_EVENT="jsolution-project-types-changed";
const PARTNER_TYPE_STORAGE_KEY="jsolution-partner-types-v1";
const PARTNER_TYPE_EVENT="jsolution-partner-types-changed";
const PARTNER_STORAGE_KEY="jsolution-partners-v1";
const PARTNER_EVENT="jsolution-partners-changed";
const defaultProjectTypes:ProjectType[]=[
  "신제품 개발","부품 개발","SW 개발","양산 개발","제품 개선·고도화","생산 준비·전환","시스템 구축","시스템 고도화","설치·셋업","컨설팅","기타",
].map((name,index)=>({id:`project-type-${index+1}`,code:`PT-${String(index+1).padStart(2,"0")}`,name,enabled:true,order:index+1}));
const defaultPartnerTypes:PartnerType[]=["고객사","공급사","외주처","기타"].map((name,index)=>({id:`partner-type-${index+1}`,code:`BP-${String(index+1).padStart(2,"0")}`,name,enabled:true,order:index+1}));
const defaultPartners:Partner[]=[
  {id:"partner-1",enabled:true,name:"A사",code:"CUS-001",typeId:"partner-type-1",contactName:"김민수",contactPhone:"010-1234-5678",contactEmail:"minsu@example.com",mainPhone:"02-1234-5678",englishName:"A Company",country:"대한민국",industry:"제조업",representative:"김대표",businessNumber:"123-45-67890",address:"서울특별시",extra:"",note:"AI PMS 구축 고객사"},
];

function useLocalMaster<T>(storageKey:string,eventName:string,defaults:T[]){
  const [items,setItemsState]=useState<T[]>(defaults);
  useEffect(()=>{
    const read=()=>{try{const saved=window.localStorage.getItem(storageKey);setItemsState(saved?JSON.parse(saved) as T[]:defaults);}catch{setItemsState(defaults);}};
    read();window.addEventListener(eventName,read);return()=>window.removeEventListener(eventName,read);
  },[storageKey,eventName]);
  const setItems=(next:T[]|((current:T[])=>T[]))=>setItemsState(current=>{const value=typeof next==="function"?next(current):next;window.localStorage.setItem(storageKey,JSON.stringify(value));window.dispatchEvent(new Event(eventName));return value;});
  return [items,setItems] as const;
}

function readProjectTypes(){
  if(typeof window==="undefined")return defaultProjectTypes;
  try{
    const saved=window.localStorage.getItem(PROJECT_TYPE_STORAGE_KEY);
    return saved?JSON.parse(saved) as ProjectType[]:defaultProjectTypes;
  }catch{return defaultProjectTypes;}
}

function useProjectTypes(){
  const [types,setTypesState]=useState<ProjectType[]>(defaultProjectTypes);
  useEffect(()=>{
    setTypesState(readProjectTypes());
    const sync=()=>setTypesState(readProjectTypes());
    window.addEventListener(PROJECT_TYPE_EVENT,sync);
    return()=>window.removeEventListener(PROJECT_TYPE_EVENT,sync);
  },[]);
  const setTypes=(next:ProjectType[]|((current:ProjectType[])=>ProjectType[]))=>{
    setTypesState(current=>{
      const value=(typeof next==="function"?next(current):next).map((item,index)=>({...item,order:index+1}));
      window.localStorage.setItem(PROJECT_TYPE_STORAGE_KEY,JSON.stringify(value));
      window.dispatchEvent(new Event(PROJECT_TYPE_EVENT));
      return value;
    });
  };
  return [types,setTypes] as const;
}

function readDocumentCategories(){
  if(typeof window==="undefined")return defaultDocumentCategories;
  try{
    const saved=window.localStorage.getItem(DOCUMENT_CATEGORY_STORAGE_KEY);
    return saved?JSON.parse(saved) as DocumentCategory[]:defaultDocumentCategories;
  }catch{return defaultDocumentCategories;}
}

function useDocumentCategories(){
  const [categories,setCategoriesState]=useState<DocumentCategory[]>(defaultDocumentCategories);
  useEffect(()=>{
    setCategoriesState(readDocumentCategories());
    const sync=()=>setCategoriesState(readDocumentCategories());
    window.addEventListener(DOCUMENT_CATEGORY_EVENT,sync);
    return()=>window.removeEventListener(DOCUMENT_CATEGORY_EVENT,sync);
  },[]);
  const setCategories=(next:DocumentCategory[]|((current:DocumentCategory[])=>DocumentCategory[]))=>{
    setCategoriesState(current=>{
      const value=typeof next==="function"?next(current):next;
      window.localStorage.setItem(DOCUMENT_CATEGORY_STORAGE_KEY,JSON.stringify(value));
      window.dispatchEvent(new Event(DOCUMENT_CATEGORY_EVENT));
      return value;
    });
  };
  return [categories,setCategories] as const;
}

function CategoryLevelSelect({value,placeholder,label,options,onChange,disabled=false}:{value:string;placeholder:string;label:string;options:Array<{id:string;code:string;name:string}>;onChange:(value:string)=>void;disabled?:boolean}){
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const rootRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const close=(event:MouseEvent)=>{if(rootRef.current&&!rootRef.current.contains(event.target as Node))setOpen(false);};
    document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);
  },[]);
  const keyword=search.trim().toLowerCase();
  const visible=options.filter(option=>!keyword||`${option.name} ${option.code}`.toLowerCase().includes(keyword));
  return <div className="category-level-select" ref={rootRef}>
    <button type="button" disabled={disabled} onClick={()=>setOpen(current=>!current)} aria-haspopup="listbox" aria-expanded={open} aria-label={label}><span>{value||placeholder}</span><ChevronDown size={14}/></button>
    {open&&<div className="category-level-popover"><label><Search size={14}/><input autoFocus value={search} onChange={event=>setSearch(event.target.value)} placeholder={`${label} 검색`}/></label><div role="listbox">
      {visible.map(option=><button type="button" role="option" aria-selected={value===option.name} className={value===option.name?"active":""} key={option.id} onClick={()=>{onChange(option.name);setOpen(false);setSearch("");}}><span>{option.name}</span><small>{option.code}</small>{value===option.name&&<Check size={14}/>}</button>)}
      {!visible.length&&<p>검색 결과가 없습니다.</p>}
    </div></div>}
  </div>;
}

function DocumentCategoryPicker({categories,value,onChange,label="문서 카테고리"}:{categories:DocumentCategory[];value:string;onChange:(value:string)=>void;label?:string}){
  const [savedLevel1="",savedLevel2=""] = value.split(" > ");
  const enabledLevel1=categories.filter(category=>category.enabled&&category.children.some(child=>child.enabled));
  const selectedLevel1=enabledLevel1.find(category=>category.name===savedLevel1)??null;
  return <div className="category-level-picker" aria-label={label}>
    <CategoryLevelSelect value={selectedLevel1?.name||""} placeholder="1레벨 선택" label="1레벨" options={enabledLevel1} onChange={name=>{
      const next=enabledLevel1.find(category=>category.name===name);
      const firstChild=next?.children.find(child=>child.enabled);
      onChange(next&&firstChild?`${next.name} > ${firstChild.name}`:"");
    }}/>
    <CategoryLevelSelect value={selectedLevel1?.children.some(child=>child.enabled&&child.name===savedLevel2)?savedLevel2:""} placeholder="2레벨 선택" label="2레벨" disabled={!selectedLevel1} options={(selectedLevel1?.children??[]).filter(child=>child.enabled)} onChange={name=>{if(selectedLevel1)onChange(`${selectedLevel1.name} > ${name}`);}}/>
  </div>;
}

function DocumentRegistrationDialog({categories,project="A사 AI PMS 구축",wbs,onClose}:{categories:DocumentCategory[];project?:string;wbs?:string;onClose:()=>void}){
  const first=categories.find(item=>item.enabled)?.children.find(item=>item.enabled);
  const firstParent=categories.find(item=>item.enabled&&item.children.some(child=>child.enabled));
  const [category,setCategory]=useState(first&&firstParent?`${firstParent.name} > ${first.name}`:"");
  return <div className="document-register-backdrop" onClick={onClose}><section className="document-register-dialog" onClick={event=>event.stopPropagation()}><header><div><span>DOCUMENT · DELIVERABLE</span><h2>{wbs?"산출물 등록":"문서 등록"}</h2><p>파일을 등록하고 회사 표준 1·2레벨 문서 카테고리를 지정합니다.</p></div><button onClick={onClose} aria-label="등록 화면 닫기"><X size={19}/></button></header><div className="document-register-form">
    <label><span>프로젝트</span><input value={project} readOnly/></label>
    <label><span>연결 WBS</span><select defaultValue={wbs||""}><option value="">WBS 선택</option><option value={wbs||"1.2.2"}>{wbs||"1.2.2 요구사항 최종 확정"}</option><option value="2.2">2.2 외부 연계 API 설계</option></select></label>
    <label className="wide"><span>구분</span><select defaultValue={wbs?"planned":"additional"}><option value="planned">계획 산출물</option><option value="additional">추가 산출물</option><option value="general">일반 프로젝트 문서</option></select></label>
    <label className="wide"><span>문서 카테고리</span><DocumentCategoryPicker categories={categories} value={category} onChange={setCategory}/><small>목록에서 1·2레벨을 선택하거나 분류명·코드로 검색할 수 있습니다.</small></label>
    <label className="wide"><span>산출물·문서명</span><input placeholder="문서명을 입력하세요"/></label>
    <label className="wide"><span>파일 첨부</span><button type="button" className="document-upload-field"><Upload size={17}/> 파일 선택 또는 끌어놓기</button></label>
  </div><footer><button onClick={onClose}>취소</button><button className="primary" disabled={!category} onClick={onClose}><Check size={15}/> 등록</button></footer></section></div>;
}

function LegacyHome() {
  const homeWorkspaceTab:WorkspaceTab = { key:"home", label:"MY AI HOME", view:"home", fixed:true };
  const [view, setView] = useState<View>("home");
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([homeWorkspaceTab]);
  const [activeWorkspaceKey, setActiveWorkspaceKey] = useState("home");
  const skipInitialTabPersistence = useRef(true);
  const [adminTab, setAdminTab] = useState<AdminTab>("organization");
  const [projectStep, setProjectStep] = useState(1);
  const [createdProject, setCreatedProject] = useState(false);
  const [selectedProject,setSelectedProject]=useState<ProjectRecord|null>(null);
  const [moduleIssueContext,setModuleIssueContext]=useState<IssueAiContext[]>([]);
  const [moduleDocumentContext,setModuleDocumentContext]=useState<DocumentAiContext[]>([]);
  const [documentSelectedIds,setDocumentSelectedIds]=useState<string[]>([]);
  const [issueSelectedIds,setIssueSelectedIds]=useState<string[]>([]);
  const [wbsItems,setWbsItems]=useState(initialWbsItems);
  const [workFilter, setWorkFilter] = useState<"전체" | "오늘" | "진행 중" | "완료">("전체");
  const [workSearch, setWorkSearch] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [conversationSearch,setConversationSearch]=useState("");
  const [conversationMode,setConversationMode]=useState<"all"|"favorite"|"archived">("all");
  const [conversationQuery,setConversationQuery]=useState("");
  const [aiWorkspaceMode,setAiWorkspaceMode]=useState<"conversations"|"analysis">("conversations");
  const [globalSearch,setGlobalSearch]=useState("");
  const [submittedSearch,setSubmittedSearch]=useState("");
  const [selectedSearchIds,setSelectedSearchIds]=useState<string[]>([]);
  const [activeConversationId,setActiveConversationId]=useState<string|null>(null);
  const [panelMessages,setPanelMessages]=useState<AiMessage[]>([]);
  const [messagesLoading,setMessagesLoading]=useState(false);
  const [panelSending,setPanelSending]=useState(false);
  const [saveNotice,setSaveNotice]=useState("");
  const [aiAnalysisResults,setAiAnalysisResults]=useState<AiAnalysisResult[]>(initialAiAnalysisResults);
  const [analysisSearch,setAnalysisSearch]=useState("");
  const [analysisKind,setAnalysisKind]=useState<"all"|"personal"|"project">("all");
  const emptyAiFilters:AiResultFilters={logic:"AND",locations:[],projects:[],sources:[],authors:[]};
  const [aiFilters,setAiFilters]=useState<AiResultFilters>(emptyAiFilters);
  const [draftAiFilters,setDraftAiFilters]=useState<AiResultFilters>(emptyAiFilters);
  const [aiFilterOpen,setAiFilterOpen]=useState(false);
  const [activeAnalysisId,setActiveAnalysisId]=useState<string|null>(null);
  const [selected, setSelected] = useState<SelectedItem>(null);
  useEffect(()=>{
    const conversationHandler=(event:Event)=>{
      const detail=(event as CustomEvent<{id:string;title:string;context:string;source:string;contextItems:AiContextItem[]}>).detail;
      if(!detail?.id)return;
      setConversations(current=>[{id:detail.id,title:detail.title,context:detail.context,source:detail.source,time:"방금 전",contextItems:detail.contextItems},...current.filter(item=>item.id!==detail.id)]);
    };
    const libraryHandler=()=>{try{const stored=window.localStorage.getItem("jsolution-ai-analysis-results");if(stored)setAiAnalysisResults(JSON.parse(stored) as AiAnalysisResult[]);}catch{}};
    window.addEventListener("jsolution-ai-conversation-updated",conversationHandler as EventListener);
    window.addEventListener("jsolution-ai-analysis-results-changed",libraryHandler);
    return()=>{window.removeEventListener("jsolution-ai-conversation-updated",conversationHandler as EventListener);window.removeEventListener("jsolution-ai-analysis-results-changed",libraryHandler)};
  },[]);

  const [panelMode, setPanelMode] = useState<PanelMode>("detail");
  const [panelQuery, setPanelQuery] = useState("");
  const [expandedWbs, setExpandedWbs] = useState(["1", "1.2", "2", "3"]);
  const [issueFilter, setIssueFilter] = useState<"전체" | "높음" | "조치 중" | "관찰">("전체");
  const [documentFilter, setDocumentFilter] = useState<"전체" | "검토 중" | "승인" | "작성 중">("전체");
  const [documentCategories] = useDocumentCategories();
  const [documentRegistration,setDocumentRegistration]=useState<{wbs?:string}|null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [selectedWbs, setSelectedWbs] = useState<string[]>([]);
  const [filterScope, setFilterScope] = useState<FilterScope>(null);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(emptyFilters);
  const [issueAdvanced, setIssueAdvanced] = useState<AdvancedFilters>(emptyFilters);
  const [documentAdvanced, setDocumentAdvanced] = useState<AdvancedFilters>(emptyFilters);
  const [projectFilterSearch, setProjectFilterSearch] = useState("");
  const [ownerFilterSearch, setOwnerFilterSearch] = useState("");
  const [wbsMode, setWbsMode] = useState<WbsMode>("list");
  const [wbsSection,setWbsSection] = useState<WbsSection>("actual");
  const [wbsWorkMode, setWbsWorkMode] = useState<WbsWorkMode>("operate");
  const [wbsTaskFilter, setWbsTaskFilter] = useState<WbsTaskFilter>("진행 중");
  const [wbsFilterOpen, setWbsFilterOpen] = useState(false);
  const [wbsAdvancedOpen,setWbsAdvancedOpen]=useState(false);
  const emptyWbsFilters:WbsFilters={logic:"AND",statuses:["진행 중"],attention:[],owners:[],levels:[]};
  const [wbsFilters,setWbsFilters]=useState<WbsFilters>(emptyWbsFilters);
  const [draftWbsFilters,setDraftWbsFilters]=useState<WbsFilters>(emptyWbsFilters);
  const [wbsOwnerSearch,setWbsOwnerSearch]=useState("");
  const [wbsDialog, setWbsDialog] = useState<WbsDialog>(null);
  const [taskProgress, setTaskProgress] = useState<Record<string,number>>({"1.2.2":72});
  const [startedTasks, setStartedTasks] = useState<string[]>([]);

  useEffect(()=>{
    const handleWbsViewChange=(event:Event)=>{
      const target=(event as CustomEvent<WbsSection>).detail;
      if(target!=="actual"&&target!=="gantt"&&target!=="edit")return;
      setWbsSection(target);
      if(target!=="edit"){
        setWbsMode(target==="gantt"?"gantt":"list");
        setWbsWorkMode("operate");
      }
    };
    window.addEventListener("jsolution-wbs-view-change",handleWbsViewChange);
    return()=>window.removeEventListener("jsolution-wbs-view-change",handleWbsViewChange);
  },[]);

  useEffect(()=>{
    const handleArtifactPreview=(event:Event)=>{
      const detail=(event as CustomEvent<ArtifactPreviewData>).detail;
      if(!detail?.type||!detail.content)return;
      const suffix=`${detail.type}-${detail.fileBase||detail.title}`.replace(/[^a-z0-9가-힣_-]+/gi,"-").replace(/-+/g,"-").slice(0,80);
      const target:WorkspaceTab={key:`artifact-${suffix}`,label:`${artifactLabel(detail.type)} 미리보기`,view:"artifact-preview",artifact:detail};
      setWorkspaceTabs(current=>current.some(tab=>tab.key===target.key)?current.map(tab=>tab.key===target.key?target:tab):[...current,target]);
      setActiveWorkspaceKey(target.key);
      setView("artifact-preview");
      setSelected(null);
    };
    window.addEventListener("jsolution-ai-artifact-preview",handleArtifactPreview);
    return()=>window.removeEventListener("jsolution-ai-artifact-preview",handleArtifactPreview);
  },[]);

  useEffect(()=>{
    if(!selectedProject?.id)return;
    fetch(`/api/projects/${selectedProject.id}/wbs`,{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error();return response.json()}).then((result:{tasks?:ProjectWbsApiTask[]})=>{
      const tasks=result.tasks??[];const parentIds=new Set(tasks.map(task=>task.parentId).filter(Boolean));
      setWbsItems(tasks.map(task=>({id:task.wbsCode,title:task.name,owner:task.assigneeName||task.roleCode||"미배정",due:task.plannedEnd||"미정",progress:task.progress,state:task.status==="completed"?"완료":task.status==="active"?"진행 중":"예정",tone:task.status==="completed"?"done":task.status==="active"?"active":"planned",level:task.level,group:task.parentCode||task.wbsCode,children:parentIds.has(task.id),outputs:task.deliverables.length,issues:0})));
    }).catch(()=>setWbsItems([]));
  },[selectedProject?.id]);

  const completedCount = useMemo(() => completed.length + 4, [completed]);
  const visibleTasks = useMemo(() => tasks.filter(task => {
    const isDone = completed.includes(task.id);
    const matchesFilter = workFilter === "전체" || (workFilter === "오늘" && task.due.startsWith("오늘")) || (workFilter === "진행 중" && !isDone) || (workFilter === "완료" && isDone);
    const keyword = workSearch.trim().toLowerCase();
    return matchesFilter && (!keyword || `${task.title} ${task.project}`.toLowerCase().includes(keyword));
  }), [completed, workFilter, workSearch]);

  const workspaceTabFor = (next:View, nextAdminTab?:AdminTab):WorkspaceTab => {
    if(next === "home") return homeWorkspaceTab;
    if(next === "ai-conversations") return {key:"ai-conversations",label:"AI 대화",view:next};
    if(next === "ai-library") return {key:"ai-library",label:"AI 라이브러리",view:next};
    if(next === "ai-result-preview") {const result=aiAnalysisResults.find(item=>item.id===activeAnalysisId);return {key:`ai-result-${activeAnalysisId}`,label:result?.title||"AI 분석 자료",view:next,resultId:activeAnalysisId||undefined};}
    if(next === "search") { const searchQuery=submittedSearch||globalSearch||"전체"; return {key:`search-${searchQuery}`,label:`통합검색 · ${searchQuery}`,view:next,searchQuery}; }
    if(next === "project-dashboard") return {key:"project-dashboard",label:"프로젝트 AI HOME",view:next};
    if(next === "work") return {key:"work",label:"MY WORK",view:next};
    if(next === "project") return {key:"project",label:"프로젝트 목록",view:next};
    if(next === "wbs" || next === "wbs-editor") return {key:"wbs",label:"일정 · WBS",view:"wbs"};
    if(next === "documents") return {key:"documents",label:"문서 · 산출물",view:next};
    if(next === "issues") return {key:"issues",label:"이슈 · 리스크",view:next};
    const resolvedAdmin = nextAdminTab ?? adminTab;
    if(resolvedAdmin === "template") return {key:"admin-template",label:"프로젝트 템플릿",view:next,adminTab:resolvedAdmin};
    if(resolvedAdmin === "project") return {key:"admin-project",label:"새 프로젝트",view:next,adminTab:resolvedAdmin};
    return {key:"admin-organization",label:"시스템 관리",view:next,adminTab:"organization"};
  };

  function openDocumentPreview(data:DocumentPreviewData) {
    const target:WorkspaceTab={key:`document-preview-${data.versionId}`,label:data.title,view:"document-preview",documentPreview:data};
    setWorkspaceTabs(current=>current.some(tab=>tab.key===target.key)?current.map(tab=>tab.key===target.key?target:tab):[...current,target]);
    setActiveWorkspaceKey(target.key);
    setView("document-preview");
    setSelected(null);
    setMobileNav(false);
  }

  function moveTo(next:View, nextAdminTab?:AdminTab) {
    const resolvedNext:View=next==="wbs-editor"?"wbs":next;
    if(next==="wbs-editor")setWbsSection("edit");
    const target = workspaceTabFor(resolvedNext,nextAdminTab);
    setWorkspaceTabs(current => current.some(tab => tab.key === target.key) ? current : [...current,target]);
    setActiveWorkspaceKey(target.key);
    if(target.adminTab)setAdminTab(target.adminTab);
    setView(resolvedNext);
    setSelected(null);
    setMobileNav(false);
  }

  function openTemplateEditorTab(label:string) {
    const target:WorkspaceTab={key:"template-editor",label,view:"admin",adminTab:"template"};
    setWorkspaceTabs(current=>current.some(tab=>tab.key===target.key)?current:[...current,target]);
    setActiveWorkspaceKey(target.key);
    setAdminTab("template");
    setView("admin");
  }

  function closeEditorTab(key:string) {
    closeWorkspaceTab(key);
  }

  function activateWorkspaceTab(tab:WorkspaceTab) {
    setActiveWorkspaceKey(tab.key);
    if(tab.view==="ai-conversations")setAiWorkspaceMode("conversations");
    if(tab.view==="ai-library")setAiWorkspaceMode("analysis");
    setView(tab.view);
    if(tab.adminTab)setAdminTab(tab.adminTab);
    if(tab.resultId)setActiveAnalysisId(tab.resultId);
    if(tab.view==="search")setSubmittedSearch(tab.searchQuery??tab.label.replace(/^통합검색 · /,""));
    setSelected(null);
  }

  function openAnalysisPreview(item:AiAnalysisResult){
    const target:WorkspaceTab={key:`ai-result-${item.id}`,label:item.title,view:"ai-result-preview",resultId:item.id};
    setWorkspaceTabs(current=>current.some(tab=>tab.key===target.key)?current:[...current,target]);
    setActiveWorkspaceKey(target.key);setActiveAnalysisId(item.id);setView("ai-result-preview");setSelected(null);
  }

  function closeWorkspaceTab(key:string) {
    setWorkspaceTabs(current => {
      const index=current.findIndex(tab=>tab.key===key);
      if(index<0||current[index].fixed)return current;
      const nextTabs=current.filter(tab=>tab.key!==key);
      if(key===activeWorkspaceKey){
        const fallback=nextTabs[Math.min(index,nextTabs.length-1)]??homeWorkspaceTab;
        setActiveWorkspaceKey(fallback.key);
        setView(fallback.view);
        if(fallback.adminTab)setAdminTab(fallback.adminTab);
        if(fallback.view==="search")setSubmittedSearch(fallback.searchQuery??fallback.label.replace(/^통합검색 · /,""));
        setSelected(null);
      }
      return nextTabs;
    });
  }

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem("jsolution-sidebar-collapsed") === "true");
    } catch {/* Device-local layout preference is optional. */}
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed(current => {
      const next = !current;
      try { window.localStorage.setItem("jsolution-sidebar-collapsed", String(next)); } catch {/* Ignore unavailable storage. */}
      return next;
    });
  }

  useEffect(()=>{
    try{
      const stored=window.localStorage.getItem("jsolution-workspace-tabs");
      if(!stored)return;
      const parsed=JSON.parse(stored) as {tabs?:WorkspaceTab[];active?:string};
      const restored=[homeWorkspaceTab,...(parsed.tabs??[]).filter(tab=>tab.key!=="home"&&tab.view!=="wbs-editor"&&!String(tab.key||"").startsWith("wbs-editor"))];
      const requestedActive=String(parsed.active||"").startsWith("wbs-editor")?"wbs":parsed.active;
      const active=restored.find(tab=>tab.key===requestedActive)??restored[0];
      if(String(parsed.active||"").startsWith("wbs-editor"))setWbsSection("edit");
      // Restoring device-local workspace tabs is intentionally a one-time mount action.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspaceTabs(restored);
      setActiveWorkspaceKey(active.key);
      setView(active.view);
      if(active.view==="ai-conversations")setAiWorkspaceMode("conversations");
      if(active.view==="ai-library")setAiWorkspaceMode("analysis");
      if(active.adminTab)setAdminTab(active.adminTab);
      if(active.view==="search")setSubmittedSearch(active.searchQuery??active.label.replace(/^통합검색 · /,""));
    }catch{/* Ignore invalid device-local workspace state. */}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    if(skipInitialTabPersistence.current){skipInitialTabPersistence.current=false;return;}
    try{window.localStorage.setItem("jsolution-workspace-tabs",JSON.stringify({tabs:workspaceTabs,active:activeWorkspaceKey}));}catch{/* Storage may be unavailable. */}
  },[workspaceTabs,activeWorkspaceKey]);

  useEffect(()=>{
    fetch("/api/ai/conversations",{cache:"no-store"}).then(async response=>{
      if(!response.ok)return;
      const data=await response.json() as {conversations?:Array<{id:string;title:string;source:string;contextTitle:string;contextItems:AiContextItem[];updatedAt:number}>};
      if(data.conversations?.length)setConversations(data.conversations.map(item=>({id:item.id,title:item.title,source:item.source,context:item.contextTitle,time:new Date(item.updatedAt*1000).toLocaleString("ko-KR"),contextItems:item.contextItems||[]})));
    }).catch(()=>undefined);
    fetch("/api/state?key=workspace-progress",{cache:"no-store"}).then(async response=>response.ok?response.json():null).then(data=>{
      if(!data?.value)return;
      setCompleted(data.value.completed||[]);setTaskProgress(data.value.taskProgress||{"1.2.2":72});setStartedTasks(data.value.startedTasks||[]);
    }).catch(()=>undefined);
  },[]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:"workspace-progress",value:{completed,taskProgress,startedTasks}})}).then(response=>{if(response.ok){setSaveNotice("저장됨");window.setTimeout(()=>setSaveNotice(""),1200);}}).catch(()=>undefined),450);
    return()=>window.clearTimeout(timer);
  },[completed,taskProgress,startedTasks]);

  async function persistConversation(message:string,source:string,context:string,contextItems:AiContextItem[],id?:string|null){
    const existingTitle=id?conversations.find(item=>item.id===id)?.title:undefined;
    const response=await fetch("/api/ai/conversations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,title:existingTitle||message,source,contextType:view,contextTitle:context,contextItems,message})});
    if(!response.ok)throw new Error("AI 대화를 저장하지 못했습니다.");
    return await response.json() as {id:string};
  }

  async function askAI(text?: string) {
    const next = text ?? query;
    if (!next.trim()) return;
    setQuery(next);
    setAnswer(true);
    try{const saved=await persistConversation(next,"MY AI HOME","MY AI HOME",[],activeConversationId);setActiveConversationId(saved.id);setConversations(current => [{ id:saved.id, title:next, context:"MY AI HOME", source:"MY AI HOME", time:"방금 전",contextItems:[] }, ...current.filter(item=>item.id!==saved.id)]);}catch{setSaveNotice("저장 실패");}
  }

  const searchCatalog:AiContextItem[]=[
    ...projects.map((item,index)=>({id:`PROJECT-${index+1}`,kind:"프로젝트" as const,title:item.name,meta:`진행률 ${item.progress}% · ${item.issue}`})),
    ...wbsItems.map(item=>({id:`WBS-${item.id}`,kind:"WBS" as const,title:item.title,meta:`${item.owner} · ${item.state} · ${item.due}`})),
    ...issueItems.map(item=>({id:item.id,kind:"이슈" as const,title:item.title,meta:`${item.project} · ${item.status} · ${item.impact}`})),
    ...documentItems.map(item=>({id:item.id,kind:"문서" as const,title:item.title,meta:`${item.version} · ${item.project} · ${item.status}`})),
  ];
  const searchKeyword=submittedSearch.trim().toLowerCase();
  const searchResults=searchCatalog.filter(item=>!searchKeyword||`${item.id} ${item.kind} ${item.title} ${item.meta}`.toLowerCase().includes(searchKeyword));
  const selectedSearchItems=searchCatalog.filter(item=>selectedSearchIds.includes(item.id));
  async function runGlobalSearch(){
    const searchQuery=globalSearch.trim();
    if(!searchQuery)return;
    const target:WorkspaceTab={key:`search-${searchQuery}`,label:`통합검색 · ${searchQuery}`,view:"search",searchQuery};
    const matchedItems=searchCatalog.filter(item=>`${item.id} ${item.kind} ${item.title} ${item.meta}`.toLowerCase().includes(searchQuery.toLowerCase()));
    setSubmittedSearch(searchQuery);
    setSelectedSearchIds([]);
    setWorkspaceTabs(current=>current.some(tab=>tab.key===target.key)?current:[...current,target]);
    setActiveWorkspaceKey(target.key);
    setView("search");
    setSelected(null);
    setMobileNav(false);
    try{
      const saved=await persistConversation(searchQuery,"통합검색",`검색 결과 ${matchedItems.length}건`,matchedItems,null);
      setConversations(current=>[{id:saved.id,title:searchQuery,context:`검색 결과 ${matchedItems.length}건`,source:"통합검색",time:"방금 전",contextItems:matchedItems},...current.filter(item=>item.id!==saved.id)]);
    }catch{
      setSaveNotice("검색 기록을 MY AI HOME에 저장하지 못했습니다.");
    }
  }

  function currentAiContext(){
    const wbsContext=selectedWbsItems.map(item=>({id:`WBS-${item.id}`,kind:"WBS" as const,title:item.title,meta:`${item.owner} · ${item.state}`}));
    const merged=[...moduleDocumentContext,...moduleIssueContext,...wbsContext,...selectedSearchItems];
    return merged.filter((item,index)=>merged.findIndex(candidate=>candidate.kind===item.kind&&candidate.id===item.id)===index);
  }
  function removeCurrentAiContextItem(item:AiContextItem){
    if(item.kind==="문서"){
      setModuleDocumentContext(current=>current.filter(context=>context.id!==item.id));
      setDocumentSelectedIds(current=>current.filter(id=>id!==item.id));
    }else if(item.kind==="이슈"){
      setModuleIssueContext(current=>current.filter(context=>context.id!==item.id));
      setIssueSelectedIds(current=>current.filter(id=>id!==item.id));
    }else if(item.kind==="WBS"){
      const rawId=item.id.replace(/^WBS-/,"");
      setSelectedWbs(current=>current.filter(id=>id!==rawId));
    }else if(view==="search"){
      setSelectedSearchIds(current=>current.filter(id=>id!==item.id));
    }
    if(currentAiContext().filter(context=>context.id!==item.id).length===0)setSelected(null);
  }
  function clearCurrentAiContext(){
    setModuleDocumentContext([]);
    setModuleIssueContext([]);
    setDocumentSelectedIds([]);
    setIssueSelectedIds([]);
    setSelectedWbs([]);
    setSelectedSearchIds([]);
    setSelected(null);
  }
  async function openConversationWorkspace(chat?:Conversation){
    const target=workspaceTabFor("ai-conversations");
    setWorkspaceTabs(current=>current.some(tab=>tab.key===target.key)?current:[...current,target]);
    setActiveWorkspaceKey(target.key);
    setAiWorkspaceMode("conversations");
    setView("ai-conversations");
    setSelected(null);
    setMobileNav(false);
    if(chat)await loadWorkspaceConversation(chat);
  }

  function openAiLibraryWorkspace(){
    const target=workspaceTabFor("ai-library");
    setWorkspaceTabs(current=>current.some(tab=>tab.key===target.key)?current:[...current,target]);
    setActiveWorkspaceKey(target.key);
    setAiWorkspaceMode("analysis");
    setView("ai-library");
    setSelected(null);
    setMobileNav(false);
  }

  async function loadWorkspaceConversation(chat:Conversation){
    setActiveConversationId(chat.id);
    setPanelMessages([]);
    setMessagesLoading(true);
    try{
      const response=await fetch(`/api/ai/conversations?id=${encodeURIComponent(chat.id)}`,{cache:"no-store"});
      if(!response.ok)throw new Error("대화 내용을 불러오지 못했습니다.");
      const data=await response.json() as {messages?:AiMessage[]};
      setPanelMessages(data.messages??[]);
    }catch{
      setSaveNotice("이전 대화를 불러오지 못했습니다.");
    }finally{
      setMessagesLoading(false);
    }
  }

  async function continueWorkspaceConversation(){
    const message=conversationQuery.trim();
    const chat=conversations.find(item=>item.id===activeConversationId);
    if(!message||!chat)return;
    try{
      const saved=await persistConversation(message,chat.source,chat.context,chat.contextItems,chat.id);
      setActiveConversationId(saved.id);
      setPanelMessages(current=>[...current,{id:`local-${Date.now()}`,role:"user",content:message,createdAt:Math.floor(Date.now()/1000)}]);
      setConversations(current=>current.map(item=>item.id===saved.id?{...item,time:"방금 전"}:item));
      setConversationQuery("");
    }catch{
      setSaveNotice("대화 저장에 실패했습니다.");
    }
  }

  async function openConversation(chat:Conversation){
    setActiveConversationId(chat.id);
    setPanelMessages([]);
    openItem({kind:"업무",title:chat.title,subtitle:`${chat.source} · ${chat.context}`},"ai");
    setMessagesLoading(true);
    try{
      const response=await fetch(`/api/ai/conversations?id=${encodeURIComponent(chat.id)}`,{cache:"no-store"});
      if(!response.ok)throw new Error("대화 내용을 불러오지 못했습니다.");
      const data=await response.json() as {messages?:AiMessage[]};
      setPanelMessages(data.messages??[]);
    }catch{
      setSaveNotice("이전 대화를 불러오지 못했습니다.");
    }finally{
      setMessagesLoading(false);
    }
  }

  function openGlobalAI(){
    const items=currentAiContext();
    if((["search","documents","issues"] as View[]).includes(view)&&!items.length){setSaveNotice(view==="search"?"분석할 검색 결과를 선택해 주세요.":view==="documents"?"분석할 산출물을 1건 이상 선택해 주세요.":"분석할 이슈·리스크를 1건 이상 선택해 주세요.");return;}
    const first=items[0];
    openItem(first?{kind:first.kind,title:items.length>1?`선택 자료 ${items.length}건`:first.title,subtitle:items.map(item=>item.title).join(" · "),documentId:first.kind==="문서"?first.id:undefined,issueId:first.kind==="이슈"?first.id:undefined,wbsId:first.kind==="WBS"?first.id.replace("WBS-",""):undefined}:{kind:"업무",title:"MY AI",subtitle:"현재 화면의 업무 문맥"},"ai");
    setActiveConversationId(null);
    setPanelMessages([]);
  }

  function openItem(item: SelectedItem, mode: PanelMode = "detail") {
    setSelected(item);
    setPanelMode(mode);
  }

  function toggleWbs(id: string) {
    setExpandedWbs(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  const wbsMatchesQuickFilter = (item:(typeof wbsItems)[number], filter:WbsTaskFilter) => {
    const progress = taskProgress[item.id] ?? item.progress;
    if (filter === "전체 업무") return true;
    if (filter === "진행 중") return progress > 0 && progress < 100;
    if (filter === "내 업무") return item.owner === "Dean Kim";
    if (filter === "미시작 Task") return progress === 0 || item.tone === "planned";
    if (filter === "지연 Task") return item.tone === "risk";
    if (filter === "이슈 Task") return item.issues > 0;
    if (filter === "완료") return progress === 100;
    return item.state === "보류";
  };
  const wbsMatchesFilter = (item:(typeof wbsItems)[number]) => {
    if(item.children)return false;
    const progress=taskProgress[item.id]??item.progress;
    const statusValues=[progress===0||item.tone==="planned"?"미시작":progress===100?"완료":item.state==="보류"?"보류":"진행 중"];
    const attentionValues=[item.tone==="risk"?"지연":null,item.issues>0?"이슈 있음":null,item.outputs===0?"산출물 미등록":null].filter(Boolean) as string[];
    const tests=[
      wbsFilters.statuses.length?wbsFilters.statuses.some(value=>statusValues.includes(value)):true,
      wbsFilters.attention.length?wbsFilters.attention.some(value=>attentionValues.includes(value)):true,
      wbsFilters.owners.length?wbsFilters.owners.includes(item.owner):true,
      wbsFilters.levels.length?wbsFilters.levels.includes(`Level ${item.level}`):true,
    ];
    const active=[wbsFilters.statuses.length>0,wbsFilters.attention.length>0,wbsFilters.owners.length>0,wbsFilters.levels.length>0];
    const relevant=tests.filter((_,index)=>active[index]);
    return !relevant.length||(wbsFilters.logic==="AND"?relevant.every(Boolean):relevant.some(Boolean));
  };
  const matchedWbsIds = new Set(wbsItems.filter(wbsMatchesFilter).map(item => item.id));
  wbsItems.forEach(item => {
    if (matchedWbsIds.has(item.id)) {
      const parts = item.id.split(".");
      while (parts.length > 1) { parts.pop(); matchedWbsIds.add(parts.join(".")); }
    }
  });
  const visibleWbsItems = wbsItems.filter(item => {
    const expanded = item.level === 1 || (item.level === 2 ? expandedWbs.includes(item.group) : expandedWbs.includes("1") && expandedWbs.includes(item.group));
    return expanded && matchedWbsIds.has(item.id);
  });
  const wbsFilterCounts:Record<WbsTaskFilter,number> = {
    "전체 업무": wbsItems.filter(item=>!item.children).length,
    "진행 중": wbsItems.filter(item=>!item.children && (taskProgress[item.id] ?? item.progress)>0 && (taskProgress[item.id] ?? item.progress)<100).length,
    "내 업무": wbsItems.filter(item=>!item.children && item.owner==="Dean Kim").length,
    "미시작 Task": wbsItems.filter(item=>!item.children && ((taskProgress[item.id] ?? item.progress)===0 || item.tone==="planned")).length,
    "지연 Task": wbsItems.filter(item=>!item.children && item.tone==="risk").length,
    "이슈 Task": wbsItems.filter(item=>!item.children && item.issues>0).length,
    "완료": wbsItems.filter(item=>!item.children && (taskProgress[item.id] ?? item.progress)===100).length,
    "보류": wbsItems.filter(item=>!item.children && item.state==="보류").length,
  };
  const activeWbsFilterCount=wbsFilters.statuses.length+wbsFilters.attention.length+wbsFilters.owners.length+wbsFilters.levels.length;
  const toggleWbsDraft=(key:"statuses"|"attention"|"owners"|"levels",value:string)=>setDraftWbsFilters(current=>({...current,[key]:current[key].includes(value)?current[key].filter(item=>item!==value):[...current[key],value]}));
  const applyWbsQuickFilter=(filter:WbsTaskFilter)=>{
    setWbsTaskFilter(filter);
    const next:WbsFilters={logic:"AND",statuses:[],attention:[],owners:[],levels:[]};
    if(filter==="진행 중")next.statuses=["진행 중"];
    if(filter==="미시작 Task")next.statuses=["미시작"];
    if(filter==="완료"||filter==="보류")next.statuses=[filter];
    if(filter==="지연 Task")next.attention=["지연"];
    if(filter==="이슈 Task")next.attention=["이슈 있음"];
    if(filter==="내 업무")next.owners=["Dean Kim"];
    setWbsFilters(next);
    setWbsFilterOpen(false);
  };
  const matchesAdvanced = (values: string[], filters: AdvancedFilters) => {
    const tests = [
      filters.projects.length ? filters.projects.includes(values[0]) : true,
      filters.criteria.length ? filters.criteria.some(value => values.includes(value)) : true,
      filters.owners.length ? filters.owners.includes(values[values.length - 1]) : true,
    ];
    const active = [filters.projects.length > 0, filters.criteria.length > 0, filters.owners.length > 0];
    const relevant = tests.filter((_, index) => active[index]);
    return !relevant.length || (filters.logic === "AND" ? relevant.every(Boolean) : relevant.some(Boolean));
  };
  const visibleIssues = issueItems.filter(item => (issueFilter === "전체" || item.severity === issueFilter || item.status === issueFilter) && matchesAdvanced([item.project, item.severity, item.status, item.owner], issueAdvanced));
  const visibleDocuments = documentItems.filter(item => (documentFilter === "전체" || item.status === documentFilter) && matchesAdvanced([item.project, item.status, item.type, item.owner], documentAdvanced));
  const selectedDocument = selected?.kind === "문서" ? documentItems.find(item => item.id === selected.documentId) : undefined;

  const activeFilterCount = (filters: AdvancedFilters) => filters.projects.length + filters.criteria.length + filters.owners.length;
  function openFilters(scope: Exclude<FilterScope, null>) {
    const current = scope === "issues" ? issueAdvanced : documentAdvanced;
    setDraftFilters({ projects:[...current.projects], logic:current.logic, criteria:[...current.criteria], owners:[...current.owners] });
    setProjectFilterSearch("");
    setOwnerFilterSearch("");
    setFilterScope(scope);
  }
  function toggleDraft(group: "projects" | "criteria" | "owners", value: string) {
    setDraftFilters(current => ({...current, [group]: current[group].includes(value) ? current[group].filter(item => item !== value) : [...current[group], value]}));
  }
  function applyAdvancedFilters() {
    if (filterScope === "issues") setIssueAdvanced(draftFilters);
    if (filterScope === "documents") setDocumentAdvanced(draftFilters);
    setFilterScope(null);
  }
  function clearAdvancedFilters(scope: Exclude<FilterScope, null>) {
    if (scope === "issues") setIssueAdvanced(emptyFilters);
    else setDocumentAdvanced(emptyFilters);
  }
  const projectOptions = projects.filter(project => !projectFilterSearch.trim() || project.name.toLowerCase().includes(projectFilterSearch.trim().toLowerCase()));
  const ownerOptions = ["Dean Kim","박지연","이도현","김서준"].filter(owner => !ownerFilterSearch.trim() || owner.toLowerCase().includes(ownerFilterSearch.trim().toLowerCase()));
  const selectedIssueItems = issueItems.filter(item => selectedIssues.includes(item.id));
  const selectedIssueProjects = new Set(selectedIssueItems.map(item => item.project)).size;
  const selectedDocumentItems = documentItems.filter(item => selectedDocs.includes(item.id));
  const selectedDocumentProjects = new Set(selectedDocumentItems.map(item => item.project)).size;
  const selectedWbsItems = wbsItems.filter(item => selectedWbs.includes(item.id));
  const selectedWbsIssues = selectedWbsItems.reduce((sum, item) => sum + item.issues, 0);
  const selectedWbsOutputs = selectedWbsItems.reduce((sum, item) => sum + item.outputs, 0);
  const dialogWbs = wbsDialog ? wbsItems.find(item => item.id === wbsDialog.id) : undefined;

  async function askPanelAI() {
    const message=panelQuery.trim();
    if(!message||!selected||panelSending)return;
    const items=currentAiContext();
    if(!items.length){setSaveNotice("AI로 분석할 업무 문맥을 선택해 주세요.");return;}
    const source=view==="search"?"통합검색":items.some(item=>item.kind==="문서")&&items.some(item=>item.kind==="이슈")?"문서 · 산출물 + 이슈 · 리스크":items.some(item=>item.kind==="문서")?"문서 · 산출물":items.some(item=>item.kind==="이슈")?"이슈 · 리스크":items.some(item=>item.kind==="WBS")?"일정 · WBS":"프로젝트 AI HOME";
    const projectName=selectedProject?.name||selected.subtitle.split(" · ")[0]||"현재 프로젝트";
    const now=Math.floor(Date.now()/1000);
    setPanelSending(true);
    setPanelQuery("");
    setPanelMessages(current=>[...current,{id:`local-user-${Date.now()}`,role:"user",content:message,createdAt:now}]);
    try{
      const response=await fetch("/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({conversationId:activeConversationId||undefined,projectName,contextItems:items,message,source,contextType:"mixed",contextTitle:selected.title})});
      const data=await response.json() as {conversationId?:string;answer?:string;error?:string;saved?:boolean};
      const conversationId=data.conversationId||activeConversationId||"";
      if(conversationId)setActiveConversationId(conversationId);
      const answer=data.answer||(response.ok?"응답 내용이 없습니다.":`AI 연결 오류: ${data.error||"응답을 받지 못했습니다."}`);
      setPanelMessages(current=>[...current,{id:`local-ai-${Date.now()}`,role:"assistant",content:response.ok?answer:(data.saved?`${answer}\n\nAI 연결 오류: ${data.error||"응답을 받지 못했습니다."}`:answer),createdAt:now+1}]);
      if(conversationId){
        const conversationTitle=activeConversationId?(conversations.find(item=>item.id===conversationId)?.title||message):message;
        setConversations(current=>[{id:conversationId,title:conversationTitle,context:selected.title,source,time:"방금 전",contextItems:items},...current.filter(item=>item.id!==conversationId)]);
        const artifactType=response.ok?detectAiArtifactType(message):null;
        if(artifactType&&data.answer){
          saveAiArtifactResult({type:artifactType,content:data.answer,fileBase:`${selected.title||conversationTitle}-AI결과`,title:selected.title||conversationTitle,project:projectName,source:`${source} AI 대화 · ${artifactLabel(artifactType)} 생성`,conversationId,conversationTitle});
          try{const stored=window.localStorage.getItem("jsolution-ai-analysis-results");if(stored)setAiAnalysisResults(JSON.parse(stored) as AiAnalysisResult[]);}catch{}
        }
      }
    }catch(error){
      setPanelMessages(current=>[...current,{id:`local-error-${Date.now()}`,role:"assistant",content:`AI 연결 오류: ${error instanceof Error?error.message:"응답을 받지 못했습니다."}`,createdAt:now+1}]);
    }finally{setPanelSending(false);}
  }

  function saveAnalysisResult(location:"personal"|"project") {
    const chat=conversations.find(item=>item.id===activeConversationId);
    const latestAssistant=[...panelMessages].reverse().find(message=>message.role==="assistant");
    const title=selected?.title||chat?.title||"AI 분석 결과";
    const result:AiAnalysisResult={
      id:`AI-${location==="personal"?"M":"P"}-${Date.now()}`,
      title:`${title} 분석 결과`,
      summary:latestAssistant?.content||`${title}에 대한 AI 분석 내용과 연결 자료를 참조용으로 보관했습니다.`,
      location,
      project:location==="project"?(selected?.subtitle.split(" · ")[0]||chat?.context||"A사 AI PMS 구축"):"개인 업무",
      source:selected?(`${selected.kind} AI 대화`):(chat?.source||"MY AI 대화"),
      createdAt:"방금 전",
      author:"Dean Kim",
    };
    setAiAnalysisResults(current=>{
      const next=[result,...current];
      try{window.localStorage.setItem("jsolution-ai-analysis-results",JSON.stringify(next));}catch{}
      return next;
    });
    setSaveNotice(location==="project"?"프로젝트 AI 분석 자료에 저장했습니다.":"개인 AI 분석 보관함에 저장했습니다.");
    window.setTimeout(()=>setSaveNotice(""),2200);
  }

  function removeAnalysisResult(id:string) {
    setAiAnalysisResults(current=>{
      const next=current.filter(item=>item.id!==id);
      try{window.localStorage.setItem("jsolution-ai-analysis-results",JSON.stringify(next));}catch{}
      return next;
    });
  }

  function updateConversation(id:string,patch:Partial<Conversation>){
    setConversations(current=>{
      const next=current.map(item=>item.id===id?{...item,...patch}:item);
      try{window.localStorage.setItem("jsolution-ai-conversation-organization",JSON.stringify(next.map(({id,favorite,archived})=>({id,favorite,archived}))));}catch{}
      return next;
    });
  }

  function removeConversation(id:string){
    setConversations(current=>current.filter(item=>item.id!==id));
    if(activeConversationId===id){setActiveConversationId(null);setPanelMessages([]);}
  }

  const filteredConversations=conversations.filter(chat=>{
    const modeMatches=conversationMode==="favorite"?chat.favorite:conversationMode==="archived"?chat.archived:!chat.archived;
    const keyword=conversationSearch.trim().toLowerCase();
    return modeMatches&&(!keyword||`${chat.title} ${chat.context} ${chat.source}`.toLowerCase().includes(keyword));
  });

  const aiFilterCount=aiFilters.locations.length+aiFilters.projects.length+aiFilters.sources.length+aiFilters.authors.length;
  const filteredAnalysisResults=aiAnalysisResults.filter(item=>{
    const kindMatches=analysisKind==="all"||item.location===analysisKind;
    const keyword=analysisSearch.trim().toLowerCase();
    const searchMatches=!keyword||`${item.id} ${item.title} ${item.summary} ${item.project} ${item.source} ${item.author}`.toLowerCase().includes(keyword);
    const tests=[
      aiFilters.locations.length?aiFilters.locations.includes(item.location):true,
      aiFilters.projects.length?aiFilters.projects.includes(item.project):true,
      aiFilters.sources.length?aiFilters.sources.includes(item.source):true,
      aiFilters.authors.length?aiFilters.authors.includes(item.author):true,
    ];
    const active=[aiFilters.locations.length>0,aiFilters.projects.length>0,aiFilters.sources.length>0,aiFilters.authors.length>0];
    const relevant=tests.filter((_,index)=>active[index]);
    return kindMatches&&searchMatches&&(!relevant.length||(aiFilters.logic==="AND"?relevant.every(Boolean):relevant.some(Boolean)));
  });
  const draftFilteredAnalysisCount=aiAnalysisResults.filter(item=>{
    const tests=[draftAiFilters.locations.length?draftAiFilters.locations.includes(item.location):true,draftAiFilters.projects.length?draftAiFilters.projects.includes(item.project):true,draftAiFilters.sources.length?draftAiFilters.sources.includes(item.source):true,draftAiFilters.authors.length?draftAiFilters.authors.includes(item.author):true];
    const active=[draftAiFilters.locations.length>0,draftAiFilters.projects.length>0,draftAiFilters.sources.length>0,draftAiFilters.authors.length>0];
    const relevant=tests.filter((_,index)=>active[index]);
    return !relevant.length||(draftAiFilters.logic==="AND"?relevant.every(Boolean):relevant.some(Boolean));
  }).length;

  function toggleAiDraft<K extends "locations"|"projects"|"sources"|"authors">(key:K,value:AiResultFilters[K][number]){
    setDraftAiFilters(current=>({...current,[key]:current[key].includes(value as never)?current[key].filter(item=>item!==value):[...current[key],value]} as AiResultFilters));
  }

  useEffect(()=>{
    try{
      const stored=window.localStorage.getItem("jsolution-ai-analysis-results");
      if(stored)setAiAnalysisResults(JSON.parse(stored) as AiAnalysisResult[]);
    }catch{}
  },[]);

  useEffect(()=>{
    try{
      const stored=window.localStorage.getItem("jsolution-ai-conversation-organization");
      if(!stored)return;
      const organization=JSON.parse(stored) as Array<{id:string;favorite?:boolean;archived?:boolean}>;
      setConversations(current=>current.map(item=>({...item,...organization.find(saved=>saved.id===item.id)})));
    }catch{}
  },[]);

  return (
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileNav ? "is-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="brand">
          <div className="brand-mark">J</div>
          <div>
<strong>J SOLUTION</strong>
<span>AI PMS</span>
</div>
          <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"} title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}>
            <ChevronRight size={17} className={sidebarCollapsed ? "" : "toggle-flipped"}/>
          </button>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기">
<X size={20}/>
</button>
        </div>

        <nav className="main-nav" aria-label="주 메뉴">
          <p className="nav-label">AI WORKSPACE</p>
          <button className={`nav-item ${view === "ai-conversations" ? "active" : ""}`} onClick={() => void openConversationWorkspace()}>
            <MessageSquareText size={19}/><span>AI 대화</span>{view === "ai-conversations" && <ChevronRight size={16} className="nav-arrow"/>}
          </button>
          <button className={`nav-item ${view === "ai-library" ? "active" : ""}`} onClick={openAiLibraryWorkspace}>
            <FolderOpen size={19}/><span>AI 라이브러리</span>{view === "ai-library" && <ChevronRight size={16} className="nav-arrow"/>}
          </button>
          <p className="nav-label second">AI HOME</p>
          {nav.slice(0, 3).map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${(label === "MY AI HOME" && view === "home") || (label === "프로젝트 AI HOME" && view === "project-dashboard") ? "active" : ""}`} onClick={() => label === "MY AI HOME" ? moveTo("home") : label === "프로젝트 AI HOME" ? moveTo("project-dashboard") : setMobileNav(false)}>
              <Icon size={19}/>
<span>{label}</span>{((label === "MY AI HOME" && view === "home") || (label === "프로젝트 AI HOME" && view === "project-dashboard")) && <ChevronRight size={16} className="nav-arrow"/>}
            </button>
          ))}
          <p className="nav-label second">WORK MANAGEMENT</p>
          <button className={`nav-item ${view === "admin" && adminTab === "template" ? "active" : ""}`} onClick={() => moveTo("admin","template")}><Layers3 size={19}/><span>프로젝트 템플릿</span></button>
          <button className={`nav-item ${view === "project" ? "active" : ""}`} onClick={() => moveTo("project")}><Target size={19}/><span>프로젝트 목록</span></button>
          <button className={`nav-item ${view === "wbs" ? "active" : ""}`} onClick={() => moveTo("wbs")}><GanttChartSquare size={19}/><span>일정 · WBS</span></button>
          {nav.slice(3).map(({ label, icon: Icon, badge }) => label === "프로젝트" || label === "일정 · WBS" ? null : (
            <button key={label} className={`nav-item ${(label === "MY WORK" && view === "work") || (label === "일정 · WBS" && view === "wbs") || (label === "문서 · 산출물" && view === "documents") || (label === "이슈 · 리스크" && view === "issues") ? "active" : ""}`} onClick={() => label === "MY WORK" ? moveTo("work") : label === "일정 · WBS" ? moveTo("wbs") : label === "문서 · 산출물" ? moveTo("documents") : label === "이슈 · 리스크" ? moveTo("issues") : setMobileNav(false)}>
              <Icon size={19}/>
<span>{label}</span>{badge && <em>{label === "MY WORK" ? Math.max(0, 7 - completed.length) : badge}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${view === "admin" && adminTab === "organization" ? "active" : ""}`} onClick={() => moveTo("admin","organization")}>
<Settings size={19}/>
<span>시스템 관리</span>
</button>
          <div className="user-mini">
<div className="avatar">DK</div>
<div>
<strong>Dean Kim</strong>
<span>관리자</span>
</div>
<MoreHorizontal size={18}/>
</div>
        </div>
      </aside>

      {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기"/>}

      <section className={`workspace ${selected ? "with-context-panel" : ""}`}>
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="메뉴 열기">
<Menu size={22}/>
</button>
          <div className="global-search">
<Search size={18}/>
<input value={globalSearch} onChange={event=>setGlobalSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void runGlobalSearch();}} aria-label="통합 검색" placeholder="프로젝트, 업무, 문서를 검색하세요"/>
<kbd>⌘ K</kbd>
</div>
          <div className="top-actions">
            <button className="icon-button notification" aria-label="알림">
<Bell size={20}/>
<i/>
</button>
            <button className="profile">
<div className="avatar">DK</div>
<span>Dean Kim</span>
<ChevronDown size={15}/>
</button>
          </div>
        </header>

        <nav className="workspace-tabs" aria-label="열린 작업">
          <div className="workspace-tabs-scroll">
            {workspaceTabs.map(tab=><div key={tab.key} className={`workspace-tab ${activeWorkspaceKey===tab.key?"active":""}`}>
              <button className="workspace-tab-label" onClick={()=>activateWorkspaceTab(tab)} aria-current={activeWorkspaceKey===tab.key?"page":undefined}>{tab.label}</button>
              {!tab.fixed&&<button className="workspace-tab-close" onClick={()=>closeWorkspaceTab(tab.key)} aria-label={`${tab.label} 탭 닫기`}><X size={13}/></button>}
            </div>)}
          </div>
          <span className="workspace-tab-count">{workspaceTabs.length}개 작업</span>
        </nav>

        {view === "document-preview" ? (()=>{const preview=workspaceTabs.find(tab=>tab.key===activeWorkspaceKey)?.documentPreview;return preview?<DocumentFilePreviewView data={preview}/>:<div className="content"><section className="panel ai-results-empty"><FileText size={30}/><strong>문서 미리보기 정보를 찾을 수 없습니다.</strong></section></div>;})() : view === "artifact-preview" ? (()=>{const artifact=workspaceTabs.find(tab=>tab.key===activeWorkspaceKey)?.artifact;return artifact?<ArtifactPreviewView data={artifact}/>:<div className="content"><section className="panel ai-results-empty"><FileText size={30}/><strong>미리보기 자료를 찾을 수 없습니다.</strong></section></div>;})() : view === "ai-result-preview" ? <div className="content ai-preview-content">
          {(()=>{const item=aiAnalysisResults.find(result=>result.id===activeAnalysisId);return item?<section className="panel ai-preview-document">
            <header><div><p className="eyebrow"><Sparkles size={15}/> AI 분석 자료</p><h1>{item.title}</h1><p>{item.id} · {item.location==="personal"?"개인 보관":"프로젝트 자료"} · {item.createdAt}</p></div><span className={item.location==="personal"?"personal-store-badge":"project-store-badge"}>{item.location==="personal"?"나만 보기":"프로젝트 공유"}</span></header>
            <div className="ai-preview-paper"><div className="ai-preview-meta"><span><b>연결 위치</b>{item.project}</span><span><b>생성 경로</b>{item.source}</span><span><b>작성자</b>{item.author}</span></div><h2>AI 분석 요약</h2><p>{item.summary}</p><div className="ai-preview-callout"><Sparkles size={18}/><span><b>AI 생성 참조자료</b>분석에 사용한 원본 자료와 대화 문맥을 유지하며, 관련 후속 질문은 MY AI 대화에서 이어갈 수 있습니다.</span></div></div>
          </section>:<section className="panel ai-results-empty"><Sparkles size={30}/><strong>자료를 찾을 수 없습니다.</strong></section>;})()}
        </div> : view === "search" ? <div className="content search-content">
          <section className="issue-heading search-heading"><div><p className="eyebrow"><Search size={15}/> 통합검색</p><h1>‘{submittedSearch}’ 검색 결과</h1><p>프로젝트·WBS·이슈·문서를 한 번에 찾고, 필요한 결과만 선택해 전역 AI 아이콘으로 분석하세요.</p></div><span className="search-total">총 {searchResults.length}건</span></section>
          <section className="panel search-results-panel">
            <div className="search-result-tabs"><button className="active">전체 <em>{searchResults.length}</em></button>{(["프로젝트","WBS","이슈","문서"] as const).map(kind=><button key={kind}>{kind} <em>{searchResults.filter(item=>item.kind===kind).length}</em></button>)}</div>
            <div className="search-result-head"><span/><span>구분</span><span>검색 결과</span><span>관련 정보</span></div>
            <div className="search-result-list">{searchResults.map(item=><article key={item.id} className={selectedSearchIds.includes(item.id)?"selected":""}>
              <button className={`doc-check ${selectedSearchIds.includes(item.id)?"checked":""}`} onClick={()=>setSelectedSearchIds(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id])} aria-label={`${item.title} 선택`}>{selectedSearchIds.includes(item.id)&&<Check size={13}/>}</button>
              <em className={`search-kind kind-${item.kind}`}>{item.kind}</em><button className="search-result-title" onClick={()=>openItem({kind:item.kind,title:item.title,subtitle:item.meta,documentId:item.kind==="문서"?item.id:undefined,issueId:item.kind==="이슈"?item.id:undefined,wbsId:item.kind==="WBS"?item.id.replace("WBS-",""):undefined})}><strong>{item.title}</strong><small>{item.id}</small></button><span>{item.meta}</span>
            </article>)}</div>
            {!searchResults.length&&<div className="empty-work"><Search size={30}/><strong>검색 결과가 없습니다.</strong><p>프로젝트명, 문서명, 담당자 또는 ID로 다시 검색해 보세요.</p></div>}
          </section>
          <section className={`search-ai-guide ${selectedSearchIds.length?"ready":""}`}><Sparkles size={19}/><div><strong>{selectedSearchIds.length?`${selectedSearchIds.length}건이 AI 분석 대상으로 선택됐어요.`:"AI로 분석할 결과를 선택하세요."}</strong><p>{selectedSearchIds.length?"우측 AI 아이콘의 숫자를 확인하고 눌러 문맥형 대화를 시작하세요.":"체크박스로 1건 이상 선택하면 전역 AI 아이콘에 선택 수가 표시됩니다."}</p></div></section>
        </div> : (view === "ai-conversations" || view === "ai-library") ? <div className="content ai-conversations-content">
          <section className="ai-conversations-heading">
            <div><p className="eyebrow"><MessageSquareText size={15}/> MY AI 대화</p><h1>대화와 분석 자료</h1><p>AI 대화를 이어가고, 대화에서 저장한 개인·프로젝트 분석 자료를 한곳에서 관리합니다.</p></div>
            <span className="conversation-count">{aiWorkspaceMode==="conversations"?`${conversations.filter(item=>!item.archived).length}개 대화`:`${filteredAnalysisResults.length}개 자료`}</span>
          </section>
          {view==="ai-conversations"?<section className="ai-conversations-workspace panel">
            <aside className="ai-conversation-browser">
              <label className="ai-conversation-search"><Search size={17}/><input value={conversationSearch} onChange={event=>setConversationSearch(event.target.value)} placeholder="대화 제목, 프로젝트 검색"/></label>
              <div className="conversation-organize-tabs"><button className={conversationMode==="all"?"active":""} onClick={()=>setConversationMode("all")}>전체</button><button className={conversationMode==="favorite"?"active":""} onClick={()=>setConversationMode("favorite")}>즐겨찾기</button><button className={conversationMode==="archived"?"active":""} onClick={()=>setConversationMode("archived")}>보관</button></div>
              <div className="ai-conversation-browser-head"><strong>{conversationMode==="all"?"전체 대화":conversationMode==="favorite"?"즐겨찾는 대화":"보관한 대화"}</strong><small>최근 업데이트순</small></div>
              <div className="ai-conversation-browser-list">
                {filteredConversations.map(chat=><div className={`conversation-row ${activeConversationId===chat.id?"active":""}`} key={chat.id}><button className="conversation-open" onClick={()=>void loadWorkspaceConversation(chat)}>
                  <span className="conversation-icon"><MessageSquareText size={17}/></span><span><strong>{chat.title}</strong><small>{chat.source} · {chat.context}</small><time>{chat.time}</time></span><ChevronRight size={16}/>
                </button><button className={`conversation-star ${chat.favorite?"active":""}`} onClick={()=>updateConversation(chat.id,{favorite:!chat.favorite})} aria-label="즐겨찾기"><Star size={14} fill={chat.favorite?"currentColor":"none"}/></button></div>)}
                {!filteredConversations.length&&<div className="ai-conversation-empty"><MessageSquareText size={28}/><strong>조건에 맞는 대화가 없습니다.</strong></div>}
              </div>
            </aside>
            <div className="ai-conversation-room">
              {activeConversationId ? <>
                <header>{(()=>{const chat=conversations.find(item=>item.id===activeConversationId);return <><div><span>MY AI 대화</span><h2>{chat?.title??"대화"}</h2><p>{chat?.source} · {chat?.context}</p></div><div className="conversation-room-actions"><button onClick={()=>chat&&updateConversation(chat.id,{favorite:!chat.favorite})} title="즐겨찾기"><Star size={15} fill={chat?.favorite?"currentColor":"none"}/></button><button onClick={()=>chat&&updateConversation(chat.id,{archived:!chat.archived})} title={chat?.archived?"보관 해제":"보관"}><Archive size={15}/></button><button className="danger" onClick={()=>chat&&removeConversation(chat.id)} title="대화 삭제"><Trash2 size={15}/></button><em>{chat?.contextItems.length??0}개 자료 연결</em></div></>;})()}</header>
                <div className="ai-conversation-messages">
                  {messagesLoading?<div className="ai-conversation-empty"><Sparkles size={28}/><strong>대화를 불러오는 중입니다.</strong></div>:panelMessages.length?panelMessages.map(message=><article key={message.id} className={message.role}><span>{message.role==="assistant"?<Bot size={17}/>:<div className="avatar">DK</div>}</span><div><b>{message.role==="assistant"?"J SOLUTION AI":"Dean Kim"}</b><p>{message.content}</p></div></article>):<div className="ai-conversation-empty"><Sparkles size={28}/><strong>이 대화에서 이어서 질문해 보세요.</strong></div>}
                </div>
                <div className="ai-conversation-composer"><textarea value={conversationQuery} onChange={event=>setConversationQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void continueWorkspaceConversation();}}} placeholder="후속 질문을 입력하세요. Enter로 전송, Shift+Enter로 줄바꿈"/><button onClick={()=>void continueWorkspaceConversation()} disabled={!conversationQuery.trim()} aria-label="후속 질문 보내기"><Send size={18}/></button></div>
              </>:<div className="ai-conversation-welcome"><div className="ai-orb"><Sparkles size={24}/></div><h2>이어갈 대화를 선택하세요</h2><p>왼쪽 목록에서 대화를 선택하면 전체 내용과 연결 자료를 확인하고 후속 질문을 이어갈 수 있습니다.</p></div>}
            </div>
          </section>:<section className="panel integrated-ai-results">
            <div className="integrated-ai-results-head"><div><span>AI DATA</span><h2>저장한 AI 분석 자료</h2><p>대화에서 선별해 저장한 개인·프로젝트 분석 결과를 검색합니다.</p></div><button className={aiFilterCount?"active":""} onClick={()=>{setDraftAiFilters(aiFilters);setAiFilterOpen(true)}}><ListFilter size={16}/> 필터 {aiFilterCount>0&&<b>{aiFilterCount}</b>}</button></div>
            <div className="analysis-list-toolbar"><div className="analysis-kind-tabs"><button className={analysisKind==="all"?"active":""} onClick={()=>setAnalysisKind("all")}>전체 <em>{aiAnalysisResults.length}</em></button><button className={analysisKind==="personal"?"active":""} onClick={()=>setAnalysisKind("personal")}>개인 보관</button><button className={analysisKind==="project"?"active":""} onClick={()=>setAnalysisKind("project")}>프로젝트 자료</button></div><label><Search size={16}/><input value={analysisSearch} onChange={event=>setAnalysisSearch(event.target.value)} placeholder="제목, 내용, 프로젝트, 원본 자료 검색"/></label></div>
            <div className="ai-results-head"><span>분석 자료</span><span>보관 구분·프로젝트</span><span>생성 정보</span><span/></div>
            <div className="ai-results-list">{filteredAnalysisResults.map(item=><article key={item.id} className="clickable" onClick={()=>openAnalysisPreview(item)}>
              <div className="ai-result-main"><i><Sparkles size={17}/></i><span><strong>{item.title}</strong><p>{item.summary}</p><small>{item.id} · AI 생성 참조자료</small></span></div>
              <div className="ai-result-location"><b>{item.location==="personal"?"개인 보관":"프로젝트 자료"}</b><small>{item.project}</small></div>
              <div className="ai-result-meta"><b>{item.author}</b><small>{item.createdAt}</small></div>
              <button className="ai-result-delete" onClick={event=>{event.stopPropagation();removeAnalysisResult(item.id)}} aria-label={`${item.title} 삭제`}><Trash2 size={16}/></button>
            </article>)}{!filteredAnalysisResults.length&&<div className="ai-results-empty"><Sparkles size={30}/><strong>조건에 맞는 AI 분석 자료가 없습니다.</strong><p>검색어나 상세 필터 조건을 조정해 보세요.</p></div>}</div>
          </section>}
          {aiFilterOpen&&<div className="filter-overlay" onMouseDown={()=>setAiFilterOpen(false)}><aside className="filter-drawer ai-filter-drawer" onMouseDown={event=>event.stopPropagation()}>
            <header><div><span>AI 분석 자료</span><h2>상세 필터</h2><p>여러 조건을 조합해 필요한 분석 자료를 확인하세요.</p></div><button onClick={()=>setAiFilterOpen(false)} aria-label="필터 닫기"><X size={20}/></button></header>
            <div className="filter-scroll"><div className="logic-switch"><button className={draftAiFilters.logic==="AND"?"active":""} onClick={()=>setDraftAiFilters(current=>({...current,logic:"AND"}))}><b>AND</b> 모든 조건 만족</button><button className={draftAiFilters.logic==="OR"?"active":""} onClick={()=>setDraftAiFilters(current=>({...current,logic:"OR"}))}><b>OR</b> 하나 이상 만족</button></div>
              <div className="ai-filter-section"><div><strong>보관 구분</strong><small>복수 선택</small></div><div className="filter-chips">{([["personal","개인 보관"],["project","프로젝트 자료"]] as const).map(([value,label])=><button key={value} className={draftAiFilters.locations.includes(value)?"active":""} onClick={()=>toggleAiDraft("locations",value)}>{label}</button>)}</div></div>
              <div className="ai-filter-section"><div><strong>프로젝트</strong><small>복수 선택</small></div><div className="filter-check-list">{Array.from(new Set(aiAnalysisResults.map(item=>item.project))).map(value=><label key={value}><input type="checkbox" checked={draftAiFilters.projects.includes(value)} onChange={()=>toggleAiDraft("projects",value)}/><span>{value}</span></label>)}</div></div>
              <div className="ai-filter-section"><div><strong>생성 경로</strong><small>복수 선택</small></div><div className="filter-chips">{Array.from(new Set(aiAnalysisResults.map(item=>item.source))).map(value=><button key={value} className={draftAiFilters.sources.includes(value)?"active":""} onClick={()=>toggleAiDraft("sources",value)}>{value}</button>)}</div></div>
              <div className="ai-filter-section"><div><strong>작성자</strong><small>이름 기준</small></div><div className="filter-check-list">{Array.from(new Set(aiAnalysisResults.map(item=>item.author))).map(value=><label key={value}><input type="checkbox" checked={draftAiFilters.authors.includes(value)} onChange={()=>toggleAiDraft("authors",value)}/><span>{value}</span></label>)}</div></div>
              <div className="current-filter-count"><ListFilter size={16}/><span>현재 조건 적용 시</span><b>{draftFilteredAnalysisCount}건</b></div>
            </div><footer><button onClick={()=>{setDraftAiFilters(emptyAiFilters);setAiFilters(emptyAiFilters)}}>초기화</button><button className="primary" onClick={()=>{setAiFilters(draftAiFilters);setAiFilterOpen(false)}}>필터 적용</button></footer>
          </aside></div>}
        </div> : view === "home" ? <div className="content">
          <section className="welcome">
            <div>
              <p className="eyebrow">
<Sparkles size={15}/> MY AI HOME</p>
              <h1>안녕하세요, Dean님.<br/>
<span>오늘도 중요한 일부터 함께 시작할게요.</span>
</h1>
            </div>
            <div className="date-chip">
<CalendarDays size={18}/>
<div>
<strong>2026년 8월 5일</strong>
<span>수요일 · 업무 7건</span>
</div>
</div>
          </section>

          <section className="briefing-card">
            <div className="briefing-head">
              <div className="ai-orb">
<Bot size={24}/>
</div>
              <div>
<p>오늘의 AI 브리핑</p>
<span>방금 전 업데이트 · 실제 업무 데이터 기준</span>
</div>
              <button>
<Sparkles size={15}/> 다시 분석</button>
            </div>
            <div className="briefing-body">
              <p>오늘은 <strong>마감 업무 2건</strong>과 <strong className="danger-text">지연 위험 프로젝트 1건</strong>을 먼저 확인하는 것이 좋아요.</p>
              <ul>
                <li>
<AlertTriangle size={17}/>
<span>
<b>A사 AI PMS 구축</b>의 ‘요구사항 확정’이 3일 지연되어 후속 개발 일정에 영향을 주고 있어요.</span>
<button>확인 <ArrowRight size={14}/>
</button>
</li>
                <li>
<Clock3 size={17}/>
<span>오늘 오후 2시까지 <b>PMS 구축안 최종 검토</b>가 필요해요.</span>
<button>열기 <ArrowRight size={14}/>
</button>
</li>
                <li>
<CircleDot size={17}/>
<span>Dean님의 결정을 기다리는 항목이 <b>2건</b> 있어요.</span>
<button>검토 <ArrowRight size={14}/>
</button>
</li>
              </ul>
            </div>
            <div className="briefing-foot">
<ShieldCheck size={15}/> 모든 요약은 접근 권한이 있는 원본 업무를 근거로 생성됩니다.</div>
          </section>

          <section className="metric-grid">
            <article>
<div className="metric-icon blue">
<CircleCheck/>
</div>
<div>
<span>오늘 내 업무</span>
<strong>7<small>건</small>
</strong>
<p>
<b>{completedCount}건</b> 완료 · 3건 남음</p>
</div>
</article>
            <article>
<div className="metric-icon red">
<AlertTriangle/>
</div>
<div>
<span>지연 · 위험</span>
<strong>3<small>건</small>
</strong>
<p>
<b>1건</b> 즉시 확인 필요</p>
</div>
</article>
            <article>
<div className="metric-icon amber">
<Clock3/>
</div>
<div>
<span>승인 · 결정 대기</span>
<strong>2<small>건</small>
</strong>
<p>가장 오래된 요청 <b>2일</b>
</p>
</div>
</article>
            <article>
<div className="metric-icon green">
<Target/>
</div>
<div>
<span>참여 프로젝트</span>
<strong>4<small>개</small>
</strong>
<p>정상 2 · 주의 1 · 관찰 1</p>
</div>
</article>
          </section>

          <div className="main-grid">
            <section className="panel task-panel">
              <div className="panel-head">
<div>
<h2>오늘의 우선 업무</h2>
<p>AI가 마감, 영향도, 의존관계를 기준으로 정렬했어요.</p>
</div>
<button onClick={() => moveTo("work")}>MY WORK <ArrowRight size={15}/>
</button>
</div>
              <div className="task-list">
                {tasks.map((task) => {
                  const done = completed.includes(task.id);
                  return <article key={task.id} className={done ? "task-done" : ""} onClick={() => openItem({ kind: "업무", title: task.title, subtitle: `${task.project} · 마감 ${task.due}` })}>
                    <button className="task-check" onClick={(e) => { e.stopPropagation(); setCompleted(v => done ? v.filter(id => id !== task.id) : [...v, task.id]); }} aria-label={`${task.title} 완료 처리`}>{done && <Check size={15}/>}</button>
                    <div className="task-copy">
<h3>{task.title}</h3>
<p>{task.project}<span/>마감 {task.due}</p>
</div>
                    <span className={`status ${task.tone}`}>{task.status}</span>
                    <button className="row-arrow" aria-label="업무 열기">
<ChevronRight size={19}/>
</button>
                  </article>;
                })}
              </div>
              <button className="add-task">
<Plus size={17}/> 새 업무 추가</button>
            </section>

            <section className="panel project-panel">
              <div className="panel-head">
<div>
<h2>프로젝트 상태</h2>
<p>내가 참여 중인 주요 프로젝트</p>
</div>
<button onClick={() => moveTo("project")}>전체 보기 <ArrowRight size={15}/>
</button>
</div>
              <div className="project-list">
                {projects.map(project => <article key={project.name} onClick={() => openItem({ kind: "프로젝트", title: project.name, subtitle: `${project.issue} · 진행률 ${project.progress}%` })}>
                  <div className="project-title">
<div>
<span className="project-dot" style={{background: project.color}}/>
<strong>{project.name}</strong>
</div>
<em className={project.state === "정상" ? "ok" : project.state === "주의" ? "warn" : "watch"}>{project.state}</em>
</div>
                  <div className="progress-meta">
<span>{project.issue}</span>
<b>{project.progress}%</b>
</div>
                  <div className="progress">
<i style={{width: `${project.progress}%`, background: project.color}}/>
</div>
                </article>)}
              </div>
              <button className="risk-button" onClick={() => moveTo("project")}>
<AlertTriangle size={16}/> 프로젝트 위험 분석 보기 <ArrowRight size={15}/>
</button>
            </section>
          </div>

          <section className="conversation-card">
            <div className="panel-head conversation-head">
<div>
<h2>MY AI 대화</h2>
<p>어느 화면에서 시작했든, 업무 문맥과 함께 이곳에 자동으로 모입니다.</p>
</div>
<button onClick={() => void openConversationWorkspace()}>전체 대화 <ArrowRight size={15}/>
</button>
</div>
            <div className="conversation-list">
              {conversations.slice(0, 6).map(chat => <button key={chat.id} onClick={() => void openConversationWorkspace(chat)}>
                <span className="conversation-icon">
<MessageSquareText size={18}/>
</span>
                <span className="conversation-copy">
<strong>{chat.title}</strong>
<small>
<b>{chat.source}</b>
<i/> {chat.context}</small>
</span>
                <time>{chat.time}</time>
<ChevronRight size={18}/>
              </button>)}
            </div>
          </section>

          <section className="ask-card">
            <div className="ask-title">
<div className="ai-orb small">
<Sparkles size={19}/>
</div>
<div>
<h2>AI에게 업무를 물어보세요</h2>
<p>프로젝트, 일정, 업무, 문서를 실제 PMS 데이터에서 찾아 답해드려요.</p>
</div>
</div>
            <div className="suggestions">{suggestions.map(s => <button key={s} onClick={() => askAI(s)}>{s}<ArrowRight size={14}/>
</button>)}</div>
            <div className="ask-input">
<Sparkles size={19}/>
<input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} placeholder="예: 오늘 가장 먼저 처리해야 할 업무와 그 이유를 알려줘"/>
<button onClick={() => askAI()} aria-label="AI에게 질문 보내기">
<Send size={18}/>
</button>
</div>
            {answer && <div className="answer-box">
              <div className="answer-label">
<Bot size={17}/> AI 답변 <span>3개 근거 사용</span>
</div>
              <p>가장 먼저 <strong>‘A사 PMS 구축안 최종 검토’</strong>를 처리하는 것이 좋아요. 오늘 14시 마감이며, 현재 지연 중인 요구사항 확정과 연결되어 있어 완료가 늦어지면 WBS 개발 일정이 추가로 밀릴 수 있습니다.</p>
              <div className="answer-actions">
<button onClick={() => setEvidence(!evidence)}>
<FileText size={15}/> 근거 {evidence ? "닫기" : "확인"}</button>
<button>
<Check size={15}/> 업무 열기</button>
</div>
              {evidence && <div className="evidence">
<span>근거 1</span>
<b>A사 AI PMS 구축 / TASK-1042</b>
<p>마감: 2026.08.05 14:00 · 선행업무 3일 지연</p>
</div>}
            </div>}
          </section>
        </div> : view === "work" ? <div className="content work-content">
          <section className="work-heading">
            <div>
<p className="eyebrow">
<CircleCheck size={15}/> MY WORK</p>
<h1>나의 모든 업무</h1>
<p>담당 업무를 찾고, 우선순위를 확인하고, 실제 처리를 완료하세요.</p>
</div>
            <button className="new-work">
<Plus size={17}/> 새 업무</button>
          </section>

          <section className="work-summary">
            <article>
<span>전체 업무</span>
<strong>7</strong>
<small>예정 업무 포함</small>
</article>
            <article>
<span>오늘 마감</span>
<strong>2</strong>
<small className="danger-text">긴급 1건</small>
</article>
            <article>
<span>진행 중</span>
<strong>{Math.max(0, 3 - completed.length)}</strong>
<small>내가 처리할 업무</small>
</article>
            <article>
<span>완료</span>
<strong>{completedCount}</strong>
<small className="done-text">오늘 +{completed.length}건</small>
</article>
          </section>

          <section className="work-board panel">
            <div className="work-tools">
              <div className="work-tabs" role="tablist" aria-label="업무 상태 필터">
                {(["전체", "오늘", "진행 중", "완료"] as const).map(filter => <button key={filter} className={workFilter === filter ? "active" : ""} onClick={() => setWorkFilter(filter)}>{filter}{filter === "전체" && <em>7</em>}</button>)}
              </div>
              <label className="work-search">
<Search size={17}/>
<input value={workSearch} onChange={e => setWorkSearch(e.target.value)} placeholder="업무 또는 프로젝트 검색"/>
</label>
              <button className="filter-button">
<ListFilter size={17}/> 필터</button>
            </div>
            <div className="work-table-head">
<span>업무</span>
<span>상태</span>
<span>마감</span>
<span>담당자</span>
<span/>
</div>
            <div className="work-rows">
              {visibleTasks.map(task => {
                const done = completed.includes(task.id);
                return <article key={task.id} className={done ? "is-complete" : ""} onClick={() => openItem({kind:"업무", title:task.title, subtitle:`${task.project} · 마감 ${task.due}`})}>
                  <div className="work-name">
<button className="task-check" onClick={e => { e.stopPropagation(); setCompleted(v => done ? v.filter(id => id !== task.id) : [...v, task.id]); }}>{done && <Check size={15}/>}</button>
<div>
<strong>{task.title}</strong>
<small>{task.project} · TASK-{1041 + task.id}</small>
</div>
</div>
                  <span>
<i className={`work-state ${done ? "done" : task.tone}`}>{done ? "완료" : "진행 중"}</i>
</span>
                  <time className={task.tone === "red" && !done ? "urgent" : ""}>{done ? "완료됨" : task.due}</time>
                  <span className="assignee">
<b>DK</b> Dean Kim</span>
                  <ChevronRight size={19}/>
                </article>;
              })}
              {visibleTasks.length === 0 && <div className="empty-work">
<CircleCheck size={30}/>
<strong>조건에 맞는 업무가 없습니다.</strong>
<p>다른 상태나 검색어를 선택해 보세요.</p>
</div>}
            </div>
          </section>

          <section className="work-ai-tip">
<Sparkles size={20}/>
<div>
<strong>AI가 다음 업무를 추천했어요.</strong>
<p>‘A사 PMS 구축안 최종 검토’를 먼저 완료하면 후속 개발 일정의 추가 지연을 막을 수 있습니다.</p>
</div>
<button onClick={() => openItem({kind:"업무", title:tasks[0].title, subtitle:`${tasks[0].project} · 마감 ${tasks[0].due}`}, "ai")}>AI와 검토 <ArrowRight size={15}/>
</button>
</section>
        </div> : view === "project" ? <ProjectListWorkspace onCreate={()=>moveTo("admin","project")} onOpenWbs={project=>{setSelectedProject(project);setWbsSection("actual");setWbsMode("list");setWbsWorkMode("operate");moveTo("wbs")}} onOpenDashboard={project=>{setSelectedProject(project);moveTo("project-dashboard")}}/>
        : view === "project-dashboard" ? <div className="content project-home-content">
          <section className="project-home-heading">
            <div>
<p className="eyebrow">
<LayoutDashboard size={15}/> 프로젝트 AI HOME</p>
<h1>{selectedProject?.name||"프로젝트를 선택해 주세요"}</h1>
<p>프로젝트 전체 흐름을 판단하고, 지금 필요한 조치를 바로 확인하세요.</p>
</div>
            <button className="project-select">{selectedProject?.name||"프로젝트 선택"} <ChevronDown size={16}/>
</button>
          </section>

          <section className="project-ai-brief">
            <div className="project-ai-icon">
<Sparkles size={22}/>
</div>
            <div className="project-ai-copy">
<span>AI 프로젝트 브리핑</span>
<h2>전체 진척은 68%지만, 핵심 요구사항 확정 지연으로 개발 일정이 위험해졌어요.</h2>
<p>오늘 14시까지 구축안을 확정하면 후속 개발의 추가 지연을 최소화할 수 있습니다.</p>
</div>
            <button onClick={() => openItem({kind:"프로젝트", title:"A사 AI PMS 구축", subtitle:"진행률 68% · 핵심 Task 3일 지연"}, "ai")}>AI와 분석 <ArrowRight size={15}/>
</button>
          </section>

          <section className="project-kpis">
            <article>
<span>전체 진척률</span>
<strong>68<small>%</small>
</strong>
<p>
<TrendingUp size={14}/> 계획 대비 -6%</p>
</article>
            <article>
<span>마일스톤</span>
<strong>5<small>/ 8</small>
</strong>
<p className="good">
<CircleCheck size={14}/> 5단계 완료</p>
</article>
            <article>
<span>지연 업무</span>
<strong className="danger-text">3<small>건</small>
</strong>
<p className="danger-text">
<AlertTriangle size={14}/> 핵심 경로 1건</p>
</article>
            <article>
<span>의사결정 대기</span>
<strong>2<small>건</small>
</strong>
<p>
<Clock3 size={14}/> 최장 2일 대기</p>
</article>
          </section>

          <div className="project-home-grid">
            <section className="panel milestone-panel">
              <div className="panel-head">
<div>
<h2>마일스톤 진행</h2>
<p>계획 일정과 현재 상태를 비교합니다.</p>
</div>
<button onClick={() => moveTo("wbs")}>전체 WBS <ArrowRight size={15}/>
</button>
</div>
              <div className="milestone-list">
                <article className="complete">
<i>
<Check size={14}/>
</i>
<div>
<strong>요구사항 분석</strong>
<span>7월 12일 완료</span>
</div>
<em>완료</em>
</article>
                <article className="complete">
<i>
<Check size={14}/>
</i>
<div>
<strong>프로세스 설계</strong>
<span>7월 26일 완료</span>
</div>
<em>완료</em>
</article>
                <article className="risk" onClick={() => openItem({kind:"업무", title:"요구사항 최종 확정", subtitle:"A사 AI PMS 구축 · 3일 지연"})}>
<i>
<AlertTriangle size={14}/>
</i>
<div>
<strong>요구사항 최종 확정</strong>
<span>8월 2일 예정 · 현재 3일 지연</span>
</div>
<em>지연</em>
</article>
                <article>
<i>4</i>
<div>
<strong>1차 개발</strong>
<span>8월 19일 예정 · 선행업무 영향</span>
</div>
<em>예정</em>
</article>
              </div>
            </section>

            <section className="panel health-panel">
              <div className="panel-head">
<div>
<h2>프로젝트 건강도</h2>
<p>일정·범위·품질·협업 분석</p>
</div>
<span className="health-score">72점</span>
</div>
              <div className="health-bars">
                {[['일정',58,'risk'],['범위',82,'good'],['품질',76,'good'],['협업',71,'normal']].map(([name,score,tone]) => <div key={String(name)}>
<span>{name}</span>
<i>
<b className={String(tone)} style={{width:`${score}%`}}/>
</i>
<strong>{score}</strong>
</div>)}
              </div>
              <button className="health-action" onClick={() => openItem({kind:"프로젝트", title:"A사 AI PMS 구축 건강도", subtitle:"일정 58점 · 전체 건강도 72점"}, "ai")}>
<Sparkles size={16}/> 건강도 개선안 받기 <ArrowRight size={15}/>
</button>
            </section>
          </div>

          <div className="project-home-grid lower">
            <section className="panel issue-panel">
              <div className="panel-head">
<div>
<h2>주요 이슈와 의사결정</h2>
<p>프로젝트 진행에 직접 영향을 주는 항목</p>
</div>
<button onClick={() => moveTo("issues")}>전체 보기 <ArrowRight size={15}/>
</button>
</div>
              <div className="project-issues">
                <button onClick={() => openItem({kind:"업무", title:"요구사항 범위 최종 승인", subtitle:"의사결정 · 2일 대기"})}>
<span className="issue-icon red">
<AlertTriangle size={16}/>
</span>
<span>
<strong>요구사항 범위 최종 승인</strong>
<small>의사결정 · 2일 대기</small>
</span>
<em>긴급</em>
<ChevronRight size={18}/>
</button>
                <button onClick={() => openItem({kind:"업무", title:"외부 연계 API 방식 확정", subtitle:"기술 검토 · 오늘 마감"})}>
<span className="issue-icon amber">
<CircleDot size={16}/>
</span>
<span>
<strong>외부 연계 API 방식 확정</strong>
<small>기술 검토 · 오늘 마감</small>
</span>
<em>검토</em>
<ChevronRight size={18}/>
</button>
                <button onClick={() => openItem({kind:"업무", title:"개발 인력 1명 추가 요청", subtitle:"리소스 · 승인 대기"})}>
<span className="issue-icon blue">
<Users size={16}/>
</span>
<span>
<strong>개발 인력 1명 추가 요청</strong>
<small>리소스 · 승인 대기</small>
</span>
<em>승인</em>
<ChevronRight size={18}/>
</button>
              </div>
            </section>

            <section className="panel next-action-panel">
              <div className="panel-head">
<div>
<h2>AI 권고 조치</h2>
<p>지금 실행하면 효과가 큰 순서</p>
</div>
<Sparkles size={18}/>
</div>
              <ol>
                <li>
<b>1</b>
<div>
<strong>PMS 구축안 최종 검토</strong>
<span>오늘 14:00까지 확정</span>
</div>
<button onClick={() => openItem({kind:"업무", title:"A사 PMS 구축안 최종 검토", subtitle:"A사 AI PMS 구축 · 오늘 14:00"})}>열기</button>
</li>
                <li>
<b>2</b>
<div>
<strong>개발 일정 회복안 검토</strong>
<span>지연 3일 중 2일 회복 가능</span>
</div>
<button onClick={() => openItem({kind:"프로젝트", title:"개발 일정 회복안", subtitle:"A사 AI PMS 구축 · AI 분석"}, "ai")}>분석</button>
</li>
                <li>
<b>3</b>
<div>
<strong>고객 의사결정 요청</strong>
<span>대기 중인 2건 일괄 정리</span>
</div>
<button>작성</button>
</li>
              </ol>
            </section>
          </div>
        </div> : view === "wbs" ? (wbsSection==="edit" ? <ProjectWbsEditor project={selectedProject} onClose={()=>setWbsSection("actual")}/> : <div className="content wbs-content">
          <section className="wbs-heading">
            <div>
<p className="eyebrow">
<GanttChartSquare size={15}/> 일정 · WBS</p>
<h1>{selectedProject?`${selectedProject.name} WBS`:"프로젝트를 선택해 주세요"}</h1>
<p>계획과 실적을 비교하고, 지연 경로에서 바로 조치하세요.</p>
</div>
            <div className="wbs-heading-actions"><span className="permission-chip">PM · PL 편집 권한</span></div>
          </section>

          <section className="wbs-project-context"><span><Target size={15}/></span><strong>{selectedProject?.name||"선택된 프로젝트 없음"}</strong><em>{selectedProject?.status==="active"?"진행 중":"준비 중"}</em><small>{selectedProject?.code||"프로젝트 목록에서 WBS를 열어 주세요"} · PM Dean Kim</small></section>

          <section className="wbs-alert">
            <span className="issue-icon red">
<AlertTriangle size={17}/>
</span>
            <div>
<strong>AI가 핵심 지연 경로 1건을 발견했어요.</strong>
<p>‘요구사항 최종 확정’이 3일 지연되어 설계와 1차 개발 일정에 연쇄 영향을 주고 있습니다.</p>
</div>
            <button onClick={() => openItem({kind:"업무", title:"요구사항 최종 확정", subtitle:"WBS-102 · 3일 지연"}, "ai")}>회복안 분석 <Sparkles size={15}/>
</button>
          </section>

          <section className="wbs-summary">
            <article>
<span>전체 진척률</span>
<strong>68%</strong>
<small>계획 대비 -6%</small>
</article>
            <article>
<span>전체 Task</span>
<strong>24</strong>
<small>완료 15 · 진행 6</small>
</article>
            <article>
<span>지연 Task</span>
<strong className="danger-text">3</strong>
<small className="danger-text">핵심 경로 1건</small>
</article>
            <article>
<span>이번 주 마감</span>
<strong>5</strong>
<small>오늘 마감 2건</small>
</article>
          </section>

          <section className="panel wbs-board">
            <div className="wbs-toolbar">
<div className="wbs-view-actions">
<button className={wbsMode === "list" && wbsWorkMode === "operate" ? "active" : ""} onClick={() => {setWbsSection("actual");setWbsMode("list");setWbsWorkMode("operate");}}>
<Play size={16}/> WBS 실적입력</button>
<button className={wbsMode === "gantt" ? "active" : ""} onClick={() => {setWbsSection("gantt");setWbsMode("gantt");setWbsWorkMode("operate");}}>
<CalendarDays size={16}/> 간트 차트</button>
</div>
<div className="wbs-toolbar-right"><span>2026. 07. 01 ~ 2026. 09. 18</span><button className="wbs-edit-button" onClick={()=>setWbsSection("edit")}><Pencil size={15}/> WBS 편집</button><div className="wbs-filter-wrap"><button className={`filter-button ${activeWbsFilterCount?"has-filter":""}`} onClick={()=>setWbsFilterOpen(current=>!current)} aria-expanded={wbsFilterOpen}><ListFilter size={16}/> 필터 {activeWbsFilterCount>0&&<b>{activeWbsFilterCount}</b>}<ChevronDown size={14}/></button>{wbsFilterOpen&&<div className="wbs-filter-menu">{(["전체 업무","진행 중","내 업무","미시작 Task","지연 Task","이슈 Task","완료","보류"] as WbsTaskFilter[]).map(filter=><button key={filter} className={wbsTaskFilter===filter?"active":""} onClick={()=>applyWbsQuickFilter(filter)}><span>{filter}</span><b>{wbsFilterCounts[filter]}</b></button>)}<footer><button onClick={()=>{setDraftWbsFilters({...wbsFilters,statuses:[...wbsFilters.statuses],attention:[...wbsFilters.attention],owners:[...wbsFilters.owners],levels:[...wbsFilters.levels]});setWbsOwnerSearch("");setWbsFilterOpen(false);setWbsAdvancedOpen(true);}}>상세 필터</button><button onClick={()=>applyWbsQuickFilter("진행 중")}>초기화</button></footer></div>}</div></div>
            </div>
            {activeWbsFilterCount>0&&<div className="project-applied-filters wbs-applied-filters"><span>{wbsFilters.logic}</span>{wbsFilters.statuses.map(value=><em key={value}>상태 · {value}</em>)}{wbsFilters.attention.map(value=><em key={value}>{value}</em>)}{wbsFilters.owners.map(value=><em key={value}>담당 · {value}</em>)}{wbsFilters.levels.map(value=><em key={value}>{value}</em>)}<button onClick={()=>applyWbsQuickFilter("진행 중")}>기본값 복원 <X size={12}/></button></div>}
            <div className={`wbs-mode-notice ${wbsWorkMode}`}><strong>{wbsWorkMode === "edit" ? "편집 모드 · PM/PL" : "실적 입력 모드 · 프로젝트 참여자"}</strong><span>{wbsWorkMode === "edit" ? "템플릿에서 가져온 WBS를 프로젝트 상황에 맞게 추가·이동·삭제하고 담당자와 계획 일정을 조정합니다." : "자신에게 배정된 실행 Task의 진척률, 수행 내용과 산출물을 입력합니다. 그룹 WBS는 자동 집계됩니다."}</span>{wbsWorkMode === "edit" && <div><button><Plus size={14}/> Task 추가</button><button><IndentIncrease size={14}/> 하위 Task</button><button><Check size={14}/> 변경사항 저장</button></div>}</div>
            {wbsMode === "list" ? <>
<div className="wbs-table-head">
<span/>
<span>WBS / 업무</span>
<span>산출물</span>
<span>이슈</span>
<span>담당자</span>
<span>마감</span>
<span>진척률</span>
<span>상태</span>
<span/>
</div>
            <div className="wbs-rows">
              {visibleWbsItems.map((item) => <article key={item.id} className={`wbs-level-${item.level} ${selected?.wbsId === item.id ? "selected" : ""}`} onClick={() => openItem({kind:"WBS", title:item.title, subtitle:`WBS ${item.id} · ${item.state}`, wbsId:item.id})}>
                <button className={`doc-check ${selectedWbs.includes(item.id) ? "checked" : ""}`} onClick={(event) => { event.stopPropagation(); setSelectedWbs(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current,item.id]); }} aria-label={`${item.title} 선택`}>{selectedWbs.includes(item.id) && <Check size={13}/>}</button>
                <div className="wbs-name" style={{"--wbs-level": item.level} as CSSProperties}>
                  {item.children ? <button className="wbs-toggle" onClick={(event) => { event.stopPropagation(); toggleWbs(item.id); }} aria-label={`${item.title} ${expandedWbs.includes(item.id) ? "접기" : "펼치기"}`}>{expandedWbs.includes(item.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</button> : <span className="wbs-indent"/>}
                  <i>{item.id}</i>
<div>
<strong>{item.title}</strong>
<small className="wbs-mobile-links">산출물 {item.outputs} · 이슈 {item.issues}</small>
</div>
                </div>
                <button className={`wbs-link-count output ${item.outputs === 0 ? "empty" : ""}`} onClick={(event) => { event.stopPropagation(); openItem({kind:"WBS", title:item.title, subtitle:`WBS ${item.id} · 산출물 ${item.outputs}건`, wbsId:item.id}, "deliverables"); }} aria-label={`${item.title} 연결 산출물 ${item.outputs}건 보기`}>
<FileText size={13}/>
<b>{item.outputs}</b>
</button>
                <button className={`wbs-link-count issue ${item.issues === 0 ? "empty" : ""}`} onClick={(event) => { event.stopPropagation(); openItem({kind:"WBS", title:item.title, subtitle:`WBS ${item.id} · 이슈 ${item.issues}건`, wbsId:item.id}, "issues"); }} aria-label={`${item.title} 연결 이슈 ${item.issues}건 보기`}>
<AlertTriangle size={13}/>
<b>{item.issues}</b>
</button>
                <span className="wbs-owner">
<b>{item.owner === "Dean Kim" ? "DK" : item.owner.slice(0,1)}</b>{item.owner}</span>
                <time>{item.due}</time>
                <div className="wbs-progress">
<div>
<i style={{width:`${taskProgress[item.id] ?? item.progress}%`}}/>
</div>
<b>{taskProgress[item.id] ?? item.progress}%</b>
</div>
                <em className={`wbs-state ${item.tone}`}>{startedTasks.includes(item.id) ? "진행 중" : item.state}</em>
<button className="wbs-row-action" disabled={wbsWorkMode === "operate" && item.owner !== "Dean Kim"} onClick={(event) => { event.stopPropagation(); setWbsDialog({mode:wbsWorkMode === "edit" ? "edit" : "task",id:item.id}); }} aria-label={`${item.title} ${wbsWorkMode === "edit" ? "편집" : "실적 입력"}`}>{wbsWorkMode === "edit" ? <Pencil size={14}/> : <Play size={15}/>}</button>
              </article>)}
            </div>
            {wbsMode==="list"&&!visibleWbsItems.length&&<div className="empty-work"><ListFilter size={28}/><strong>조건에 맞는 Task가 없습니다.</strong><p>필터 조건을 변경해 보세요.</p></div>}
</> : <div className="gantt-wrap">
              <div className="gantt-head">
<span>WBS / 업무</span>{["7/01","7/08","7/15","7/22","7/29","8/05","8/12","8/19","8/26","9/02","9/09","9/16"].map(day => <b key={day}>{day}</b>)}</div>
              <div className="gantt-today">
<span>오늘</span>
</div>
              {wbsItems.filter(item => item.level < 3 || item.id === "1.2.2").map((item,index) => {
                const starts=[0,0,2,4,5,7,8,9]; const lengths=[4,2,3,3,3,4,4,3];
                const actualProgress = taskProgress[item.id] ?? item.progress;
                return <div className="gantt-row" key={item.id}>
                  <button onClick={() => setWbsDialog({mode:"edit",id:item.id})} aria-label={`${item.title} WBS 편집`}>
<i>{item.id}</i>
<span>{item.title}</span>
</button>
                  <div className="gantt-track">
                    <span className={`gantt-plan ${item.id === "1.2.2" ? "critical" : ""}`} style={{left:`${starts[index]*8.333}%`,width:`${lengths[index]*8.333}%`}}>
                      <button className={`gantt-actual ${item.tone}`} style={{width:`${Math.max(actualProgress,8)}%`}} onClick={() => setWbsDialog({mode:"task",id:item.id})} aria-label={`${item.title} 실적 ${actualProgress}% 업데이트`} title="실적 업데이트">
<b>{actualProgress}%</b>
</button>
                    </span>
                    {item.id === "1.2.2" && <em>+3일</em>}
                  </div>
                </div>
              })}
              <div className="gantt-legend">
<span>
<i className="plan"/>계약·계획 기간</span>
<span>
<i className="active"/>실적 진행</span>
<span>
<i className="risk"/>지연·핵심 경로</span>
<small>업무명은 WBS 편집, 실적 막대는 진척률 업데이트로 연결됩니다.</small>
</div>
            </div>}
          </section>
          {wbsAdvancedOpen&&<div className="filter-overlay" onClick={()=>setWbsAdvancedOpen(false)}><aside className="advanced-filter" onClick={event=>event.stopPropagation()}>
            <header className="filter-head compact-filter-head"><div><span>WBS TASK FILTER</span><strong>일정·WBS 상세 필터</strong><p>Task가 많아져도 필요한 업무만 조합해 찾을 수 있습니다.</p></div><div className="compact-filter-actions"><div className="compact-filter-logic" aria-label="조건 결합 방식"><small>조건 결합</small><button title="모든 조건 만족" className={draftWbsFilters.logic==="AND"?"active":""} onClick={()=>setDraftWbsFilters(current=>({...current,logic:"AND"}))}>AND</button><button title="하나 이상 만족" className={draftWbsFilters.logic==="OR"?"active":""} onClick={()=>setDraftWbsFilters(current=>({...current,logic:"OR"}))}>OR</button></div><button className="compact-filter-close" onClick={()=>setWbsAdvancedOpen(false)} aria-label="필터 닫기"><X size={20}/></button></div></header>
            <section className="filter-section"><div className="filter-section-title"><strong>진행 상태</strong><span>복수 선택</span></div><div className="filter-chip-grid">{["미시작","진행 중","완료","보류"].map(value=><button key={value} className={draftWbsFilters.statuses.includes(value)?"active":""} onClick={()=>toggleWbsDraft("statuses",value)}>{value}{draftWbsFilters.statuses.includes(value)&&<Check size={13}/>}</button>)}</div></section>
            <section className="filter-section"><div className="filter-section-title"><strong>업무 현황</strong><span>복수 선택</span></div><div className="filter-chip-grid">{["지연","이슈 있음","산출물 미등록","실적 미입력"].map(value=><button key={value} className={draftWbsFilters.attention.includes(value)?"active":""} onClick={()=>toggleWbsDraft("attention",value)}>{value}{draftWbsFilters.attention.includes(value)&&<Check size={13}/>}</button>)}</div></section>
            <section className="filter-section"><div className="filter-section-title"><strong>담당자</strong><span>검색 후 복수 선택</span></div><label className="filter-search"><Search size={15}/><input value={wbsOwnerSearch} onChange={event=>setWbsOwnerSearch(event.target.value)} placeholder="담당자 검색"/></label>{draftWbsFilters.owners.length>0&&<div className="selected-filter-chips">{draftWbsFilters.owners.map(value=><button key={value} onClick={()=>toggleWbsDraft("owners",value)}>{value}<X size={12}/></button>)}</div>}<div className="filter-option-list">{["Dean Kim","박지연","이도현","김서준","개발팀","AI팀"].filter(value=>!wbsOwnerSearch||value.toLowerCase().includes(wbsOwnerSearch.toLowerCase())).map(value=><button key={value} className={draftWbsFilters.owners.includes(value)?"active":""} onClick={()=>toggleWbsDraft("owners",value)}><span>{value}</span>{draftWbsFilters.owners.includes(value)&&<Check size={14}/>}</button>)}</div></section>
            <section className="filter-section"><div className="filter-section-title"><strong>WBS 레벨</strong><span>복수 선택</span></div><div className="filter-chip-grid">{["Level 1","Level 2","Level 3"].map(value=><button key={value} className={draftWbsFilters.levels.includes(value)?"active":""} onClick={()=>toggleWbsDraft("levels",value)}>{value}{draftWbsFilters.levels.includes(value)&&<Check size={13}/>}</button>)}</div></section>
            <div className="filter-preview"><ListFilter size={15}/><span>현재 조건 적용 시</span><strong>{wbsItems.filter(item=>!item.children).filter(item=>{const progress=taskProgress[item.id]??item.progress;const statusValues=[progress===0||item.tone==="planned"?"미시작":progress===100?"완료":item.state==="보류"?"보류":"진행 중"];const attentionValues=[item.tone==="risk"?"지연":"",item.issues>0?"이슈 있음":"",item.outputs===0?"산출물 미등록":""];const checks=[!draftWbsFilters.statuses.length||draftWbsFilters.statuses.some(v=>statusValues.includes(v)),!draftWbsFilters.attention.length||draftWbsFilters.attention.some(v=>attentionValues.includes(v)),!draftWbsFilters.owners.length||draftWbsFilters.owners.includes(item.owner),!draftWbsFilters.levels.length||draftWbsFilters.levels.includes(`Level ${item.level}`)];const active=[draftWbsFilters.statuses.length>0,draftWbsFilters.attention.length>0,draftWbsFilters.owners.length>0,draftWbsFilters.levels.length>0];const relevant=checks.filter((_,i)=>active[i]);return !relevant.length||(draftWbsFilters.logic==="AND"?relevant.every(Boolean):relevant.some(Boolean))}).length}건</strong></div>
            <footer className="filter-actions"><button onClick={()=>setDraftWbsFilters({logic:"AND",statuses:[],attention:[],owners:[],levels:[]})}>초기화</button><button className="apply" onClick={()=>{setWbsFilters(draftWbsFilters);setWbsTaskFilter("전체 업무");setWbsAdvancedOpen(false)}}>필터 적용</button></footer>
          </aside></div>}

          {selectedWbs.length ? <section className="issue-ai-selection-bar wbs-selection-bar">
<div className="selection-count">
<Check size={16}/>
<strong>{selectedWbs.length}건 선택됨</strong>
<span>연결 이슈 {selectedWbsIssues}건 · 산출물 {selectedWbsOutputs}건 · 선후행 업무 포함 분석</span>
</div>
<div className="selection-actions">
<button onClick={() => setSelectedWbs([])}>선택 해제</button>
<span className="selection-ai-hint"><Sparkles size={15}/> 우측 AI 아이콘으로 분석</span>
</div>
</section> : <section className="wbs-bottom-tip">
<Sparkles size={19}/>
<div>
<strong>선택 WBS AI 분석</strong>
<p>필요한 업무를 여러 건 선택하면 선후행 관계와 연결 이슈·산출물을 바탕으로 지연 원인, 병목과 일정 회복안을 분석할 수 있어요.</p>
</div>
<button disabled>WBS를 선택하세요 <ArrowRight size={15}/>
</button>
</section>}
          {wbsDialog && dialogWbs && <div className="wbs-dialog-backdrop" onClick={() => setWbsDialog(null)}>
<section className="wbs-dialog" onClick={event => event.stopPropagation()}>
            <header>
<div>
<span>{wbsDialog.mode === "edit" ? "PM WBS 편집" : "담당자 Task · 실적 업데이트"}</span>
<h2>{dialogWbs.id} · {dialogWbs.title}</h2>
</div>
<button onClick={() => setWbsDialog(null)} aria-label="닫기">
<X size={19}/>
</button>
</header>
            {wbsDialog.mode === "edit" ? <div className="wbs-edit-form">
              <label className="wide">
<span>업무명</span>
<input defaultValue={dialogWbs.title}/>
</label>
              <label>
<span>담당자</span>
<button className="field-select">{dialogWbs.owner}<ChevronDown size={15}/>
</button>
</label>
              <label>
<span>상태</span>
<button className="field-select">{dialogWbs.state}<ChevronDown size={15}/>
</button>
</label>
              <label>
<span>계획 시작일</span>
<input type="date" defaultValue="2026-07-29"/>
</label>
<label>
<span>계획 종료일</span>
<input type="date" defaultValue="2026-08-09"/>
</label>
              <label>
<span>선행 WBS</span>
<button className="field-select">1.2.1 요구사항 취합<ChevronDown size={15}/>
</button>
</label>
<label>
<span>가중치</span>
<input defaultValue="10%"/>
</label>
              <label className="wide">
<span>업무 설명 · 완료 기준</span>
<textarea defaultValue="고객 검토 의견을 반영하고 최종 승인된 요구사항 기준선을 확정합니다."/>
</label>
              <div className="wbs-link-editor">
<span>연결 정보</span>
<button>
<FileText size={15}/> 산출물 {dialogWbs.outputs}건</button>
<button>
<AlertTriangle size={15}/> 이슈 {dialogWbs.issues}건</button>
<button>
<Plus size={15}/> 연결 추가</button>
</div>
            </div> : <div className="task-run-form">
              <div className="task-status-card">
<span className="avatar">DK</span>
<div>
<strong>Dean Kim</strong>
<p>마감 {dialogWbs.due} · {startedTasks.includes(dialogWbs.id) ? "작업 진행 중" : "시작 전"}</p>
</div>
<em>{startedTasks.includes(dialogWbs.id) ? "진행 중" : dialogWbs.state}</em>
</div>
              <div className="task-progress-update">
<div>
<span>현재 진척률</span>
<strong>{taskProgress[dialogWbs.id] ?? dialogWbs.progress}%</strong>
</div>
<input type="range" min="0" max="100" step="5" value={taskProgress[dialogWbs.id] ?? dialogWbs.progress} onChange={event => setTaskProgress(current => ({...current,[dialogWbs.id]:Number(event.target.value)}))}/>
<div className="progress-ticks">
<span>0%</span>
<span>25%</span>
<span>50%</span>
<span>75%</span>
<span>100%</span>
</div>
</div>
              <label>
<span>오늘 작업 내용</span>
<textarea placeholder="진행 내용, 의사결정 또는 차질 사항을 입력하세요." defaultValue="고객 검토 의견 반영 및 요구사항 추적표 정합성 확인"/>
</label>
              <div className="task-links">
<button onClick={()=>setDocumentRegistration({wbs:dialogWbs.id})}>
<FileText size={15}/> 산출물 등록</button>
<button>
<AlertTriangle size={15}/> 이슈 등록</button>
<button>
<MessageSquareText size={15}/> 협업 요청</button>
</div>
            </div>}
            <footer>
<button onClick={() => setWbsDialog(null)}>취소</button>{wbsDialog.mode === "task" && !startedTasks.includes(dialogWbs.id) ? <button className="primary" onClick={() => setStartedTasks(current => [...current,dialogWbs.id])}>
<Play size={15}/> Task 시작</button> : <button className="primary" onClick={() => setWbsDialog(null)}>
<Check size={15}/> {wbsDialog.mode === "edit" ? "변경사항 저장" : "진척률 업데이트"}</button>}</footer>
          </section>
</div>}
        </div>) : view === "admin" ? <AdminWorkspace tab={adminTab} projectStep={projectStep} setProjectStep={setProjectStep} createdProject={createdProject} setCreatedProject={setCreatedProject} onProjectCreated={setSelectedProject} onOpenProjects={()=>moveTo("project")} onOpenWbs={()=>moveTo("wbs-editor")} onOpenTemplateEditor={openTemplateEditorTab} onCloseTemplateEditor={()=>closeEditorTab("template-editor")} editorTabActive={activeWorkspaceKey==="template-editor"}/> : view === "documents" ? <ProjectDocumentWorkspace project={selectedProject} onProjectChange={project=>setSelectedProject(project as ProjectRecord)} onAiContextChange={setModuleDocumentContext} onPreview={openDocumentPreview} selectedIds={documentSelectedIds} onSelectedIdsChange={setDocumentSelectedIds}/> : false ? <div className="content document-content">
          <section className="document-heading">
            <div>
<p className="eyebrow">
<FileText size={15}/> 문서 · 산출물</p>
<h1>프로젝트 문서와 산출물</h1>
<p>제출 계획과 실제 문서, 검토·승인·배포 상태를 연결해 관리하세요.</p>
</div>
            <div className="document-actions">
<button className="project-select">A사 AI PMS 구축 <ChevronDown size={16}/>
</button>
<button className="new-work" onClick={()=>setDocumentRegistration({})}>
<Upload size={17}/> 문서 등록</button>
</div>
          </section>

          <section className="panel document-board">
            <div className="document-toolbar">
<div>{(["전체","검토 중","승인","작성 중"] as const).map(filter => <button key={filter} className={documentFilter === filter ? "active" : ""} onClick={() => setDocumentFilter(filter)}>{filter}{filter === "전체" && <em>24</em>}</button>)}</div>
<span>{selectedDocs.length ? `${selectedDocs.length}개 문서 선택됨` : "최신 버전만 표시"}</span>
<button className={`filter-button ${activeFilterCount(documentAdvanced) ? "has-filter" : ""}`} onClick={() => openFilters("documents")}>
<ListFilter size={16}/> 필터{activeFilterCount(documentAdvanced) > 0 && <b>{activeFilterCount(documentAdvanced)}</b>}</button>
</div>
            {activeFilterCount(documentAdvanced) > 0 && <div className="applied-filters">
<span>적용된 필터</span>{documentAdvanced.projects.map(value => <em key={value}>프로젝트 · {value}</em>)}{documentAdvanced.criteria.map(value => <em key={value}>{value}</em>)}{documentAdvanced.owners.map(value => <em key={value}>담당 · {value}</em>)}<button onClick={() => clearAdvancedFilters("documents")}>전체 초기화 <X size={13}/>
</button>
</div>}
            <div className="document-table-head">
<span/>
<span>문서 / 산출물</span>
<span>프로젝트 정보</span>
<span>연결 업무</span>
<span>담당자</span>
<span>최근 변경</span>
<span>상태</span>
<span/>
</div>
            <div className="document-rows">
              {visibleDocuments.map(item => <article key={item.id} className={selected?.documentId === item.id ? "selected" : ""} onClick={() => openItem({kind:"문서", title:`${item.title} ${item.version}`, subtitle:`${item.id} · ${item.status}`, documentId:item.id})}>
                <button className={`doc-check ${selectedDocs.includes(item.id) ? "checked" : ""}`} onClick={event => { event.stopPropagation(); setSelectedDocs(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current,item.id]); }} aria-label={`${item.title} 선택`}>{selectedDocs.includes(item.id) && <Check size={13}/>}</button>
                <div className="document-name">
<span className="linked-icon file">
<FileText size={17}/>
</span>
<div>
<small>{item.id} · {item.type}</small>
<strong>{item.title} <b>{item.version}</b>
</strong>
</div>
</div>
                <span className="document-project">
<b>{item.project}</b>
<small>진행 중</small>
</span>
                <span className="document-link">
<b>{item.link}</b>
<small>{item.issue}</small>
</span>
                <span className="wbs-owner">
<b>{item.owner === "Dean Kim" ? "DK" : item.owner.slice(0,1)}</b>{item.owner}</span>
<time>{item.updated}</time>
<em className={`wbs-state ${item.tone}`}>{item.status}</em>
<ChevronRight size={18}/>
              </article>)}
            </div>
          </section>

          {selectedDocs.length ? <section className="issue-ai-selection-bar document-selection-bar">
<div className="selection-count">
<Check size={16}/>
<strong>{selectedDocs.length}건 선택됨</strong>
<span>프로젝트 {selectedDocumentProjects}개 · 선택 문서와 최신 버전만 분석</span>
</div>
<div className="selection-actions">
<button onClick={() => setSelectedDocs([])}>선택 해제</button>
<span className="selection-ai-hint"><Sparkles size={15}/> 우측 AI 아이콘으로 분석</span>
</div>
</section> : <section className="document-ai-bar">
<FileCheck2 size={19}/>
<div>
<strong>선택 문서 AI 분석</strong>
<p>필터로 문서를 찾고 여러 건을 선택하면 요약·비교·누락 검토와 근거 문장을 함께 확인할 수 있어요.</p>
</div>
<button disabled>문서를 선택하세요 <ArrowRight size={15}/>
</button>
</section>}
        </div> : view === "issues" ? <ProjectIssueWorkspace project={selectedProject} onProjectChange={project=>setSelectedProject(project as ProjectRecord)} onAiContextChange={setModuleIssueContext} selectedIds={issueSelectedIds} onSelectedIdsChange={setIssueSelectedIds}/> : <div className="content issue-content">
          <section className="issue-heading">
            <div>
<p className="eyebrow">
<AlertTriangle size={15}/> 이슈 · 리스크</p>
<h1>프로젝트 이슈와 리스크</h1>
<p>문제의 영향도를 판단하고, 담당 조치부터 해결까지 한 흐름으로 관리하세요.</p>
</div>
            <button className="new-work">
<Plus size={17}/> 이슈 등록</button>
          </section>

          <section className="panel issue-board">
            <div className="issue-toolbar">
              <div>{(["전체","높음","조치 중","관찰"] as const).map(filter => <button key={filter} className={issueFilter === filter ? "active" : ""} onClick={() => setIssueFilter(filter)}>{filter}{filter === "전체" && <em>4</em>}</button>)}</div>
              <button className={`filter-button ${activeFilterCount(issueAdvanced) ? "has-filter" : ""}`} onClick={() => openFilters("issues")}>
<ListFilter size={16}/> 필터{activeFilterCount(issueAdvanced) > 0 && <b>{activeFilterCount(issueAdvanced)}</b>}</button>
            </div>
            {activeFilterCount(issueAdvanced) > 0 && <div className="applied-filters">
<span>적용된 필터</span>{issueAdvanced.projects.map(value => <em key={value}>프로젝트 · {value}</em>)}{issueAdvanced.criteria.map(value => <em key={value}>{value}</em>)}{issueAdvanced.owners.map(value => <em key={value}>담당 · {value}</em>)}<button onClick={() => clearAdvancedFilters("issues")}>전체 초기화 <X size={13}/>
</button>
</div>}
            <div className="issue-table-head">
<span/>
<span>이슈 · 리스크</span>
<span>프로젝트 정보</span>
<span>연결 업무</span>
<span>영향</span>
<span>담당자</span>
<span>기한</span>
<span>상태</span>
<span/>
</div>
            <div className="issue-rows">
              {visibleIssues.map(item => <article key={item.id} className={selected?.issueId === item.id ? "selected" : ""} onClick={() => openItem({kind:"이슈", title:item.title, subtitle:`${item.id} · ${item.project}`, issueId:item.id})}>
                <button className={`doc-check ${selectedIssues.includes(item.id) ? "checked" : ""}`} onClick={event => { event.stopPropagation(); setSelectedIssues(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current,item.id]); }} aria-label={`${item.title} 선택`}>{selectedIssues.includes(item.id) && <Check size={13}/>}</button>
                <div className="issue-name">
<span className={`issue-icon ${item.tone === "risk" ? "red" : item.tone === "warn" ? "amber" : "blue"}`}>
<AlertTriangle size={16}/>
</span>
<div>
<small>{item.id} · {item.severity} 위험</small>
<strong>{item.title}</strong>
</div>
</div>
                <span className="issue-project">
<b>{item.project}</b>
<small>{item.projectState}</small>
</span>
                <span className="issue-link">
<b>{item.link}</b>
<small>{item.linkedWork}</small>
</span>
                <span className="issue-impact">{item.impact}</span>
<span className="wbs-owner">
<b>{item.owner === "Dean Kim" ? "DK" : item.owner.slice(0,1)}</b>{item.owner}</span>
<time>{item.due}</time>
<em className={`wbs-state ${item.tone}`}>{item.status}</em>
<ChevronRight size={18}/>
              </article>)}
            </div>
          </section>
          {selectedIssues.length ? <section className="issue-ai-selection-bar">
<div className="selection-count">
<Check size={16}/>
<strong>{selectedIssues.length}건 선택됨</strong>
<span>프로젝트 {selectedIssueProjects}개 · 선택 항목만 분석</span>
</div>
<div className="selection-actions">
<button onClick={() => setSelectedIssues([])}>선택 해제</button>
<span className="selection-ai-hint"><Sparkles size={15}/> 우측 AI 아이콘으로 분석</span>
</div>
</section> : <section className="wbs-bottom-tip">
<Sparkles size={19}/>
<div>
<strong>AI 권고</strong>
<p>필터로 필요한 이슈를 찾고 여러 건을 선택하면 공통 원인, 반복 패턴과 대응안을 함께 분석할 수 있어요.</p>
</div>
<button onClick={() => openItem({kind:"이슈", title:"핵심 이슈 통합 대응", subtitle:"ISSUE-024 · RISK-011", issueId:"ISSUE-024"}, "ai")}>통합 대응안 만들기 <ArrowRight size={15}/>
</button>
</section>}
        </div>}
      </section>

      <button className="floating-ai" onClick={openGlobalAI} aria-label="공통 AI 대화 열기">
<Sparkles size={22}/>
<span>AI</span>
{currentAiContext().length>0&&<b>{currentAiContext().length}</b>}
</button>
      {saveNotice&&<div className="save-toast" role="status">{saveNotice}</div>}

      {filterScope && <div className="filter-overlay" onClick={() => setFilterScope(null)}>
        <aside className="advanced-filter" onClick={event => event.stopPropagation()} aria-label="고급 필터">
          <div className="filter-head compact-filter-head">
<div>
<span>{filterScope === "issues" ? "이슈 · 리스크" : "문서 · 산출물"}</span>
<strong>상세 필터</strong>
<p>여러 조건을 조합해 필요한 데이터만 확인하세요.</p>
</div>
<div className="compact-filter-actions">
<div className="compact-filter-logic" aria-label="조건 결합 방식"><small>조건 결합</small><button title="모든 조건 만족" className={draftFilters.logic === "AND" ? "active" : ""} onClick={() => setDraftFilters(current => ({...current, logic:"AND"}))}>AND</button><button title="하나 이상 만족" className={draftFilters.logic === "OR" ? "active" : ""} onClick={() => setDraftFilters(current => ({...current, logic:"OR"}))}>OR</button></div>
<button className="compact-filter-close" onClick={() => setFilterScope(null)} aria-label="필터 닫기"><X size={20}/></button>
</div>
</div>
          <div className="filter-section searchable-filter">
<div className="filter-section-title">
<strong>프로젝트</strong>
<span>검색 후 계속 추가</span>
</div>
<div className="filter-search">
<Search size={15}/>
<input value={projectFilterSearch} onChange={event => setProjectFilterSearch(event.target.value)} placeholder="프로젝트명 검색..." aria-label="프로젝트 검색"/>{projectFilterSearch && <button onClick={() => setProjectFilterSearch("")} aria-label="검색어 지우기">
<X size={14}/>
</button>}</div>{draftFilters.projects.length > 0 && <div className="selected-filter-chips">{draftFilters.projects.map(value => <button key={value} onClick={() => toggleDraft("projects",value)}>{value}<X size={12}/>
</button>)}</div>}<div className="search-results">{projectOptions.map(project => <label key={project.name} className={draftFilters.projects.includes(project.name) ? "checked" : ""}>
<input type="checkbox" checked={draftFilters.projects.includes(project.name)} onChange={() => toggleDraft("projects", project.name)}/>
<i>{draftFilters.projects.includes(project.name) && <Check size={13}/>}</i>
<span>{project.name}</span>
<small>{project.state}</small>
</label>)}</div>
</div>
          <div className="filter-section">
<div className="filter-section-title">
<strong>{filterScope === "issues" ? "위험도 · 조치 상태" : "문서 상태 · 유형"}</strong>
<span>복수 선택</span>
</div>
<div className="filter-chip-grid">{(filterScope === "issues" ? ["높음","중간","낮음","조치 중","검토 중","관찰"] : ["검토 중","승인","작성 중","배포","필수 산출물","설계 문서"]).map(value => <button key={value} className={draftFilters.criteria.includes(value) ? "active" : ""} onClick={() => toggleDraft("criteria", value)}>{value}{draftFilters.criteria.includes(value) && <Check size={13}/>}</button>)}</div>
</div>
          <div className="filter-section searchable-filter">
<div className="filter-section-title">
<strong>담당자</strong>
<span>이름으로 검색</span>
</div>
<div className="filter-search">
<Search size={15}/>
<input value={ownerFilterSearch} onChange={event => setOwnerFilterSearch(event.target.value)} placeholder="이름 · 부서 검색..." aria-label="담당자 검색"/>{ownerFilterSearch && <button onClick={() => setOwnerFilterSearch("")} aria-label="검색어 지우기">
<X size={14}/>
</button>}</div>{draftFilters.owners.length > 0 && <div className="selected-filter-chips">{draftFilters.owners.map(value => <button key={value} onClick={() => toggleDraft("owners",value)}>{value}<X size={12}/>
</button>)}</div>}<div className="owner-search-results">{ownerOptions.map(value => <button key={value} className={draftFilters.owners.includes(value) ? "active" : ""} onClick={() => toggleDraft("owners", value)}>
<span className="mini-owner">{value === "Dean Kim" ? "DK" : value.slice(0,1)}</span>
<span>{value}</span>{draftFilters.owners.includes(value) && <Check size={14}/>}</button>)}</div>
</div>
          <div className="filter-preview">
<ListFilter size={16}/>
<span>현재 조건 적용 시</span>
<strong>{filterScope === "issues" ? issueItems.filter(item => matchesAdvanced([item.project,item.severity,item.status,item.owner], draftFilters)).length : documentItems.filter(item => matchesAdvanced([item.project,item.status,item.type,item.owner], draftFilters)).length}건</strong>
</div>
          <div className="filter-actions">
<button onClick={() => setDraftFilters(emptyFilters)}>초기화</button>
<button className="apply" onClick={applyAdvancedFilters}>필터 적용</button>
</div>
        </aside>
      </div>}

      {selected && <aside className="context-panel" aria-label="업무 상세 및 AI 대화">
        <div className="context-head">
<div>
<span>{selected.kind}</span>
<strong>{selected.title}</strong>
<p>{selected.subtitle}</p>
</div>
<button onClick={() => setSelected(null)} aria-label="패널 닫기">
<X size={20}/>
</button>
</div>
        <div className={`context-tabs ${(selected.kind === "WBS" || selected.kind === "이슈" || selected.kind === "문서") ? "wbs-context-tabs" : ""}`}>
          <button className={panelMode === "detail" ? "active" : ""} onClick={() => setPanelMode("detail")}>상세정보</button>
          {selected.kind === "WBS" && <>
<button className={panelMode === "deliverables" ? "active" : ""} onClick={() => setPanelMode("deliverables")}>산출물</button>
<button className={panelMode === "issues" ? "active" : ""} onClick={() => setPanelMode("issues")}>이슈</button>
<button className={panelMode === "history" ? "active" : ""} onClick={() => setPanelMode("history")}>이력</button>
</>}
          {selected.kind === "이슈" && <>
<button className={panelMode === "deliverables" ? "active" : ""} onClick={() => setPanelMode("deliverables")}>조치계획</button>
<button className={panelMode === "history" ? "active" : ""} onClick={() => setPanelMode("history")}>이력</button>
</>}
          {selected.kind === "문서" && <>
<button className={panelMode === "preview" ? "active" : ""} onClick={() => setPanelMode("preview")}>미리보기</button>
<button className={panelMode === "versions" ? "active" : ""} onClick={() => setPanelMode("versions")}>버전</button>
</>}
          <button className={panelMode === "ai" ? "active" : ""} onClick={() => setPanelMode("ai")}>
<Sparkles size={15}/> AI 대화</button>
        </div>
        {panelMode === "detail" ? <div className="context-body detail-body">
          <div className="context-summary">
<span>현재 상태</span>
<strong>{selected.kind === "프로젝트" ? "주의 · 일정 확인 필요" : selected.kind === "이슈" ? "조치 중 · 높은 영향도" : selected.kind === "문서" ? "검토 중 · 최신 버전 v1.3" : "진행 중 · 오늘 처리 권장"}</strong>
<p>선택한 항목의 핵심 정보와 관련 업무 문맥을 한곳에서 확인합니다.</p>
</div>
          <dl>
<div>
<dt>담당자</dt>
<dd>{selectedDocument?.owner ?? "Dean Kim"}</dd>
</div>
<div>
<dt>우선순위</dt>
<dd>높음</dd>
</div>
<div>
<dt>최근 변경</dt>
<dd>{selectedDocument?.updated ?? "오늘 09:30"}</dd>
</div>{selected.kind === "문서" && selectedDocument && <>
<div>
<dt>프로젝트</dt>
<dd>{selectedDocument.project}</dd>
</div>
<div>
<dt>연결 WBS</dt>
<dd>{selectedDocument.link}</dd>
</div>
<div>
<dt>연결 이슈</dt>
<dd>{selectedDocument.issue === "-" ? "연결 이슈 없음" : selectedDocument.issue}</dd>
</div>
</>}{selected.kind === "WBS" && <>
<div>
<dt>계획 기간</dt>
<dd>7월 29일 — 8월 2일</dd>
</div>
<div>
<dt>선행 WBS</dt>
<dd>1.2.1 요구사항 취합</dd>
</div>
<div>
<dt>진척률</dt>
<dd>72%</dd>
</div>
</>}</dl>
          {selected.kind === "업무" && <button className="complete-action" onClick={() => { const task = tasks.find(t => t.title === selected.title); if (task) setCompleted(v => v.includes(task.id) ? v : [...v, task.id]); }}>업무 완료 처리 <Check size={16}/>
</button>}
          <button className="primary-action" onClick={() => selected.kind === "문서" ? setPanelMode("preview") : (selected.kind === "WBS" || selected.kind === "이슈") ? setPanelMode("deliverables") : moveTo(selected.kind === "프로젝트" ? "project" : "work")}>{selected.kind === "프로젝트" ? "프로젝트 AI HOME 열기" : selected.kind === "WBS" ? "연결 정보 확인하기" : selected.kind === "이슈" ? "조치계획 확인하기" : selected.kind === "문서" ? "문서 미리보기" : "MY WORK에서 처리하기"}<ArrowRight size={16}/>
</button>
        </div> : panelMode === "deliverables" ? <div className="context-body linked-body">
          {selected.kind === "이슈" ? <>
<div className="linked-title">
<div>
<strong>조치계획</strong>
<span>담당자와 완료 조건을 기준으로 추적합니다.</span>
</div>
<button>
<Plus size={15}/> 추가</button>
</div>
<button className="linked-card">
<span className="linked-icon issue">
<Check size={17}/>
</span>
<span>
<strong>고객 승인 요청안 최종 전달</strong>
<small>Dean Kim · 오늘 11:30까지</small>
</span>
<em className="done">완료</em>
<ChevronRight size={17}/>
</button>
<button className="linked-card">
<span className="linked-icon file">
<Clock3 size={17}/>
</span>
<span>
<strong>승인 결과 반영 및 일정 재계산</strong>
<small>Dean Kim · 승인 후 1시간 이내</small>
</span>
<em>대기</em>
<ChevronRight size={17}/>
</button>
<button className="primary-action">조치 완료 처리 <Check size={16}/>
</button>
</> : <>
<div className="linked-title">
<div>
<strong>연결 산출물</strong>
<span>2개 문서가 이 WBS에 연결되어 있습니다.</span>
</div>
<button onClick={()=>setDocumentRegistration({wbs:selected.wbsId})}>
<Plus size={15}/> 추가</button>
</div>
<button className="linked-card">
<span className="linked-icon file">
<FileText size={17}/>
</span>
<span>
<strong>요구사항 정의서_v1.3</strong>
<small>DOC-104 · 오늘 09:30 수정</small>
</span>
<em>검토 중</em>
<ChevronRight size={17}/>
</button>
<button className="linked-card">
<span className="linked-icon file">
<FileText size={17}/>
</span>
<span>
<strong>요구사항 추적표</strong>
<small>DOC-108 · 어제 17:12 수정</small>
</span>
<em className="done">승인</em>
<ChevronRight size={17}/>
</button>
</>}
        </div> : panelMode === "preview" ? (()=>{const previewDocument=moduleDocumentContext.find(item=>item.preview);return <div className="context-body document-preview-body">
<div className="preview-page">
<FileText size={30}/>
<strong>{previewDocument?.title||"선택 문서"}</strong>
<span>{previewDocument?.preview?`Rev.${String(previewDocument.preview.revision).padStart(2,"0")} · ${previewDocument.preview.fileName}`:"등록된 파일이 없습니다."}</span>
<p>{previewDocument?.meta||"선택한 문서의 최신 Revision을 확인합니다."}</p>
</div>
<div className="preview-actions">
<button disabled={!previewDocument?.preview} onClick={()=>{if(previewDocument?.preview)openDocumentPreview(previewDocument.preview)}}>
<Eye size={16}/> 전체 보기</button>
{previewDocument?.preview?<a className="button" href={`/api/projects/${previewDocument.preview.projectId}/deliverables?versionId=${previewDocument.preview.versionId}`} target="_blank" rel="noreferrer"><Download size={16}/> 다운로드</a>:<button disabled><Download size={16}/> 다운로드</button>}
</div>
</div>;})() : panelMode === "versions" ? <div className="context-body history-body">
<div className="linked-title">
<div>
<strong>버전 이력</strong>
<span>승인·배포된 버전은 변경되지 않습니다.</span>
</div>
<button>
<Upload size={15}/> 새 버전</button>
</div>
<div className="history-line">
<i/>
<div>
<strong>v1.3 · 현재 버전</strong>
<span>Dean Kim · 오늘 09:30</span>
<p>고객 검토 의견 4건을 반영했습니다.</p>
</div>
</div>
<div className="history-line">
<i/>
<div>
<strong>v1.2</strong>
<span>박지연 · 8월 4일 16:20</span>
<p>요구사항 추적표와 항목 번호를 동기화했습니다.</p>
</div>
</div>
<div className="history-line">
<i/>
<div>
<strong>v1.0 · 최초 승인</strong>
<span>김서준 · 7월 29일</span>
</div>
</div>
</div> : panelMode === "issues" ? <div className="context-body linked-body">
          <div className="linked-title">
<div>
<strong>이슈 · 리스크</strong>
<span>현재 조치가 필요한 항목 1건</span>
</div>
<button>
<Plus size={15}/> 등록</button>
</div>
          <button className="linked-card">
<span className="linked-icon issue">
<AlertTriangle size={17}/>
</span>
<span>
<strong>고객 요구사항 승인 지연</strong>
<small>ISSUE-024 · 담당 Dean Kim</small>
</span>
<em className="risk">높음</em>
<ChevronRight size={17}/>
</button>
          <div className="linked-empty">
<ShieldCheck size={18}/>
<span>추가로 감지된 신규 리스크는 없습니다.</span>
</div>
        </div> : panelMode === "history" ? <div className="context-body history-body">
          <div className="history-line">
<i/>
<div>
<strong>진척률 68% → 72%</strong>
<span>Dean Kim · 오늘 09:30</span>
<p>요구사항 추적표 검토 결과를 반영했습니다.</p>
</div>
</div>
          <div className="history-line">
<i/>
<div>
<strong>마감일 7월 30일 → 8월 2일</strong>
<span>박지연 · 어제 16:20</span>
<p>고객 승인 일정에 맞춰 변경했습니다.</p>
</div>
</div>
          <div className="history-line">
<i/>
<div>
<strong>ISSUE-024 연결</strong>
<span>AI PMS · 어제 15:44</span>
<p>일정 지연 가능성을 자동 감지했습니다.</p>
</div>
</div>
        </div> : <div className="context-body ai-body">{(()=>{const items=currentAiContext();const source=view==="search"?"통합검색":items.some(item=>item.kind==="문서")&&items.some(item=>item.kind==="이슈")?"문서 · 산출물 + 이슈 · 리스크":items.some(item=>item.kind==="문서")?"문서 · 산출물":items.some(item=>item.kind==="이슈")?"이슈 · 리스크":items.some(item=>item.kind==="WBS")?"일정 · WBS":"프로젝트 AI HOME";return <CommonAiChatPanel
          items={items as CommonAiContextItem[]}
          projectName={selectedProject?.name||selected.subtitle.split(" · ")[0]||"현재 프로젝트"}
          source={source}
          contextType={view}
          contextTitle={selected.title}
          onRemove={item=>removeCurrentAiContextItem(item as AiContextItem)}
          onClear={clearCurrentAiContext}
        />})()}</div>}
      </aside>}
      {documentRegistration && (
        <DocumentRegistrationDialog
          categories={documentCategories}
          wbs={documentRegistration.wbs}
          onClose={() => setDocumentRegistration(null)}
        />
      )}
    </main>
  );
}
export default function Home() {
  const [useWorkViewV2,setUseWorkViewV2]=useState<boolean|null>(null);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const next=window.location.port==="5174"||params.get("ui")==="v2";
    queueMicrotask(()=>setUseWorkViewV2(next));
  },[]);
  if(useWorkViewV2===null)return <main style={{minHeight:"100vh",background:"#f7f9fc"}}/>;
  return useWorkViewV2?<NewWorkViewApp/>:<LegacyHome/>;
}

type ProjectDeliverable={id?:string;name:string;type:string;required:boolean};
type ProjectWbsRow={dbId?:string;clientKey:string;code:string;level:number;kind:"summary"|"task";name:string;taskType:"normal"|"gate";duration:number;startDate:string;endDate:string;predecessorKey:string;roleCode:string;assigneeUserId:string;assigneeName:string;completionActor:string;completionCriteria:string;deliverables:ProjectDeliverable[]};
type ProjectWbsRole={code:string;name:string;sortOrder:number};
type ProjectWbsMember={userId:string;name:string;projectRole:string};

const dateAtUtc=(value:string)=>new Date(`${value}T00:00:00Z`);
const formatDateInput=(date:Date)=>date.toISOString().slice(0,10);
const endDateFromDuration=(startDate:string,duration:number)=>{
  if(!startDate)return "";
  const date=dateAtUtc(startDate);
  date.setUTCDate(date.getUTCDate()+Math.max(1,duration)-1);
  return formatDateInput(date);
};
const durationFromDates=(startDate:string,endDate:string)=>{
  if(!startDate||!endDate)return 1;
  return Math.max(1,Math.floor((dateAtUtc(endDate).getTime()-dateAtUtc(startDate).getTime())/86400000)+1);
};
const dayAfter=(value:string)=>{if(!value)return "";const date=dateAtUtc(value);date.setUTCDate(date.getUTCDate()+1);return formatDateInput(date)};
const normalizeProjectWbsRows=(source:ProjectWbsRow[])=>{
  let previousLevel=1;
  const counters:number[]=[];
  let rows=source.map((row,index)=>{
    const requested=Math.max(1,Math.min(4,Number(row.level)||1));
    const level=index===0?1:Math.min(requested,previousLevel+1);
    previousLevel=level;
    counters[level-1]=(counters[level-1]||0)+1;
    counters.length=level;
    return {...row,level,code:counters.join(".")};
  });
  rows=rows.map((row,index)=>{
    const kind=rows[index+1]?.level>row.level?"summary" as const:"task" as const;
    return kind==="summary"?{...row,kind,taskType:"normal" as const,duration:0,predecessorKey:"",roleCode:"",assigneeUserId:"",assigneeName:"",deliverables:[]}:{...row,kind,duration:Math.max(1,Number(row.duration)||1),endDate:endDateFromDuration(row.startDate,Math.max(1,Number(row.duration)||1))};
  });
  const byKey=new Map(rows.map(row=>[row.clientKey,row]));
  rows=rows.map(row=>row.kind==="task"&&row.predecessorKey&&byKey.get(row.predecessorKey)?.kind==="task"&&row.predecessorKey!==row.clientKey?row:{...row,predecessorKey:""});
  for(let pass=0;pass<rows.length;pass++){
    let changed=false;
    rows=rows.map(row=>{
      if(row.kind!=="task"||!row.predecessorKey)return row;
      const predecessor=rows.find(item=>item.clientKey===row.predecessorKey);
      if(!predecessor?.endDate)return row;
      const startDate=dayAfter(predecessor.endDate);
      const endDate=endDateFromDuration(startDate,row.duration);
      if(startDate===row.startDate&&endDate===row.endDate)return row;
      changed=true;return {...row,startDate,endDate};
    });
    if(!changed)break;
  }
  for(let index=rows.length-1;index>=0;index--){
    const row=rows[index];
    if(row.kind!=="summary")continue;
    const descendants:ProjectWbsRow[]=[];
    for(let cursor=index+1;cursor<rows.length&&rows[cursor].level>row.level;cursor++)if(rows[cursor].kind==="task")descendants.push(rows[cursor]);
    const starts=descendants.map(item=>item.startDate).filter(Boolean).sort();
    const ends=descendants.map(item=>item.endDate).filter(Boolean).sort();
    rows[index]={...row,startDate:starts[0]||"",endDate:ends.at(-1)||"",duration:starts.length&&ends.length?durationFromDates(starts[0],ends.at(-1)!):0};
  }
  return rows;
};
const projectSubtreeEnd=(rows:ProjectWbsRow[],index:number)=>{let end=index+1;while(end<rows.length&&rows[end].level>rows[index].level)end++;return end;};

function ProjectWbsEditor({project,onClose}:{project:ProjectRecord|null;onClose:()=>void}) {
  const [documentCategories]=useDocumentCategories();
  const [rows,setRows]=useState<ProjectWbsRow[]>([]);
  const [roles,setRoles]=useState<ProjectWbsRole[]>([]);
  const [members,setMembers]=useState<ProjectWbsMember[]>([]);
  const [loading,setLoading]=useState(Boolean(project));
  const [saveError,setSaveError]=useState("");
  const [saveState,setSaveState]=useState<"idle"|"saving"|"saved">("idle");
  const [selectedIndex,setSelectedIndex]=useState(0);
  const [dirty,setDirty]=useState(false);
  const [taskFilter,setTaskFilter]=useState<"all"|"normal"|"gate"|"summary">("all");
  const nameInputs=useRef<Array<HTMLInputElement|null>>([]);
  const durationInputs=useRef<Array<HTMLInputElement|null>>([]);
  const [pendingNameFocus,setPendingNameFocus]=useState<number|null>(null);
  const selected=rows[selectedIndex]??rows[0];
  const applyServerData=(result:{tasks?:ProjectWbsApiTask[];roles?:ProjectWbsRole[];members?:ProjectWbsMember[]})=>{
    const next=normalizeProjectWbsRows((result.tasks??[]).map(task=>({dbId:task.id,clientKey:task.id,code:task.wbsCode,level:task.level,kind:task.kind,name:task.name,taskType:task.taskType,duration:task.durationDays,startDate:task.plannedStart||project?.startDate||"",endDate:task.plannedEnd||task.plannedStart||project?.startDate||"",predecessorKey:task.predecessorId||"",roleCode:task.roleCode||"",assigneeUserId:task.assigneeUserId||"",assigneeName:task.assigneeName||"",completionActor:task.completionActor||"assignee",completionCriteria:task.completionCriteria||"",deliverables:task.deliverables.map(item=>({id:item.id,name:item.name,type:item.type||"기타 > 미분류",required:item.required!==false}))})));
    setRows(next);setRoles(result.roles??[]);setMembers(result.members??[]);setSelectedIndex(current=>Math.max(0,Math.min(current,next.length-1)));setDirty(false);
  };
  useEffect(()=>{if(!project?.id)return;fetch(`/api/projects/${project.id}/wbs`,{cache:"no-store"}).then(async response=>{const text=await response.text();const result=(text?JSON.parse(text):{}) as {error?:string;tasks?:ProjectWbsApiTask[];roles?:ProjectWbsRole[];members?:ProjectWbsMember[]};if(!response.ok)throw new Error(result.error||"WBS를 불러오지 못했습니다.");applyServerData(result)}).catch(error=>setSaveError(error instanceof Error?error.message:"WBS를 불러오지 못했습니다.")).finally(()=>setLoading(false));
  // applyServerData intentionally rehydrates all project-owned data together.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[project?.id,project?.startDate]);
  const projectDeliverableCategories = documentCategories.flatMap(level1=>level1.enabled?level1.children.filter(level2=>level2.enabled).map(level2=>`${level1.name} > ${level2.name}`):[]);
  const markChanged=()=>{setDirty(true);setSaveState("idle");setSaveError("")};
  const update=(index:number,key:keyof ProjectWbsRow,value:string|number|ProjectDeliverable[])=>{setRows(current=>normalizeProjectWbsRows(current.map((row,i)=>{
    if(i!==index)return row;
    if(row.kind==="summary"&&(["taskType","duration","predecessorKey","roleCode","assigneeUserId","deliverables"] as Array<keyof ProjectWbsRow>).includes(key))return row;
    const next={...row,[key]:value} as ProjectWbsRow;
    if(key==="duration"){
      next.duration=Math.max(1,Number(value)||1);
      next.endDate=endDateFromDuration(next.startDate,next.duration);
    }
    if(key==="startDate"){
      next.startDate=String(value);
      next.endDate=endDateFromDuration(next.startDate,next.duration);
    }
    if(key==="endDate"){
      next.endDate=String(value);
      if(next.startDate&&next.endDate<next.startDate)next.endDate=next.startDate;
      next.duration=durationFromDates(next.startDate,next.endDate);
    }
    return next;
  })));markChanged()};
  const add=(child=false,baseIndex=selectedIndex)=>{const base=rows[baseIndex];const today=project?.startDate||new Date().toISOString().slice(0,10);const roleCode=roles[0]?.code||"";const member=members[0];const level=base?(child?Math.min(4,base.level+1):base.level):1;const insert=base?(child?baseIndex+1:projectSubtreeEnd(rows,baseIndex)):0;const predecessor=base?.kind==="task"?base.clientKey:"";const row:ProjectWbsRow={clientKey:crypto.randomUUID(),code:"",level,kind:"task",name:"새 Task",taskType:"normal",duration:1,startDate:base?.endDate?dayAfter(base.endDate):today,endDate:base?.endDate?dayAfter(base.endDate):today,predecessorKey:predecessor,roleCode,assigneeUserId:member?.userId||"",assigneeName:member?.name||"",completionActor:"assignee",completionCriteria:"",deliverables:[]};const copy=[...rows];copy.splice(insert,0,row);setRows(normalizeProjectWbsRows(copy));setSelectedIndex(insert);setPendingNameFocus(insert);markChanged()};
  useEffect(()=>{if(pendingNameFocus===null)return;const input=nameInputs.current[pendingNameFocus];if(!input)return;input.focus();input.select();setPendingNameFocus(null)},[pendingNameFocus,rows]);
  const move=(direction:-1|1)=>{if(!selected)return;const start=selectedIndex;const end=projectSubtreeEnd(rows,start);const block=rows.slice(start,end);let copy:ProjectWbsRow[];let nextIndex=start;if(direction===-1){let previous=start-1;while(previous>=0&&rows[previous].level>selected.level)previous--;if(previous<0||rows[previous].level!==selected.level)return;copy=[...rows.slice(0,previous),...block,...rows.slice(previous,start),...rows.slice(end)];nextIndex=previous}else{const next=end;if(next>=rows.length||rows[next].level!==selected.level)return;const nextEnd=projectSubtreeEnd(rows,next);copy=[...rows.slice(0,start),...rows.slice(next,nextEnd),...block,...rows.slice(nextEnd)];nextIndex=start+(nextEnd-next)}setRows(normalizeProjectWbsRows(copy));setSelectedIndex(nextIndex);markChanged()};
  const changeLevel=(delta:-1|1)=>{if(!selected)return;const start=selectedIndex;const end=projectSubtreeEnd(rows,start);if(delta===-1&&selected.level===1)return;if(delta===1&&(selected.level===4||start===0||rows[start-1].level<selected.level))return;setRows(normalizeProjectWbsRows(rows.map((row,index)=>index>=start&&index<end?{...row,level:row.level+delta}:row)));markChanged()};
  const remove=(index:number)=>{const end=projectSubtreeEnd(rows,index);const count=end-index;if(count>1&&!window.confirm(`'${rows[index].name}' 그룹과 하위 ${count-1}개 Task를 함께 삭제할까요?`))return;const removedKeys=new Set(rows.slice(index,end).map(row=>row.clientKey));const next=rows.filter((_,rowIndex)=>rowIndex<index||rowIndex>=end).map(row=>removedKeys.has(row.predecessorKey)?{...row,predecessorKey:""}:row);setRows(normalizeProjectWbsRows(next));setSelectedIndex(Math.max(0,Math.min(index-1,next.length-1)));markChanged()};
  const addDeliverable=()=>selected&&update(selectedIndex,"deliverables",[...selected.deliverables,{name:"",type:projectDeliverableCategories[0]||"기타 > 미분류",required:true}]);
  const updateProjectDeliverable=(deliverableIndex:number,key:keyof ProjectDeliverable,value:string|boolean)=>update(selectedIndex,"deliverables",selected.deliverables.map((item,index)=>index===deliverableIndex?{...item,[key]:value}:item));
  const removeProjectDeliverable=(deliverableIndex:number)=>update(selectedIndex,"deliverables",selected.deliverables.filter((_,index)=>index!==deliverableIndex));
  const visibleRows=rows.map((row,index)=>({row,index})).filter(({row})=>taskFilter==="all"||(taskFilter==="summary"?row.kind==="summary":row.kind==="task"&&row.taskType===taskFilter));
  const focusName=(index:number)=>{setSelectedIndex(index);setPendingNameFocus(index)};
  const handleNameKeyDown=(event:ReactKeyboardEvent<HTMLInputElement>,index:number)=>{if(event.nativeEvent.isComposing)return;if(event.key==="ArrowUp"||event.key==="ArrowDown"){event.preventDefault();const position=visibleRows.findIndex(item=>item.index===index);const target=visibleRows[position+(event.key==="ArrowUp"?-1:1)]?.index;if(target!==undefined)focusName(target);return}if(event.key!=="Enter")return;event.preventDefault();if(event.ctrlKey||event.metaKey){add(true,index);return}const position=visibleRows.findIndex(item=>item.index===index);const target=visibleRows[position+(event.shiftKey?-1:1)]?.index;if(target!==undefined){focusName(target);return}if(!event.shiftKey)add(false,index)};
  const handleDurationKeyDown=(event:ReactKeyboardEvent<HTMLInputElement>,index:number)=>{if(event.nativeEvent.isComposing||event.key!=="Enter")return;event.preventDefault();const editable=visibleRows.filter(item=>item.row.kind==="task");const position=editable.findIndex(item=>item.index===index);const target=editable[position+(event.shiftKey?-1:1)]?.index;if(target===undefined){event.currentTarget.blur();return}setSelectedIndex(target);requestAnimationFrame(()=>{durationInputs.current[target]?.focus();durationInputs.current[target]?.select()})};
  const rowDeliverableCount=(rowIndex:number)=>{const row=rows[rowIndex];if(!row)return 0;if(row.kind==="task")return row.deliverables.length;let count=0;for(let index=rowIndex+1;index<rows.length&&rows[index].level>row.level;index++)if(rows[index].kind==="task")count+=rows[index].deliverables.length;return count};
  const executableRows=rows.filter(row=>row.kind==="task"&&row.startDate&&row.endDate);const planStarts=executableRows.map(row=>row.startDate).sort();const planEnds=executableRows.map(row=>row.endDate).sort();const totalPlanDays=planStarts.length?durationFromDates(planStarts[0],planEnds.at(-1)!):0;
  const roleLabel=(role:ProjectWbsRole)=>({PROJECT_PM:"프로젝트 PM",PL:"PL",CONSULTANT:"업무 컨설턴트",DEV_LEAD:"개발 리드",QA:"품질 검증"} as Record<string,string>)[role.code]||role.name||role.code;
  const save=async()=>{if(!project?.id||saveState==="saving")return;setSaveError("");setSaveState("saving");try{const response=await fetch(`/api/projects/${project.id}/wbs`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({tasks:rows.map(row=>({id:row.dbId,clientKey:row.clientKey,wbsCode:row.code,level:row.level,name:row.name,taskType:row.taskType,durationDays:row.duration,plannedStart:row.startDate,plannedEnd:row.endDate,predecessorClientKey:row.predecessorKey||undefined,roleCode:row.roleCode||undefined,assigneeUserId:row.assigneeUserId||undefined,completionActor:row.completionActor,completionCriteria:row.completionCriteria,deliverables:row.kind==="task"?row.deliverables:[]}))})});const text=await response.text();const result=(text?JSON.parse(text):{}) as {error?:string};if(!response.ok)throw new Error(result.error||"WBS를 저장하지 못했습니다.");const refreshed=await fetch(`/api/projects/${project.id}/wbs`,{cache:"no-store"});const refreshedText=await refreshed.text();const refreshedData=(refreshedText?JSON.parse(refreshedText):{}) as {error?:string;tasks?:ProjectWbsApiTask[];roles?:ProjectWbsRole[];members?:ProjectWbsMember[]};if(!refreshed.ok)throw new Error(refreshedData.error||"저장 결과를 다시 확인하지 못했습니다.");applyServerData(refreshedData);setSaveState("saved");window.setTimeout(()=>setSaveState(current=>current==="saved"?"idle":current),2200)}catch(error){setSaveError(error instanceof Error?error.message:"WBS를 저장하지 못했습니다.");setSaveState("idle")}};
  if(!project)return <div className="content project-wbs-editor-content"><section className="panel empty-work"><Target size={30}/><strong>프로젝트를 먼저 선택해 주세요.</strong><p>프로젝트 목록에서 WBS 열기를 선택하면 해당 프로젝트의 데이터를 편집할 수 있습니다.</p></section></div>;
  if(loading)return <div className="content project-wbs-editor-content"><section className="panel project-loading">WBS를 불러오는 중입니다.</section></div>;
  return <div className="content project-wbs-editor-content">
    <section className="project-editor-shell">
      <header className="project-editor-header"><div><span>PROJECT WBS · 준비 단계</span><h1>{project.name} · WBS 편집</h1><p>{project.code} · 템플릿에서 복사된 프로젝트 전용 WBS · {project.startDate} ~ {project.endDate}</p></div><div className="draft-state"><span>{saveState==="saving"?"저장 중":saveState==="saved"?"저장 완료":dirty?"변경사항 있음":"변경사항 없음"}</span><button onClick={onClose} aria-label="WBS 편집 탭 닫기"><X size={19}/></button></div></header>
      <div className="project-editor-toolbar"><strong>WBS 편집</strong><button onClick={()=>add(false)}><Plus size={14}/> 같은 레벨</button><button onClick={()=>add(true)} disabled={!selected}><Plus size={14}/> 하위 Task</button><button onClick={()=>changeLevel(-1)} disabled={!selected}><IndentDecrease size={14}/> 내어쓰기</button><button onClick={()=>changeLevel(1)} disabled={!selected}><IndentIncrease size={14}/> 들여쓰기</button><button onClick={()=>move(-1)} disabled={!selected} aria-label="위로 이동"><ArrowUp size={14}/></button><button onClick={()=>move(1)} disabled={!selected} aria-label="아래로 이동"><ArrowDown size={14}/></button><span><Clock3 size={15}/> 총 계획 {totalPlanDays}일</span></div>
      <div className="project-editor-grid">
        <section className="project-editor-table"><header><div><strong>WBS 트리</strong><small>{visibleRows.length}/{rows.length}개 표시</small></div><label><ListFilter size={14}/> Task Type <select value={taskFilter} onChange={event=>setTaskFilter(event.target.value as typeof taskFilter)}><option value="all">전체</option><option value="normal">일반 Task</option><option value="gate">Gate Task</option><option value="summary">그룹 WBS</option></select></label></header>
          <div className="project-editor-head"><span>WBS / Task명</span><span>자동 구분</span><span>Task Type</span><span>소요일</span><span>선행</span><span>담당 ROLE</span><span>산출물</span><span>삭제</span></div>
          {!rows.length&&<div className="project-editor-empty"><Layers3 size={26}/><strong>등록된 WBS가 없습니다.</strong><button onClick={()=>add(false)}>첫 Task 추가</button></div>}
          {visibleRows.map(({row,index})=><div key={row.clientKey} className={`project-editor-row ${selectedIndex===index?"active":""}`} onClick={()=>setSelectedIndex(index)}>
            <div className="project-task-name" style={{paddingLeft:10+(row.level-1)*20}}><span>{row.code}</span><CircleDot size={14}/><input ref={element=>{nameInputs.current[index]=element}} value={row.name} title="Enter: 다음 Task · Shift+Enter: 이전 Task · Ctrl+Enter: 하위 Task 추가" onClick={e=>e.stopPropagation()} onFocus={()=>setSelectedIndex(index)} onKeyDown={event=>handleNameKeyDown(event,index)} onChange={e=>update(index,"name",e.target.value)}/></div>
            <em className={row.kind}>{row.kind==="summary"?`${row.level}레벨 그룹`:"실행 Task"}</em>
            <select value={row.taskType} disabled={row.kind==="summary"} onClick={e=>e.stopPropagation()} onChange={e=>update(index,"taskType",e.target.value)}><option value="normal">일반 Task</option><option value="gate">Gate Task</option></select>
            <input ref={element=>{durationInputs.current[index]=element}} type="number" min="1" disabled={row.kind==="summary"} value={row.duration} title="Enter: 다음 소요일 · Shift+Enter: 이전 소요일" onClick={e=>e.stopPropagation()} onKeyDown={event=>handleDurationKeyDown(event,index)} onChange={e=>update(index,"duration",Number(e.target.value))}/>
            <select value={row.predecessorKey} disabled={row.kind==="summary"} onClick={e=>e.stopPropagation()} onChange={e=>update(index,"predecessorKey",e.target.value)}><option value="">없음</option>{rows.filter(item=>item.kind==="task"&&item.clientKey!==row.clientKey).map(item=><option key={item.clientKey} value={item.clientKey}>{item.code}</option>)}</select>
            <select value={row.roleCode} disabled={row.kind==="summary"} onClick={e=>e.stopPropagation()} onChange={e=>update(index,"roleCode",e.target.value)}><option value="">미지정</option>{roles.map(role=><option key={role.code} value={role.code}>{roleLabel(role)}</option>)}</select>
            <button type="button" className="project-output" disabled={row.kind==="summary"} onClick={event=>{event.stopPropagation();setSelectedIndex(index)}} aria-label={`${row.name} 산출물 ${rowDeliverableCount(index)}건 편집`} title={row.kind==="summary"?"그룹 WBS에는 산출물을 직접 등록할 수 없습니다.":"산출물 편집"}><FileText size={14}/><b>{rowDeliverableCount(index)}</b></button><button className="grid-delete" onClick={e=>{e.stopPropagation();remove(index)}} aria-label={`${row.name} 삭제`}><Trash2 size={14}/></button>
          </div>)}
        </section>
        {selected&&<aside className="project-editor-property"><header><strong>{selected.code} 산출물·계획</strong><small>{selected.name}</small></header><div>
          <div className="duration-quick" aria-label="소요일 빠른 선택"><span>{selected.kind==="summary"?"하위 Task 일정 자동 집계":"소요일 빠른 선택"}</span><div>{[1,2,3,5,8,10].map(day=><button key={day} disabled={selected.kind==="summary"} className={selected.duration===day?"active":""} onClick={()=>update(selectedIndex,"duration",day)}>{day}일</button>)}</div><small>{selected.kind==="summary"?"그룹의 시작·종료일은 하위 실행 Task를 기준으로 계산합니다.":"시작일을 포함한 달력일 기준"}</small></div>
          <div className="project-date-fields">
            <label><span>계획 시작일</span><input type="date" disabled={selected.kind==="summary"||Boolean(selected.predecessorKey)} value={selected.startDate} onChange={e=>update(selectedIndex,"startDate",e.target.value)}/></label>
            <label><span>소요일</span><div className="duration-field"><input type="number" min="1" disabled={selected.kind==="summary"} value={selected.duration} onChange={e=>update(selectedIndex,"duration",Number(e.target.value))}/><b>일</b></div></label>
            <label><span>계획 종료일</span><input type="date" disabled={selected.kind==="summary"} value={selected.endDate} min={selected.startDate} onChange={e=>update(selectedIndex,"endDate",e.target.value)}/></label>
          </div>
          <div className="project-responsibility-fields"><label><span>담당 ROLE</span><select disabled={selected.kind==="summary"} value={selected.roleCode} onChange={e=>update(selectedIndex,"roleCode",e.target.value)}><option value="">미지정</option>{roles.map(role=><option key={role.code} value={role.code}>{roleLabel(role)}</option>)}</select></label><label><span>담당자</span><select disabled={selected.kind==="summary"} value={selected.assigneeUserId} onChange={e=>{const member=members.find(item=>item.userId===e.target.value);setRows(current=>normalizeProjectWbsRows(current.map((row,index)=>index===selectedIndex?{...row,assigneeUserId:e.target.value,assigneeName:member?.name||""}:row)));markChanged()}}><option value="">미배정</option>{members.map(member=><option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label></div>
          <section className="project-deliverables-tab open">
            <div className="project-deliverables-tab-heading">
              <span><FileText size={15}/><strong>산출물</strong><b>{rowDeliverableCount(selectedIndex)}</b></span>
            </div>
            <div className="project-deliverables-tab-panel">
              {selected.kind==="summary"?<div className="group-deliverable-notice"><Layers3 size={18}/><span><strong>그룹 WBS는 산출물을 직접 등록하지 않습니다.</strong><small>하위 실행 Task의 산출물 {rowDeliverableCount(selectedIndex)}건을 자동 집계합니다.</small></span></div>:<><div className="deliverable-title"><span>산출물 설정</span><button type="button" onClick={addDeliverable}><Plus size={13}/> 산출물 추가</button></div>
              <div className="deliverable-head"><span>1레벨</span><span>2레벨</span><span>필수 여부</span><span>산출물명</span><span>삭제</span></div>
              {selected.deliverables.length===0?<p>등록된 산출물이 없습니다. 필요한 산출물을 추가하세요.</p>:selected.deliverables.map((deliverable,index)=><div className="deliverable-row" key={index}>
                <DocumentCategoryPicker categories={documentCategories} value={deliverable.type} onChange={value=>updateProjectDeliverable(index,"type",value)} label="프로젝트 산출물 카테고리"/>
                <select aria-label="산출물 필수 여부" value={deliverable.required?"required":"optional"} onChange={e=>updateProjectDeliverable(index,"required",e.target.value==="required")}><option value="required">필수</option><option value="optional">선택</option></select>
                <input aria-label="산출물명" value={deliverable.name} placeholder="산출물명" onChange={e=>updateProjectDeliverable(index,"name",e.target.value)}/>
                <button type="button" className="remove-deliverable" onClick={()=>removeProjectDeliverable(index)} aria-label="산출물 삭제"><Trash2 size={14}/></button>
              </div>)}
              <small>카테고리는 회사 표준값에서 선택합니다. AI 자동 분류·신규 카테고리 제안은 고도화 단계에서 연결합니다.</small></>}
            </div>
          </section>
        </div></aside>}
      </div>
      <footer className="project-editor-footer"><span className={saveError?"error":saveState==="saved"?"success":""}>{saveError|| (saveState==="saving"?"WBS와 산출물을 저장하고 있습니다.":saveState==="saved"?"저장 완료 · DB에서 다시 확인했습니다.":dirty?"저장하지 않은 변경사항이 있습니다.":"현재 WBS가 저장된 상태입니다.")}</span><button onClick={()=>void save()} disabled={!dirty||saveState==="saving"}><Check size={15}/> {saveState==="saving"?"저장 중":"변경사항 저장"}</button></footer>
      {saveState==="saved"&&<div className="project-save-toast"><CircleCheck size={17}/><span><strong>WBS 저장 완료</strong>저장된 데이터를 다시 불러와 확인했습니다.</span></div>}
    </section>
  </div>
}

function ProjectListWorkspace({onCreate,onOpenWbs,onOpenDashboard}:{onCreate:()=>void;onOpenWbs:(project:ProjectRecord)=>void;onOpenDashboard:(project:ProjectRecord)=>void}) {
  const [items,setItems]=useState<ProjectRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("전체");
  type ProjectFilters={logic:"AND"|"OR";types:string[];pms:string[];assignees:string[];customers:string[];health:string[];attention:string[];period:string};
  const emptyProjectFilters:ProjectFilters={logic:"AND",types:[],pms:[],assignees:[],customers:[],health:[],attention:[],period:"전체 기간"};
  const [filters,setFilters]=useState<ProjectFilters>(emptyProjectFilters);
  const [draftProjectFilters,setDraftProjectFilters]=useState<ProjectFilters>(emptyProjectFilters);
  const [projectFilterOpen,setProjectFilterOpen]=useState(false);
  const [projectPeopleSearch,setProjectPeopleSearch]=useState("");
  const [projectCustomerSearch,setProjectCustomerSearch]=useState("");
  useEffect(()=>{fetch("/api/projects",{cache:"no-store"}).then(r=>r.json()).then((data:{projects?:ProjectRecord[]})=>setItems(data.projects??[])).finally(()=>setLoading(false));},[]);
  const sample:ProjectRecord[]=[
    {id:"sample-a",code:"PMS-2026-001",name:"A사 AI PMS 구축",customerName:"A사",startDate:"2026-07-01",endDate:"2026-09-18",status:"active",templateName:"PMS 표준 구축",templateVersion:"v2.3",memberCount:4},
    {id:"sample-b",code:"FPLM-2026-003",name:"패션 PLM 고도화",customerName:"B사",startDate:"2026-06-15",endDate:"2026-10-30",status:"active",templateName:"패션 PLM 구축",templateVersion:"v1.4",memberCount:6},
    {id:"sample-c",code:"AI-2026-004",name:"사내 AI 전환",customerName:"J SOLUTION",startDate:"2026-08-01",endDate:"2026-12-15",status:"preparing",templateName:"빈 프로젝트",templateVersion:"v1.0",memberCount:3},
  ];
  const source=items.length?items:sample;
  const projectMeta=(project:ProjectRecord,index:number)=>({
    type:(project.templateName||"").includes("패션")?"PLM":project.customerName==="J SOLUTION"?"내부 프로젝트":"PMS",
    pm:index%3===0?"Dean Kim":index%3===1?"박지연":"김서준",
    health:index%3===0?"주의":index%3===1?"양호":"관찰",
    attention:index%3===0?["지연 Task","열린 이슈"]:index%3===1?["열린 이슈"]:["지연 Task","산출물 미등록"],
  });
  const visible=source.filter((project,index)=>{
    const q=search.trim().toLowerCase();
    const state=status==="전체"||status==="진행"&&project.status==="active"||status==="준비"&&project.status==="preparing"||status==="완료"&&project.status==="completed";
    const meta=projectMeta(project,index);
    const assignees=index%2===0?["Dean Kim","이도현"]:["박지연","김서준"];
    const today=new Date("2026-08-06T00:00:00Z");
    const end=new Date(`${project.endDate}T00:00:00Z`);
    const days=(end.getTime()-today.getTime())/86400000;
    const periodMatch=filters.period==="전체 기간"||(filters.period==="이번 달 종료"&&days>=0&&days<=31)||(filters.period==="3개월 내 종료"&&days>=0&&days<=92)||(filters.period==="종료일 경과"&&days<0);
    const tests=[!filters.types.length||filters.types.includes(meta.type),!filters.pms.length||filters.pms.includes(meta.pm),!filters.assignees.length||filters.assignees.some(value=>assignees.includes(value)),!filters.customers.length||filters.customers.includes(project.customerName||"내부 프로젝트"),!filters.health.length||filters.health.includes(meta.health),!filters.attention.length||filters.attention.some(value=>meta.attention.includes(value)),periodMatch];
    const active=[filters.types.length>0,filters.pms.length>0,filters.assignees.length>0,filters.customers.length>0,filters.health.length>0,filters.attention.length>0,filters.period!=="전체 기간"];
    const relevant=tests.filter((_,filterIndex)=>active[filterIndex]);
    const advancedMatch=!relevant.length||(filters.logic==="AND"?relevant.every(Boolean):relevant.some(Boolean));
    return state&&advancedMatch&&(!q||`${project.name} ${project.code} ${project.customerName??""}`.toLowerCase().includes(q));
  });
  const activeProjectFilterCount=filters.types.length+filters.pms.length+filters.assignees.length+filters.customers.length+filters.health.length+filters.attention.length+(filters.period==="전체 기간"?0:1);
  const toggleProjectDraft=(key:"types"|"pms"|"assignees"|"customers"|"health"|"attention",value:string)=>setDraftProjectFilters(current=>({...current,[key]:current[key].includes(value)?current[key].filter(item=>item!==value):[...current[key],value]}));
  const openProjectFilters=()=>{setDraftProjectFilters({...filters,types:[...filters.types],pms:[...filters.pms],assignees:[...filters.assignees],customers:[...filters.customers],health:[...filters.health],attention:[...filters.attention]});setProjectPeopleSearch("");setProjectCustomerSearch("");setProjectFilterOpen(true)};
  const statusLabel=(value:string)=>value==="active"?"진행":value==="completed"?"완료":"준비";
  return <div className="content project-list-content">
    <section className="project-list-heading module-compact-heading"><div><p className="eyebrow"><Target size={15}/> 프로젝트 목록</p></div><button className="new-work" onClick={onCreate}><Plus size={17}/> 새 프로젝트</button></section>
    <section className="panel project-list-panel">
      <div className="project-list-toolbar"><div className="work-tabs">{["전체","진행","준비","완료"].map(item=><button key={item} className={status===item?"active":""} onClick={()=>setStatus(item)}>{item}</button>)}</div><label className="work-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="프로젝트명, 코드, 고객사 검색"/></label><button className={`filter-button project-filter-button ${activeProjectFilterCount?"has-filter":""}`} onClick={openProjectFilters}><ListFilter size={15}/> 필터 {activeProjectFilterCount>0&&<b>{activeProjectFilterCount}</b>}</button></div>
      {activeProjectFilterCount>0&&<div className="project-applied-filters"><span>{filters.logic}</span>{filters.types.map(value=><em key={value}>유형 · {value}</em>)}{filters.pms.map(value=><em key={value}>PM · {value}</em>)}{filters.assignees.map(value=><em key={value}>담당 · {value}</em>)}{filters.customers.map(value=><em key={value}>고객사 · {value}</em>)}{filters.health.map(value=><em key={value}>건강도 · {value}</em>)}{filters.attention.map(value=><em key={value}>{value}</em>)}{filters.period!=="전체 기간"&&<em>{filters.period}</em>}<button onClick={()=>setFilters(emptyProjectFilters)}>전체 초기화 <X size={12}/></button></div>}
      <div className="project-list-head"><span>프로젝트</span><span>기간</span><span>PM / 인원</span><span>기준</span><span>상태</span><span>바로가기</span></div>
      <div className="project-list-rows">{loading&&!items.length?<div className="project-loading">프로젝트를 불러오는 중입니다.</div>:visible.map((project,index)=><article key={project.id}>
        <div className="project-row-primary">
        <button className="project-list-name" onClick={()=>onOpenDashboard(project)}><i>{project.code}</i><strong>{project.name}</strong><small>{project.customerName||"내부 프로젝트"} · 최근 수정 {index===0?"오늘 09:42":"8월 5일"}</small></button>
        <span className="project-period"><b>{project.startDate.replaceAll("-",".")}</b><small>~ {project.endDate.replaceAll("-",".")}</small></span>
        <span className="project-owner"><b>DK</b><span>Dean Kim<small>{Number(project.memberCount)||1}명 참여</small></span></span>
        <span className="project-template"><b>{project.templateName||"빈 프로젝트"}</b><small>{project.templateVersion||"직접 구성"}</small></span>
        <em className={`project-list-status ${project.status}`}>{statusLabel(project.status)}</em>
        <span className="project-row-actions"><button onClick={()=>onOpenDashboard(project)}>개요</button><button className="primary" onClick={()=>onOpenWbs(project)}>WBS 열기 <ArrowRight size={14}/></button></span>
        </div>
        <div className="project-health-line"><span><b>진척률</b><strong>{[68,81,43][index%3]}%</strong></span><i/><span><b>건강도</b><strong className={index===0?"warn":index===1?"ok":"watch"}>{[68,88,74][index%3]}점 · {index===0?"주의":index===1?"양호":"관찰"}</strong></span><i/><span><b>지연 Task</b><strong className={index===0?"danger-text":""}>{[3,0,1][index%3]}건</strong></span><i/><span><b>열린 이슈</b><strong>{[2,1,2][index%3]}건</strong></span><i/><span><b>산출물</b><strong>{["18 / 24","31 / 36","9 / 16"][index%3]}</strong></span></div>
      </article>)}</div>
      {!visible.length&&!loading&&<div className="empty-work"><FolderOpen size={30}/><strong>조건에 맞는 프로젝트가 없습니다.</strong><p>검색어나 상태를 변경해 보세요.</p></div>}
    </section>
    {projectFilterOpen&&<div className="filter-overlay" onClick={()=>setProjectFilterOpen(false)}><aside className="advanced-filter project-advanced-filter" onClick={event=>event.stopPropagation()}>
      <header className="filter-head compact-filter-head"><div><span>PROJECT FILTER</span><strong>프로젝트 상세 필터</strong><p>필요한 프로젝트만 빠르게 찾아보세요.</p></div><div className="compact-filter-actions"><div className="compact-filter-logic" aria-label="조건 결합 방식"><small>조건 결합</small><button title="모든 조건 만족" className={draftProjectFilters.logic==="AND"?"active":""} onClick={()=>setDraftProjectFilters(current=>({...current,logic:"AND"}))}>AND</button><button title="하나 이상 만족" className={draftProjectFilters.logic==="OR"?"active":""} onClick={()=>setDraftProjectFilters(current=>({...current,logic:"OR"}))}>OR</button></div><button className="compact-filter-close" onClick={()=>setProjectFilterOpen(false)} aria-label="필터 닫기"><X size={20}/></button></div></header>
      <section className="filter-section"><div className="filter-section-title"><strong>프로젝트 유형</strong><span>복수 선택</span></div><div className="filter-chip-grid">{["PMS","PLM","AI 전환","내부 프로젝트"].map(value=><button key={value} className={draftProjectFilters.types.includes(value)?"active":""} onClick={()=>toggleProjectDraft("types",value)}>{value}{draftProjectFilters.types.includes(value)&&<Check size={13}/>}</button>)}</div></section>
      <section className="filter-section"><div className="filter-section-title"><strong>PM · 담당자</strong><span>검색 후 복수 선택</span></div><label className="filter-search"><Search size={15}/><input value={projectPeopleSearch} onChange={event=>setProjectPeopleSearch(event.target.value)} placeholder="이름 검색"/></label><div className="people-filter-columns"><div><small>PM</small>{["Dean Kim","박지연","김서준","이도현"].filter(value=>!projectPeopleSearch||value.toLowerCase().includes(projectPeopleSearch.toLowerCase())).map(value=><button key={value} className={draftProjectFilters.pms.includes(value)?"active":""} onClick={()=>toggleProjectDraft("pms",value)}>{value}{draftProjectFilters.pms.includes(value)&&<Check size={13}/>}</button>)}</div><div><small>담당자</small>{["Dean Kim","박지연","김서준","이도현"].filter(value=>!projectPeopleSearch||value.toLowerCase().includes(projectPeopleSearch.toLowerCase())).map(value=><button key={value} className={draftProjectFilters.assignees.includes(value)?"active":""} onClick={()=>toggleProjectDraft("assignees",value)}>{value}{draftProjectFilters.assignees.includes(value)&&<Check size={13}/>}</button>)}</div></div></section>
      <section className="filter-section"><div className="filter-section-title"><strong>고객사</strong><span>검색 후 복수 선택</span></div><label className="filter-search"><Search size={15}/><input value={projectCustomerSearch} onChange={event=>setProjectCustomerSearch(event.target.value)} placeholder="고객사 검색"/></label><div className="filter-chip-grid">{Array.from(new Set(source.map(project=>project.customerName||"내부 프로젝트"))).filter(value=>!projectCustomerSearch||value.toLowerCase().includes(projectCustomerSearch.toLowerCase())).map(value=><button key={value} className={draftProjectFilters.customers.includes(value)?"active":""} onClick={()=>toggleProjectDraft("customers",value)}>{value}{draftProjectFilters.customers.includes(value)&&<Check size={13}/>}</button>)}</div></section>
      <section className="filter-section"><div className="filter-section-title"><strong>프로젝트 건강도</strong><span>상태 기준</span></div><div className="filter-chip-grid">{["양호","관찰","주의","위험"].map(value=><button key={value} className={draftProjectFilters.health.includes(value)?"active":""} onClick={()=>toggleProjectDraft("health",value)}>{value}{draftProjectFilters.health.includes(value)&&<Check size={13}/>}</button>)}</div></section>
      <section className="filter-section"><div className="filter-section-title"><strong>확인 필요</strong><span>업무 현황 기준</span></div><div className="filter-chip-grid">{["지연 Task","열린 이슈","산출물 미등록","실적 미입력"].map(value=><button key={value} className={draftProjectFilters.attention.includes(value)?"active":""} onClick={()=>toggleProjectDraft("attention",value)}>{value}{draftProjectFilters.attention.includes(value)&&<Check size={13}/>}</button>)}</div></section>
      <section className="filter-section"><div className="filter-section-title"><strong>프로젝트 기간</strong><span>종료일 기준</span></div><div className="filter-chip-grid">{["전체 기간","이번 달 종료","3개월 내 종료","종료일 경과"].map(value=><button key={value} className={draftProjectFilters.period===value?"active":""} onClick={()=>setDraftProjectFilters(current=>({...current,period:value}))}>{value}{draftProjectFilters.period===value&&<Check size={13}/>}</button>)}</div></section>
      <div className="filter-preview"><ListFilter size={15}/><span>선택 조건</span><strong>{draftProjectFilters.types.length+draftProjectFilters.pms.length+draftProjectFilters.assignees.length+draftProjectFilters.customers.length+draftProjectFilters.health.length+draftProjectFilters.attention.length+(draftProjectFilters.period==="전체 기간"?0:1)}개</strong></div>
      <footer className="filter-actions"><button onClick={()=>setDraftProjectFilters(emptyProjectFilters)}>초기화</button><button className="apply" onClick={()=>{setFilters(draftProjectFilters);setProjectFilterOpen(false)}}>필터 적용</button></footer>
    </aside></div>}
  </div>;
}

function AdminWorkspace({tab,projectStep,setProjectStep,createdProject,setCreatedProject,onProjectCreated,onOpenProjects,onOpenWbs,onOpenTemplateEditor,onCloseTemplateEditor,editorTabActive}:{tab:AdminTab;projectStep:number;setProjectStep:(step:number)=>void;createdProject:boolean;setCreatedProject:(created:boolean)=>void;onProjectCreated:(project:ProjectRecord)=>void;onOpenProjects:()=>void;onOpenWbs:()=>void;onOpenTemplateEditor:(label:string)=>void;onCloseTemplateEditor:()=>void;editorTabActive:boolean}) {
  const [projectForm,setProjectForm] = useState({name:"A사 AI PMS 본개발",code:"",customerName:"A사",projectType:"",startDate:"2026-08-10",endDate:"2026-11-27",description:""});
  const [creationMode,setCreationMode] = useState<"template"|"copy"|"blank">("template");
  const [sourceProjects,setSourceProjects] = useState<ProjectRecord[]>([]);
  const [selectedSourceProjectId,setSelectedSourceProjectId] = useState("");
  const [copyAssignees,setCopyAssignees] = useState(false);
  const [copyPanelOpen,setCopyPanelOpen] = useState(false);
  const [copyProjectSearch,setCopyProjectSearch] = useState("");
  const [copyProjectStatus,setCopyProjectStatus] = useState("전체");
  const [copyProjectSort,setCopyProjectSort] = useState("recent");
  const [draftSourceProjectId,setDraftSourceProjectId] = useState("");
  const [draftCopyAssignees,setDraftCopyAssignees] = useState(false);
  const [createState,setCreateState] = useState<"idle"|"saving"|"error">("idle");
  const [createError,setCreateError] = useState("");
  const [templates,setTemplates] = useState<ProjectTemplate[]>(()=>projectTemplateCache??[]);
  const [selectedTemplateId,setSelectedTemplateId] = useState("");
  const [templatePanelOpen,setTemplatePanelOpen] = useState(false);
  const [templateSearch,setTemplateSearch] = useState("");
  const [draftTemplateId,setDraftTemplateId] = useState("");
  const [templateEditor,setTemplateEditor] = useState<"create"|"edit"|null>(null);
  const [projectCodeLoading,setProjectCodeLoading] = useState(false);
  useEffect(()=>{
    if(tab!=="project")return;
    fetch("/api/projects",{cache:"no-store"})
      .then(response=>response.ok?response.json():Promise.reject())
      .then((result:{projects?:ProjectRecord[]})=>setSourceProjects(result.projects||[]))
      .catch(()=>setSourceProjects([]));
  },[tab]);
  useEffect(()=>{
    if(tab!=="project"||projectForm.code)return;
    // This request is triggered only when the project-creation tab becomes active.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectCodeLoading(true);
    fetch("/api/projects?action=next-code",{cache:"no-store"})
      .then(async response=>{
        if(!response.ok)throw new Error("프로젝트 코드를 생성하지 못했습니다.");
        return response.json() as Promise<{code?:string}>;
      })
      .then(result=>{if(result.code)setProjectForm(current=>current.code?current:{...current,code:result.code!});})
      .catch(()=>setCreateError("프로젝트 코드 자동채번에 실패했습니다. 잠시 후 다시 시도해 주세요."))
      .finally(()=>setProjectCodeLoading(false));
  },[tab,projectForm.code]);
  const [templatePersisted,setTemplatePersisted] = useState(false);
  const [templateState,setTemplateState] = useState<"idle"|"saving"|"error">("idle");
  const [templateError,setTemplateError] = useState("");
  const emptyWbs:TemplateWbs = {id:"1",level:1,kind:"task",name:"",durationDays:5,role:"PM",taskType:"normal",deliverableRequired:false,deliverables:[],completionActor:"assignee",completionCriteria:""};
  const [templateForm,setTemplateForm] = useState({id:"",code:"",name:"",version:"v1.0",status:"draft" as ProjectTemplate["status"],description:"",roles:["PM","PL","CONSULTANT","DEV","QA"],wbs:[emptyWbs]});
  const [projectRoles,setProjectRoles] = useState<ProjectRole[]>([
    {id:"r1",group:"프로젝트 관리",code:"PM",name:"프로젝트 관리자",description:"프로젝트 총괄, 일정·인력·성과 관리",required:true,multiple:false,gateApprover:true,enabled:true},
    {id:"r2",group:"프로젝트 관리",code:"PL",name:"프로젝트 리더",description:"프로젝트 실무 수행과 업무 리딩",required:true,multiple:false,gateApprover:true,enabled:true},
    {id:"r3",group:"프로젝트 관리",code:"PO",name:"프로젝트 책임자",description:"주요 의사결정과 최종 책임",required:false,multiple:false,gateApprover:true,enabled:true},
    {id:"r4",group:"프로젝트 관리",code:"PMO",name:"프로젝트 관리 지원",description:"일정·회의·보고·진척 관리 지원",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r5",group:"사업·영업",code:"BP",name:"사업기획 담당",description:"사업 전략과 실행 계획 수립",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r6",group:"사업·영업",code:"SALES",name:"영업 담당",description:"영업 활동과 계약 협의",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r7",group:"사업·영업",code:"PROPOSAL",name:"제안 담당",description:"제안서와 수행 방안 작성",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r8",group:"사업·영업",code:"AM",name:"고객 담당",description:"고객 소통과 관계 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r9",group:"기획·분석",code:"PP",name:"제품기획 담당",description:"제품 방향과 요구사항 기획",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r10",group:"기획·분석",code:"BA",name:"업무기획 담당",description:"업무 분석과 기능 정의",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r11",group:"기획·분석",code:"RA",name:"요구사항 담당",description:"요구사항 수집·정의·추적",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r12",group:"기획·분석",code:"PA",name:"프로세스 담당",description:"현재·목표 프로세스 설계",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r13",group:"연구·개발",code:"R&D",name:"연구개발 담당",description:"연구개발 과제 수행",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r14",group:"연구·개발",code:"DL",name:"개발 리더",description:"개발 범위와 수행 방향 관리",required:false,multiple:false,gateApprover:false,enabled:true},
    {id:"r15",group:"연구·개발",code:"DEV",name:"개발 담당",description:"기능 개발과 수정",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r16",group:"연구·개발",code:"SW",name:"소프트웨어 담당",description:"소프트웨어 설계와 개발",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r17",group:"연구·개발",code:"FW",name:"펌웨어 담당",description:"펌웨어 설계와 개발",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r18",group:"연구·개발",code:"HW",name:"하드웨어 담당",description:"하드웨어 개발과 검토",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r19",group:"설계·기술",code:"EL",name:"설계 리더",description:"설계 범위와 기술 방향 관리",required:false,multiple:false,gateApprover:false,enabled:true},
    {id:"r20",group:"설계·기술",code:"ME",name:"기구설계 담당",description:"기구 구조와 부품 설계",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r21",group:"설계·기술",code:"EE",name:"전장설계 담당",description:"전장 시스템과 배선 설계",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r22",group:"설계·기술",code:"CE",name:"회로설계 담당",description:"전자 회로 설계와 검토",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r23",group:"설계·기술",code:"PD",name:"제품설계 담당",description:"제품 구조와 사양 설계",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r24",group:"설계·기술",code:"MD",name:"금형설계 담당",description:"금형 구조와 제작 사양 설계",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r25",group:"설계·기술",code:"PE",name:"공정설계 담당",description:"제조 공정과 작업 기준 설계",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r26",group:"구매·자재",code:"PUR",name:"구매 담당",description:"구매 계획과 발주 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r27",group:"구매·자재",code:"SUB",name:"외주구매 담당",description:"외주 품목 구매와 납기 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r28",group:"구매·자재",code:"MAT",name:"자재 담당",description:"자재 수급과 재고 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r29",group:"구매·자재",code:"SCM",name:"협력사 담당",description:"협력사 발굴과 공급망 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r30",group:"구매·자재",code:"COST",name:"원가 담당",description:"제품·프로젝트 원가 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r31",group:"생산·제조",code:"PROD",name:"생산관리 담당",description:"생산 일정과 실적 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r32",group:"생산·제조",code:"MFG",name:"제조기술 담당",description:"제조 기술과 생산성 개선",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r33",group:"생산·제조",code:"PROC",name:"공정 담당",description:"공정 운영과 개선 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r34",group:"생산·제조",code:"PPC",name:"생산계획 담당",description:"생산계획과 자원 배정",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r35",group:"생산·제조",code:"EQ",name:"설비 담당",description:"생산 설비 운영과 보전",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r36",group:"품질·검증",code:"QC",name:"품질관리 담당",description:"검사와 품질 현황 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r37",group:"품질·검증",code:"QA",name:"품질보증 담당",description:"품질 체계와 보증 활동 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r38",group:"품질·검증",code:"TEST",name:"시험 담당",description:"시험 계획과 수행",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r39",group:"품질·검증",code:"V&V",name:"검증 담당",description:"요구사항 충족 여부 검증",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r40",group:"품질·검증",code:"CERT",name:"인증 담당",description:"제품 인증과 규제 대응",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r41",group:"구축·운영",code:"SI",name:"시스템 구축 담당",description:"시스템 구축과 적용",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r42",group:"구축·운영",code:"DATA",name:"데이터 담당",description:"데이터 정제·이관·검증",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r43",group:"구축·운영",code:"IF",name:"시스템 연계 담당",description:"외부 시스템 연계",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r44",group:"구축·운영",code:"INFRA",name:"인프라 담당",description:"서버·DB·배포 환경 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r45",group:"구축·운영",code:"OPS",name:"시스템 운영 담당",description:"시스템 운영과 모니터링",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r46",group:"서비스·지원",code:"SERVICE",name:"서비스 담당",description:"고객 서비스 업무 수행",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r47",group:"서비스·지원",code:"SUPPORT",name:"기술지원 담당",description:"장애·문의 기술지원",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r48",group:"서비스·지원",code:"MA",name:"유지보수 담당",description:"유지보수와 개선 요청 대응",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r49",group:"서비스·지원",code:"TRAINER",name:"교육 담당",description:"사용자 교육과 매뉴얼 관리",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r50",group:"고객·협력사",code:"C-PM",name:"고객 프로젝트 관리자",description:"고객사 측 프로젝트 총괄",required:false,multiple:false,gateApprover:true,enabled:true},
    {id:"r51",group:"고객·협력사",code:"C-USER",name:"고객 업무 담당",description:"고객 요구사항 협의와 검증",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r52",group:"고객·협력사",code:"PARTNER",name:"협력사 담당",description:"외부 협력 업무 수행",required:false,multiple:true,gateApprover:false,enabled:true},
    {id:"r53",group:"고객·협력사",code:"EXPERT",name:"외부 전문가",description:"전문 분야 자문과 검토",required:false,multiple:true,gateApprover:false,enabled:true},
  ]);
  const [selectedTemplateWbs,setSelectedTemplateWbs] = useState(0);
  const templateNameInputs = useRef<Array<HTMLInputElement|null>>([]);
  const templateDurationInputs = useRef<Array<HTMLInputElement|null>>([]);
  const [pendingTemplateNameFocus,setPendingTemplateNameFocus] = useState<number|null>(null);
  const [templateTaskFilter,setTemplateTaskFilter] = useState<"all"|"normal"|"gate"|"summary">("all");
  const [showRoleManager,setShowRoleManager] = useState(false);
  const [showCategoryManager,setShowCategoryManager] = useState(false);
  const [showProjectTypeManager,setShowProjectTypeManager] = useState(false);
  const [showPartnerManager,setShowPartnerManager] = useState(false);
  const [showPartnerTypeManager,setShowPartnerTypeManager] = useState(false);
  const [projectTypes,setProjectTypes] = useProjectTypes();
  const [partnerTypes,setPartnerTypes] = useLocalMaster<PartnerType>(PARTNER_TYPE_STORAGE_KEY,PARTNER_TYPE_EVENT,defaultPartnerTypes);
  const [partners,setPartners] = useLocalMaster<Partner>(PARTNER_STORAGE_KEY,PARTNER_EVENT,defaultPartners);
  const [selectedPartnerId,setSelectedPartnerId] = useState(defaultPartners[0].id);
  const [documentCategories,setDocumentCategories] = useDocumentCategories();
  const [selectedCategoryId,setSelectedCategoryId] = useState(defaultDocumentCategories[0].id);
  const [templateBaseline,setTemplateBaseline] = useState("");
  const [draftRestored,setDraftRestored] = useState(false);
  const selectedTemplate = templates.find(item=>item.id===selectedTemplateId);
  const deliverableCategories = documentCategories.flatMap(level1=>level1.enabled?level1.children.filter(level2=>level2.enabled).map(level2=>`${level1.name} > ${level2.name}`):[]);
  const selectedDocumentCategory=documentCategories.find(category=>category.id===selectedCategoryId)??documentCategories[0];
  function updateDocumentCategory(level1Id:string,key:"name"|"enabled",value:string|boolean){setDocumentCategories(current=>current.map(category=>category.id===level1Id?{...category,[key]:value}:category));}
  function updateDocumentSubcategory(level1Id:string,level2Id:string,key:"name"|"enabled",value:string|boolean){setDocumentCategories(current=>current.map(category=>category.id===level1Id?{...category,children:category.children.map(child=>child.id===level2Id?{...child,[key]:value}:child)}:category));}
  function addDocumentCategory(){const id=crypto.randomUUID();setDocumentCategories(current=>[...current,{id,code:`CAT-${String(current.length+1).padStart(2,"0")}`,name:"새 1레벨 분류",enabled:true,children:[]}]);setSelectedCategoryId(id);}
  function addDocumentSubcategory(){if(!selectedDocumentCategory)return;const id=crypto.randomUUID();setDocumentCategories(current=>current.map(category=>category.id===selectedDocumentCategory.id?{...category,children:[...category.children,{id,code:`${category.code}-${String(category.children.length+1).padStart(2,"0")}`,name:"새 2레벨 분류",enabled:true}]}:category));}
  function deleteDocumentCategory(level1Id:string){
    const target=documentCategories.find(category=>category.id===level1Id);if(!target)return;
    if(!window.confirm(`'${target.name}' 1레벨과 하위 ${target.children.length}개 분류를 삭제할까요?\n기존 문서에서 사용 중이라면 삭제 대신 미사용 처리를 권장합니다.`))return;
    const next=documentCategories.filter(category=>category.id!==level1Id);setDocumentCategories(next);setSelectedCategoryId(next[0]?.id||"");
  }
  function deleteDocumentSubcategory(level1Id:string,level2Id:string){
    const level1=documentCategories.find(category=>category.id===level1Id);const target=level1?.children.find(child=>child.id===level2Id);if(!level1||!target)return;
    if(!window.confirm(`'${level1.name} > ${target.name}' 분류를 삭제할까요?\n기존 문서에서 사용 중이라면 삭제 대신 미사용 처리를 권장합니다.`))return;
    setDocumentCategories(current=>current.map(category=>category.id===level1Id?{...category,children:category.children.filter(child=>child.id!==level2Id)}:category));
  }
  const normalizeWbsKinds = (rows:TemplateWbs[]) => rows.map((row,index) => {
    const hasChild = Boolean(rows[index+1] && rows[index+1].level > row.level);
    return {
      ...row,
      kind:hasChild?"summary" as const:"task" as const,
      durationDays:hasChild?0:row.durationDays,
      taskType:hasChild?"normal" as const:row.taskType,
      deliverableRequired:hasChild?false:row.deliverableRequired,
      deliverable:hasChild?undefined:row.deliverable,
      deliverables:hasChild?[]:row.deliverables,
    };
  });

  async function loadTemplates(force=false) {
    try {
      const rawTemplates=await requestProjectTemplates(force);
      const next = rawTemplates.map(template=>({...template,definition:{...template.definition,wbs:normalizeWbsKinds(template.definition.wbs.map((row,index)=>({...emptyWbs,...row,level:row.level||1,taskType:row.taskType||"normal",deliverableRequired:row.deliverableRequired??Boolean(row.deliverable),deliverables:row.deliverables?.length?row.deliverables.map(output=>({...output,required:output.required??row.deliverableRequired??true})):row.deliverable?[{name:row.deliverable,type:"문서",required:true}]:[],completionActor:row.completionActor||"assignee",id:row.id||String(index+1)})))}}));
      setTemplates(next);
      setSelectedTemplateId(current=>current || next[0]?.id || "");
    } catch { setTemplateError("템플릿 목록을 불러오지 못했습니다."); }
  }
  // The first load synchronizes this client workspace with the durable template store.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{ void loadTemplates(Boolean(projectTemplateCache)); },[]);

  function openTemplateEditor(template?:ProjectTemplate,newVersion=false) {
    let nextForm:typeof templateForm;
    if (!template) {
      nextForm={id:"",code:`TPL-${String(templates.length+1).padStart(3,"0")}`,name:"",version:"v1.0",status:"draft",description:"",roles:["PROJECT_PM","CONSULTANT","DEV_LEAD","QA"],wbs:[{...emptyWbs}]};
      setTemplateEditor("create");
    } else {
      const parts = template.version.replace(/^v/,"").split(".");
      const version = newVersion ? `v${parts[0]}.${Number(parts[1]||0)+1}` : template.version;
      nextForm={id:template.id,code:template.code,name:template.name,version,status:template.status,description:template.definition.description||"",roles:[...template.definition.roles],wbs:template.definition.wbs.map(item=>({...item}))};
      setTemplateEditor("edit");
    }
    const draftKey=`pms-template-draft:${nextForm.code}:${nextForm.version}`;
    const savedDraft=typeof window!=="undefined"?window.localStorage.getItem(draftKey):null;
    if(savedDraft){try{nextForm=JSON.parse(savedDraft) as typeof templateForm;setDraftRestored(true);}catch{setDraftRestored(false);}}else setDraftRestored(false);
    setTemplateForm(nextForm);
    setTemplatePersisted(false);
    setTemplateBaseline(JSON.stringify(nextForm));
    setSelectedTemplateWbs(0);
    setTemplateError("");
    onOpenTemplateEditor(template?`템플릿 편집 · ${template.name}`:"새 템플릿 편집");
  }
  const templateDirty=Boolean(templateEditor)&&JSON.stringify(templateForm)!==templateBaseline;
  function closeTemplateEditor(force=false){
    if(!force&&templateDirty&&!window.confirm("저장하지 않은 변경사항이 있습니다. 임시저장본은 유지됩니다. 편집창을 닫을까요?"))return;
    setTemplateEditor(null);
    onCloseTemplateEditor();
  }
  useEffect(()=>{
    if(!templateEditor||!templateForm.code)return;
    const key=`pms-template-draft:${templateForm.code}:${templateForm.version}`;
    window.localStorage.setItem(key,JSON.stringify(templateForm));
  },[templateEditor,templateForm]);
  useEffect(()=>{
    if(!templateEditor)return;
    const guard=(event:BeforeUnloadEvent)=>{if(templateDirty){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",guard);
    return()=>window.removeEventListener("beforeunload",guard);
  },[templateEditor,templateDirty]);
  function updateTemplateWbs(index:number,key:keyof TemplateWbs,value:TemplateWbs[keyof TemplateWbs]) {
    setTemplateForm(current=>({...current,wbs:current.wbs.map((item,i)=>i===index?{...item,[key]:value}:item)}));
  }
  function renumberWbs(rows:TemplateWbs[]) {
    const counters:number[]=[];
    return normalizeWbsKinds(rows.map(row=>{ counters[row.level-1]=(counters[row.level-1]||0)+1; counters.length=row.level; return {...row,id:counters.join(".")}; }));
  }
  function addTemplateWbs(child=false,baseIndex=selectedTemplateWbs) {
    setTemplateForm(current=>{ const base=current.wbs[baseIndex]??current.wbs[0]; const level=child?Math.min(4,(base?.level||1)+1):(base?.level||1); const insert=baseIndex+1; const row={...emptyWbs,id:"",level,parentId:child?base?.id:undefined,role:current.roles[0]||"PROJECT_PM"}; const wbs=[...current.wbs]; wbs.splice(insert,0,row); return {...current,wbs:renumberWbs(wbs)}; });
    setSelectedTemplateWbs(baseIndex+1);
  }
  useEffect(()=>{
    if(pendingTemplateNameFocus===null)return;
    const input=templateNameInputs.current[pendingTemplateNameFocus];
    if(!input)return;
    input.focus();
    input.select();
    setPendingTemplateNameFocus(null);
  },[pendingTemplateNameFocus,templateForm.wbs]);
  function focusTemplateName(index:number){
    if(index<0||index>=templateForm.wbs.length)return;
    setSelectedTemplateWbs(index);
    setPendingTemplateNameFocus(index);
  }
  function handleTemplateNameKeyDown(event:ReactKeyboardEvent<HTMLInputElement>,index:number){
    if(event.nativeEvent.isComposing)return;
    if(event.key==="Escape"){event.currentTarget.blur();return;}
    if(event.key==="ArrowUp"||event.key==="ArrowDown"){
      event.preventDefault();
      const step=event.key==="ArrowUp"?-1:1;
      const visibleIndex=visibleTemplateRows.findIndex(row=>row.index===index);
      const target=visibleTemplateRows[visibleIndex+step]?.index;
      if(target!==undefined)focusTemplateName(target);
      return;
    }
    if(event.key!=="Enter")return;
    event.preventDefault();
    if(event.ctrlKey||event.metaKey){
      addTemplateWbs(true,index);
      setPendingTemplateNameFocus(index+1);
      return;
    }
    const visibleIndex=visibleTemplateRows.findIndex(row=>row.index===index);
    const nextIndex=visibleTemplateRows[visibleIndex+(event.shiftKey?-1:1)]?.index;
    if(nextIndex!==undefined){focusTemplateName(nextIndex);return;}
    if(event.shiftKey)return;
    addTemplateWbs(false,index);
    setPendingTemplateNameFocus(index+1);
  }
  function handleTemplateDurationKeyDown(event:ReactKeyboardEvent<HTMLInputElement>,index:number){
    if(event.nativeEvent.isComposing||event.key!=="Enter")return;
    event.preventDefault();
    event.stopPropagation();
    const editableRows=visibleTemplateRows.filter(({item})=>item.kind!=="summary");
    const currentIndex=editableRows.findIndex(row=>row.index===index);
    const targetIndex=editableRows[currentIndex+(event.shiftKey?-1:1)]?.index;
    if(targetIndex===undefined){event.currentTarget.blur();return;}
    setSelectedTemplateWbs(targetIndex);
    requestAnimationFrame(()=>{
      const input=templateDurationInputs.current[targetIndex];
      input?.focus();
      input?.select();
    });
  }
  function moveWbs(direction:-1|1) { setTemplateForm(current=>{const next=selectedTemplateWbs+direction;if(next<0||next>=current.wbs.length)return current;const rows=[...current.wbs];[rows[selectedTemplateWbs],rows[next]]=[rows[next],rows[selectedTemplateWbs]];setSelectedTemplateWbs(next);return {...current,wbs:renumberWbs(rows)};}); }
  function changeWbsLevel(delta:-1|1) { setTemplateForm(current=>({...current,wbs:renumberWbs(current.wbs.map((row,i)=>i===selectedTemplateWbs?{...row,level:Math.max(1,Math.min(4,row.level+delta))}:row))})); }
  function removeTemplateWbs(targetIndex=selectedTemplateWbs) { setTemplateForm(current=>{if(current.wbs.length===1)return current;const rows=current.wbs.filter((_,i)=>i!==targetIndex);setSelectedTemplateWbs(Math.max(0,Math.min(targetIndex-1,rows.length-1)));return {...current,wbs:renumberWbs(rows)};}); }
  function addDeliverable(){if(!selectedWbsRow||selectedWbsRow.kind==="summary")return;updateTemplateWbs(selectedTemplateWbs,"deliverables",[...selectedWbsRow.deliverables,{name:"",type:deliverableCategories[0]||"기타 > 미분류",required:true}]);}
  function updateDeliverable(index:number,key:"name"|"type"|"required",value:string|boolean){if(!selectedWbsRow||selectedWbsRow.kind==="summary")return;updateTemplateWbs(selectedTemplateWbs,"deliverables",selectedWbsRow.deliverables.map((item,i)=>i===index?{...item,[key]:value}:item));}
  function removeDeliverable(index:number){if(!selectedWbsRow||selectedWbsRow.kind==="summary")return;updateTemplateWbs(selectedTemplateWbs,"deliverables",selectedWbsRow.deliverables.filter((_,i)=>i!==index));}
  function addRole() { const id=crypto.randomUUID(); setProjectRoles(current=>[...current,{id,group:"기타",code:`ROLE_${current.length+1}`,name:"새 프로젝트 역할",description:"",required:false,multiple:true,gateApprover:false,enabled:true}]); }
  function updateRole(id:string,key:keyof ProjectRole,value:string|boolean){setProjectRoles(current=>current.map(role=>role.id===id?{...role,[key]:value}:role));}
  function deleteRole(id:string){const target=projectRoles.find(role=>role.id===id);if(!target||target.code==="PM"||target.code==="PL"||templateForm.wbs.some(row=>row.role===target.code))return;setProjectRoles(current=>current.filter(role=>role.id!==id));}
  function addProjectType(){setProjectTypes(current=>[...current,{id:crypto.randomUUID(),code:`PT-${String(current.length+1).padStart(2,"0")}`,name:"새 프로젝트 유형",enabled:true,order:current.length+1}]);}
  function updateProjectType(id:string,key:"name"|"enabled",value:string|boolean){setProjectTypes(current=>current.map(type=>type.id===id?{...type,[key]:value}:type));}
  function moveProjectType(id:string,direction:-1|1){setProjectTypes(current=>{const index=current.findIndex(type=>type.id===id);const target=index+direction;if(index<0||target<0||target>=current.length)return current;const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next;});}
  function addPartnerType(){setPartnerTypes(current=>[...current,{id:crypto.randomUUID(),code:`BP-${String(current.length+1).padStart(2,"0")}`,name:"새 거래처 유형",enabled:true,order:current.length+1}]);}
  function updatePartnerType(id:string,key:"name"|"enabled",value:string|boolean){setPartnerTypes(current=>current.map((type,index)=>type.id===id?{...type,[key]:value,order:index+1}:type));}
  function movePartnerType(id:string,direction:-1|1){setPartnerTypes(current=>{const index=current.findIndex(type=>type.id===id);const target=index+direction;if(index<0||target<0||target>=current.length)return current;const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next.map((type,i)=>({...type,order:i+1}));});}
  function addPartner(){const id=crypto.randomUUID();setPartners(current=>[...current,{id,enabled:true,name:"새 거래처",code:`BP-${String(current.length+1).padStart(3,"0")}`,typeId:partnerTypes.find(type=>type.enabled)?.id||"",contactName:"",contactPhone:"",contactEmail:"",mainPhone:"",englishName:"",country:"",industry:"",representative:"",businessNumber:"",address:"",extra:"",note:""}]);setSelectedPartnerId(id);}
  function updatePartner(id:string,key:keyof Partner,value:string|boolean){setPartners(current=>current.map(partner=>partner.id===id?{...partner,[key]:value}:partner));}
  const selectedPartner=partners.find(partner=>partner.id===selectedPartnerId)??partners[0];
  const selectedWbsRow=templateForm.wbs[selectedTemplateWbs]??templateForm.wbs[0];
  const templateDuration=useMemo(()=>{
    const finishById=new Map<string,number>();
    const unresolved=[...templateForm.wbs];
    let guard=0;
    while(unresolved.length&&guard++<templateForm.wbs.length+1){
      let progressed=false;
      for(let i=unresolved.length-1;i>=0;i--){
        const row=unresolved[i];
        const predecessorFinish=row.predecessor?finishById.get(row.predecessor):0;
        if(row.predecessor&&predecessorFinish===undefined)continue;
        finishById.set(row.id,(predecessorFinish||0)+(row.kind==="summary"?0:Math.max(0,Number(row.durationDays)||0)));
        unresolved.splice(i,1);progressed=true;
      }
      if(!progressed)break;
    }
    return Math.max(0,...finishById.values());
  },[templateForm.wbs]);
  const visibleTemplateRows=templateForm.wbs.map((item,index)=>({item,index})).filter(({item})=>templateTaskFilter==="all"||(templateTaskFilter==="summary"?item.kind==="summary":item.kind==="task"&&item.taskType===templateTaskFilter));
  function rowDeliverableCount(rowIndex:number) {
    const row=templateForm.wbs[rowIndex];
    if(!row)return 0;
    if(row.kind!=="summary")return row.deliverables.length;
    let count=0;
    for(let index=rowIndex+1;index<templateForm.wbs.length;index++){
      const child=templateForm.wbs[index];
      if(child.level<=row.level)break;
      if(child.kind!=="summary")count+=child.deliverables.length;
    }
    return count;
  }
  function templateSummary(template:ProjectTemplate) {
    const rows=template.definition.wbs;
    const tasks=rows.filter(row=>row.kind!=="summary");
    const groups=rows.filter(row=>row.kind==="summary");
    const deliverables=tasks.flatMap(row=>row.deliverables||[]);
    const finishById=new Map<string,number>();
    const unresolved=[...tasks];
    let guard=0;
    while(unresolved.length&&guard++<tasks.length+1){
      let progressed=false;
      for(let index=unresolved.length-1;index>=0;index--){
        const row=unresolved[index];
        const predecessorFinish=row.predecessor?finishById.get(row.predecessor):0;
        if(row.predecessor&&predecessorFinish===undefined)continue;
        finishById.set(row.id,(predecessorFinish||0)+Math.max(0,Number(row.durationDays)||0));
        unresolved.splice(index,1);progressed=true;
      }
      if(!progressed)break;
    }
    return {
      groups:groups.length,
      tasks:tasks.length,
      gates:tasks.filter(row=>row.taskType==="gate").length,
      deliverables:deliverables.length,
      required:deliverables.filter(output=>output.required!==false).length,
      optional:deliverables.filter(output=>output.required===false).length,
      duration:Math.max(0,...finishById.values()),
    };
  }
  async function saveTemplate() {
    setTemplateState("saving"); setTemplateError("");
    try {
      const normalizedWbs=normalizeWbsKinds(templateForm.wbs);
      const firstCreate=templateEditor==="create"&&!templatePersisted;
      const mode=firstCreate?"create":templatePersisted?"update":"new-version";
      const payload = {id:templateForm.id,code:templateForm.code,name:templateForm.name,version:templateForm.version,status:templateForm.status,mode,definition:{description:templateForm.description,roles:templateForm.roles,wbs:normalizedWbs}};
      const response = await fetch("/api/templates",{method:firstCreate?"POST":"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const result = await response.json() as {error?:string;id?:string;versionId?:string};
      if(!response.ok) throw new Error(result.error||"템플릿을 저장하지 못했습니다.");
      window.localStorage.removeItem(`pms-template-draft:${templateForm.code}:${templateForm.version}`);
      const savedForm={...templateForm,id:result.id||templateForm.id,wbs:normalizedWbs};
      setTemplateForm(savedForm);
      setTemplateBaseline(JSON.stringify(savedForm));
      setTemplatePersisted(true);
      setTemplateEditor("edit");
      const savedTemplate:ProjectTemplate={
        id:savedForm.id,
        code:savedForm.code,
        name:savedForm.name,
        status:savedForm.status,
        versionId:result.versionId||templates.find(item=>item.id===savedForm.id)?.versionId||"",
        version:savedForm.version,
        updatedAt:Math.floor(Date.now()/1000),
        createdBy:templates.find(item=>item.id===savedForm.id)?.createdBy||"user-dean",
        createdByName:templates.find(item=>item.id===savedForm.id)?.createdByName||"Dean Kim",
        canDelete:true,
        definition:{description:savedForm.description,roles:savedForm.roles,wbs:normalizedWbs},
      };
      setTemplates(current=>{
        const next=current.some(item=>item.id===savedTemplate.id)?current.map(item=>item.id===savedTemplate.id?savedTemplate:item):[savedTemplate,...current];
        projectTemplateCache=next;
        return next;
      });
      setSelectedTemplateId(savedTemplate.id);
      setTemplateState("idle");
      void loadTemplates(true);
    } catch(error) { setTemplateError(error instanceof Error?error.message:"템플릿을 저장하지 못했습니다."); setTemplateState("error"); }
  }
  async function copyTemplate(template:ProjectTemplate) {
    await fetch("/api/templates",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:template.id,mode:"copy",version:template.version,definition:template.definition})});
    projectTemplateCache=null;
    await loadTemplates(true);
  }
  async function toggleTemplateStatus(template:ProjectTemplate) {
    await fetch("/api/templates",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:template.id,mode:"status",status:template.status==="active"?"inactive":"active"})});
    projectTemplateCache=null;
    await loadTemplates(true);
  }
  async function deleteTemplate(template:ProjectTemplate) {
    if(!template.canDelete){setTemplateError("자신이 만든 템플릿만 삭제할 수 있습니다. 관리자는 모든 템플릿을 삭제할 수 있습니다.");return;}
    if(!window.confirm(`'${template.name}' 템플릿을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`))return;
    const response=await fetch(`/api/templates?id=${encodeURIComponent(template.id)}`,{method:"DELETE"});
    const result=await response.json() as {error?:string};
    if(!response.ok){setTemplateError(result.error||"템플릿을 삭제하지 못했습니다.");return;}
    setSelectedTemplateId("");
    projectTemplateCache=null;
    await loadTemplates(true);
  }
  const updateProjectForm = (key:keyof typeof projectForm,value:string) => setProjectForm(current=>({...current,[key]:value}));
  const openTemplatePanel=()=>{setDraftTemplateId(selectedTemplateId);setTemplateSearch("");setTemplatePanelOpen(true);};
  const openCopyPanel=()=>{setDraftSourceProjectId(selectedSourceProjectId);setDraftCopyAssignees(copyAssignees);setCopyProjectSearch("");setCopyProjectStatus("전체");setCopyPanelOpen(true);};
  async function createProject() {
    setCreateState("saving"); setCreateError("");
    try {
      if(!projectForm.name.trim()) throw new Error("프로젝트명을 입력해 주세요.");
      if(projectCodeLoading||!projectForm.code) throw new Error("프로젝트 코드 자동채번이 완료될 때까지 잠시 기다려 주세요.");
      if(!projectForm.projectType) throw new Error("프로젝트 유형을 선택해 주세요.");
      if(!projectForm.startDate||!projectForm.endDate) throw new Error("계약 시작일과 종료일을 입력해 주세요.");
      if(projectForm.endDate<projectForm.startDate) throw new Error("계약 종료일은 시작일보다 빠를 수 없습니다.");
      if(creationMode==="template"&&!selectedTemplate) throw new Error("사용할 템플릿을 선택해 주세요.");
      if(creationMode==="copy"&&!selectedSourceProjectId) throw new Error("복사할 기존 프로젝트를 선택해 주세요.");
      const response = await fetch("/api/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...projectForm,creationMode,templateVersionId:creationMode==="template"?selectedTemplate?.versionId:undefined,sourceProjectId:creationMode==="copy"?selectedSourceProjectId:undefined,copyAssignees:creationMode==="copy"?copyAssignees:false,members:creationMode==="copy"?undefined:[{userId:"user-dean",projectRole:"PM"}]})});
      const responseText = await response.text();
      let result:{error?:string;id?:string;name?:string;code?:string}={};
      if(responseText.trim()){
        try{result=JSON.parse(responseText) as typeof result;}
        catch{if(response.ok)throw new Error("프로젝트 생성 결과를 확인하지 못했습니다.");}
      }
      if(!response.ok) throw new Error(result.error || `프로젝트 생성 중 서버 오류가 발생했습니다. (HTTP ${response.status})`);
      onProjectCreated({id:result.id!,name:result.name||projectForm.name,code:result.code||projectForm.code,customerName:projectForm.customerName,startDate:projectForm.startDate,endDate:projectForm.endDate,status:"preparing",templateName:creationMode==="template"?selectedTemplate?.name:creationMode==="copy"?sourceProjects.find(item=>item.id===selectedSourceProjectId)?.templateName:"빈 프로젝트",templateVersion:creationMode==="template"?selectedTemplate?.version:creationMode==="copy"?sourceProjects.find(item=>item.id===selectedSourceProjectId)?.templateVersion:"직접 구성",memberCount:1});
      setCreatedProject(true); setCreateState("idle");
    } catch(error) {
      setCreateError(error instanceof Error ? error.message : "프로젝트를 생성하지 못했습니다."); setCreateState("error");
    }
  }
  return <div className={`content admin-content ${editorTabActive?"template-editor-tab-active":""}`}>
    <section className={`admin-heading ${tab==="template"||tab==="project"?"module-compact-heading":""}`}>
<div>
<p className="eyebrow">{tab === "organization" ? <>
<Settings size={15}/> SYSTEM MANAGEMENT</> : tab === "template" ? <>
<Target size={15}/> 프로젝트 템플릿</> : <>
<Target size={15}/> 새 프로젝트</>}</p>
{tab==="organization"&&<><h1>시스템 기반 관리</h1>
<p>회사·조직, 사용자·역할, 권한과 공통 코드를 관리합니다.</p></>}
</div>
{tab === "template"&&<button className="new-work" onClick={()=>openTemplateEditor()}><Plus size={16}/> 새 템플릿</button>}
{tab === "organization"&&<span className="admin-phase">
<Check size={15}/> 1차 개발 범위</span>}
</section>
    {tab === "organization" && <div className="system-scope" aria-label="시스템 관리 범위">
<span>
<Building2 size={14}/> 회사·조직</span>
<span>
<Users size={14}/> 사용자·역할</span>
<span>
<ShieldCheck size={14}/> 권한 관리</span>
<span>
<Layers3 size={14}/> 공통 코드</span>
<button onClick={()=>setShowCategoryManager(!showCategoryManager)}>
<FileText size={14}/> 문서 분류체계</button>
<button onClick={()=>setShowProjectTypeManager(!showProjectTypeManager)}>
<Target size={14}/> 프로젝트 유형 관리</button>
<button onClick={()=>setShowPartnerManager(!showPartnerManager)}>
<Building2 size={14}/> 거래처 관리</button>
<button onClick={()=>setShowPartnerTypeManager(!showPartnerTypeManager)}>
<Layers3 size={14}/> 거래처 유형 관리</button>
<button onClick={()=>setShowRoleManager(!showRoleManager)}>
<BriefcaseBusiness size={14}/> 프로젝트 Role 마스터</button>
</div>}
    {tab==="organization" ? <>
      <section className="admin-summary">
<article>
<span>조직</span>
<strong>4</strong>
<small>본사 · 3개 조직</small>
</article>
<article>
<span>사용자</span>
<strong>12</strong>
<small>활성 11 · 초대 1</small>
</article>
<article>
<span>역할</span>
<strong>5</strong>
<small>관리자 · PMO · PM · 담당자 · 조회</small>
</article>
<article>
<span>권한 예외</span>
<strong>1</strong>
<small className="danger-text">확인 필요</small>
</article>
</section>
      <div className="admin-grid">
<section className="panel admin-panel">
<header>
<div>
<h2>회사 · 조직 구조</h2>
<p>조직을 선택하면 소속 사용자와 기본 역할을 확인합니다.</p>
</div>
<button>
<Plus size={15}/> 조직 추가</button>
</header>
<div className="org-tree">
<button className="root active">
<Building2 size={17}/>
<span>
<strong>J SOLUTION</strong>
<small>전체 12명</small>
</span>
<ChevronDown size={16}/>
</button>{[["PMO","3명"],["PLM 사업팀","4명"],["AI 개발팀","5명"]].map(([name,count])=>
<button key={name}>
<span className="tree-line"/>
<Users size={16}/>
<span>
<strong>{name}</strong>
<small>{count}</small>
</span>
<ChevronRight size={15}/>
</button>)}</div>
</section>
      <section className="panel admin-panel">
<header>
<div>
<h2>사용자 · 역할</h2>
<p>J SOLUTION 전체 사용자</p>
</div>
<button>
<UserCog size={15}/> 사용자 초대</button>
</header>
<div className="member-list">{[["DK","Dean Kim","대표 · PMO","시스템 관리자","active"],["박","박지연","PMO","PMO 관리자","active"],["김","김서준","PLM 사업팀","프로젝트 PM","active"],["이","이도현","AI 개발팀","담당자","active"],["최","최은서","PLM 사업팀","담당자","invite"]].map(([avatar,name,dept,role,state])=>
<article key={name}>
<b>{avatar}</b>
<span>
<strong>{name}</strong>
<small>{dept}</small>
</span>
<em>{role}</em>
<i className={state}>{state==="invite"?"초대 대기":"활성"}</i>
<button aria-label={`${name} 설정`}>
<MoreHorizontal size={17}/>
</button>
</article>)}</div>
</section>
</div>
      {showCategoryManager&&<section className="panel project-role-master">
<header>
<div>
<h2>회사 표준 문서 분류체계</h2>
<p>기본 2레벨 분류를 회사에 맞게 수정합니다. 사용 중인 분류는 삭제하지 않고 사용 여부로 관리합니다.</p>
</div>
<button onClick={addDocumentCategory}><Plus size={15}/> 1레벨 추가</button>
</header>
<div style={{display:"grid",gridTemplateColumns:"minmax(240px, 0.8fr) minmax(420px, 1.8fr)",gap:18,padding:"18px"}}>
<div style={{display:"grid",gap:8,alignContent:"start"}}>
{documentCategories.map(category=><button key={category.id} onClick={()=>setSelectedCategoryId(category.id)} style={{display:"grid",gridTemplateColumns:"56px 1fr auto",alignItems:"center",gap:10,padding:"11px 12px",border:selectedCategoryId===category.id?"1px solid #2f80ed":"1px solid #dfe6ee",borderRadius:9,background:selectedCategoryId===category.id?"#f2f7ff":"#fff",textAlign:"left"}}>
<small>{category.code}</small><strong>{category.name}</strong><span>{category.children.filter(child=>child.enabled).length}</span>
</button>)}
</div>
{selectedDocumentCategory&&<div style={{display:"grid",gap:12,alignContent:"start"}}>
<div style={{display:"grid",gridTemplateColumns:"110px 1fr auto auto",gap:10,alignItems:"center"}}>
<input value={selectedDocumentCategory.code} readOnly aria-label="1레벨 분류 코드"/>
<input value={selectedDocumentCategory.name} onChange={event=>updateDocumentCategory(selectedDocumentCategory.id,"name",event.target.value)} aria-label="1레벨 분류명"/>
<label><input type="checkbox" checked={selectedDocumentCategory.enabled} onChange={event=>updateDocumentCategory(selectedDocumentCategory.id,"enabled",event.target.checked)}/> 사용</label>
<button type="button" className="grid-delete" onClick={()=>deleteDocumentCategory(selectedDocumentCategory.id)} aria-label="1레벨 분류 삭제"><Trash2 size={15}/></button>
</div>
<div className="deliverable-title"><span>2레벨 분류</span><button type="button" onClick={addDocumentSubcategory}><Plus size={13}/> 2레벨 추가</button></div>
{selectedDocumentCategory.children.map(child=><div key={child.id} style={{display:"grid",gridTemplateColumns:"110px 1fr auto auto",gap:10,alignItems:"center"}}>
<input value={child.code} readOnly aria-label="2레벨 분류 코드"/>
<input value={child.name} onChange={event=>updateDocumentSubcategory(selectedDocumentCategory.id,child.id,"name",event.target.value)} aria-label="2레벨 분류명"/>
<label><input type="checkbox" checked={child.enabled} onChange={event=>updateDocumentSubcategory(selectedDocumentCategory.id,child.id,"enabled",event.target.checked)}/> 사용</label>
<button type="button" className="grid-delete" onClick={()=>deleteDocumentSubcategory(selectedDocumentCategory.id,child.id)} aria-label={`${child.name} 삭제`}><Trash2 size={15}/></button>
</div>)}
<small>AI는 사용 중인 2레벨 분류 안에서만 카테고리를 선택하고, 확신도가 낮을 때 사용자에게 후보를 제안합니다.</small>
</div>}
</div>
</section>}
      {showProjectTypeManager&&<section className="panel project-type-master">
<header>
<div><h2>프로젝트 유형 관리</h2><p>고객사 업무에 맞게 유형명, 사용 여부와 프로젝트 생성 화면의 노출 순서를 관리합니다.</p></div>
<button onClick={addProjectType}><Plus size={15}/> 유형 추가</button>
</header>
<div className="project-type-head"><span>순서</span><span>코드</span><span>프로젝트 유형명</span><span>사용 여부</span><span>순서 변경</span></div>
<div className="project-type-list">{projectTypes.map((type,index)=><article key={type.id}>
<strong>{String(index+1).padStart(2,"0")}</strong>
<code>{type.code}</code>
<input value={type.name} aria-label="프로젝트 유형명" onChange={event=>updateProjectType(type.id,"name",event.target.value)}/>
<label><input type="checkbox" checked={type.enabled} onChange={event=>updateProjectType(type.id,"enabled",event.target.checked)}/><span>{type.enabled?"사용":"미사용"}</span></label>
<div><button disabled={index===0} onClick={()=>moveProjectType(type.id,-1)} aria-label={`${type.name} 위로`}><ArrowUp size={14}/></button><button disabled={index===projectTypes.length-1} onClick={()=>moveProjectType(type.id,1)} aria-label={`${type.name} 아래로`}><ArrowDown size={14}/></button></div>
</article>)}</div>
<footer><ShieldCheck size={14}/><span>기존 프로젝트에서 사용한 유형은 삭제하지 않고 미사용 처리하세요. 미사용 유형은 신규 프로젝트 생성에서만 숨겨집니다.</span></footer>
</section>}
      {showPartnerManager&&<section className="panel partner-master">
<header><div><h2>거래처 관리</h2><p>프로젝트에 연결할 고객사·공급사·외주처와 담당자 정보를 관리합니다.</p></div><button onClick={addPartner}><Plus size={15}/> 거래처 추가</button></header>
<div className="partner-layout"><div className="partner-list">
{partners.map(partner=><button key={partner.id} className={selectedPartner?.id===partner.id?"active":""} onClick={()=>setSelectedPartnerId(partner.id)}><span><strong>{partner.name}</strong><small>{partner.code} · {partnerTypes.find(type=>type.id===partner.typeId)?.name||"유형 미지정"}</small></span><i className={partner.enabled?"active":"inactive"}>{partner.enabled?"사용":"미사용"}</i></button>)}
</div>{selectedPartner&&<div className="partner-form">
<label className="toggle-field"><span>사용 여부 <em>필수</em></span><input type="checkbox" checked={selectedPartner.enabled} onChange={e=>updatePartner(selectedPartner.id,"enabled",e.target.checked)}/><b>{selectedPartner.enabled?"사용":"미사용"}</b></label>
<label><span>거래처명 <em>필수</em></span><input value={selectedPartner.name} onChange={e=>updatePartner(selectedPartner.id,"name",e.target.value)}/></label>
<label><span>거래처 코드 <em>필수</em></span><input value={selectedPartner.code} onChange={e=>updatePartner(selectedPartner.id,"code",e.target.value)}/></label>
<label><span>거래처 유형 <em>필수</em></span><select value={selectedPartner.typeId} onChange={e=>updatePartner(selectedPartner.id,"typeId",e.target.value)}>{partnerTypes.filter(type=>type.enabled||type.id===selectedPartner.typeId).map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
<label><span>담당자 이름</span><input value={selectedPartner.contactName} onChange={e=>updatePartner(selectedPartner.id,"contactName",e.target.value)}/></label>
<label><span>담당자 연락처</span><input value={selectedPartner.contactPhone} onChange={e=>updatePartner(selectedPartner.id,"contactPhone",e.target.value)}/></label>
<label><span>담당자 이메일</span><input type="email" value={selectedPartner.contactEmail} onChange={e=>updatePartner(selectedPartner.id,"contactEmail",e.target.value)}/></label>
<label><span>대표번호</span><input value={selectedPartner.mainPhone} onChange={e=>updatePartner(selectedPartner.id,"mainPhone",e.target.value)}/></label>
<label><span>영문명</span><input value={selectedPartner.englishName} onChange={e=>updatePartner(selectedPartner.id,"englishName",e.target.value)}/></label>
<label><span>국가</span><input value={selectedPartner.country} onChange={e=>updatePartner(selectedPartner.id,"country",e.target.value)}/></label>
<label><span>업종</span><input value={selectedPartner.industry} onChange={e=>updatePartner(selectedPartner.id,"industry",e.target.value)}/></label>
<label><span>대표자명</span><input value={selectedPartner.representative} onChange={e=>updatePartner(selectedPartner.id,"representative",e.target.value)}/></label>
<label><span>사업자등록번호</span><input value={selectedPartner.businessNumber} onChange={e=>updatePartner(selectedPartner.id,"businessNumber",e.target.value)}/></label>
<label className="wide"><span>주소</span><input value={selectedPartner.address} onChange={e=>updatePartner(selectedPartner.id,"address",e.target.value)}/></label>
<label className="wide"><span>기타</span><textarea value={selectedPartner.extra} onChange={e=>updatePartner(selectedPartner.id,"extra",e.target.value)}/></label>
<label className="wide"><span>비고</span><textarea value={selectedPartner.note} onChange={e=>updatePartner(selectedPartner.id,"note",e.target.value)}/></label>
</div>}</div><footer><ShieldCheck size={14}/><span>프로젝트에서 사용된 거래처는 삭제하지 않고 미사용 처리합니다.</span></footer>
</section>}
      {showPartnerTypeManager&&<section className="panel project-type-master">
<header><div><h2>거래처 유형 관리</h2><p>기본 유형 4개를 제공하며 고객사 관리자가 명칭과 순서를 변경하거나 새 유형을 추가할 수 있습니다.</p></div><button onClick={addPartnerType}><Plus size={15}/> 유형 추가</button></header>
<div className="project-type-head"><span>순서</span><span>코드</span><span>거래처 유형명</span><span>사용 여부</span><span>순서 변경</span></div>
<div className="project-type-list">{partnerTypes.map((type,index)=><article key={type.id}><strong>{String(index+1).padStart(2,"0")}</strong><code>{type.code}</code><input value={type.name} aria-label="거래처 유형명" onChange={e=>updatePartnerType(type.id,"name",e.target.value)}/><label><input type="checkbox" checked={type.enabled} onChange={e=>updatePartnerType(type.id,"enabled",e.target.checked)}/><span>{type.enabled?"사용":"미사용"}</span></label><div><button disabled={index===0} onClick={()=>movePartnerType(type.id,-1)} aria-label={`${type.name} 위로`}><ArrowUp size={14}/></button><button disabled={index===partnerTypes.length-1} onClick={()=>movePartnerType(type.id,1)} aria-label={`${type.name} 아래로`}><ArrowDown size={14}/></button></div></article>)}</div>
<footer><ShieldCheck size={14}/><span>기본 제공: 고객사 · 공급사 · 외주처 · 기타. 필요하면 고객사별 유형을 추가할 수 있습니다.</span></footer>
</section>}
      <section className="panel role-matrix">
<header>
<div>
<h2>역할별 기본 권한</h2>
<p>권한은 서버에서 역할과 프로젝트 참여 범위를 함께 확인합니다.</p>
</div>
<button>권한 편집 <Pencil size={14}/>
</button>
</header>
<div className="matrix-row head">
<span>역할</span>
<span>조직 관리</span>
<span>템플릿</span>
<span>프로젝트 생성</span>
<span>WBS 편집</span>
<span>실적 입력</span>
</div>{[["시스템 관리자",1,1,1,1,1],["PMO 관리자",0,1,1,1,1],["프로젝트 PM",0,0,1,1,1],["담당자",0,0,0,0,1]].map(row=>
<div className="matrix-row" key={String(row[0])}>
<strong>{row[0]}</strong>{row.slice(1).map((yes,i)=>
<span key={i} className={yes?"yes":"no"}>{yes?<Check size={14}/>:"—"}</span>)}</div>)}</section>
      {showRoleManager&&<section className="panel project-role-master">
<header>
<div>
<h2>프로젝트 역할 관리</h2>
<p>역할 분류별 표준 역할과 약어·코드를 관리합니다. 프로젝트 관리자(PM)와 프로젝트 리더(PL)는 필수 역할입니다.</p>
</div>
<button onClick={addRole}>
<Plus size={15}/> 역할 추가</button>
</header>
{Array.from(new Set(projectRoles.map(role=>role.group))).map(group=><div key={group} className="project-role-group">
<h3>{group}<small>{projectRoles.filter(role=>role.group===group).length}개 역할</small></h3>
{projectRoles.filter(role=>role.group===group).map(role=>
<article key={role.id}>
<input value={role.code} readOnly={role.code==="PM"||role.code==="PL"} onChange={e=>updateRole(role.id,"code",e.target.value)} aria-label="역할 코드"/>
<input value={role.name} onChange={e=>updateRole(role.id,"name",e.target.value)} aria-label="역할명"/>
<input value={role.description} onChange={e=>updateRole(role.id,"description",e.target.value)} aria-label="역할 설명"/>
<label title="프로젝트에 자동 포함"><input type="checkbox" checked={role.required} disabled={role.code==="PM"||role.code==="PL"} onChange={e=>updateRole(role.id,"required",e.target.checked)}/> 필수</label>
<label title="한 역할에 여러 명 배정"><input type="checkbox" checked={role.multiple} onChange={e=>updateRole(role.id,"multiple",e.target.checked)}/> 복수</label>
<label><input type="checkbox" checked={role.enabled} disabled={role.code==="PM"||role.code==="PL"} onChange={e=>updateRole(role.id,"enabled",e.target.checked)}/> 사용</label>
<button disabled={role.code==="PM"||role.code==="PL"} onClick={()=>deleteRole(role.id)} title={role.code==="PM"||role.code==="PL"?"필수 역할은 삭제할 수 없습니다.":templateForm.wbs.some(row=>row.role===role.code)?"사용 중인 역할은 삭제할 수 없습니다.":"삭제"}>
<Trash2 size={15}/>
</button>
</article>)}</div>)}</section>}
    </> : tab==="template" ? <>
      {templateError&&!templateEditor&&<p className="wizard-error" role="alert">{templateError}</p>}
      <div className="template-browser"><section className="template-list">{templates.map(template=>
<article key={template.id} className={selectedTemplate?.id===template.id?"selected":""} onClick={()=>setSelectedTemplateId(template.id)}>
<div className="template-main">
<span>
<Workflow size={19}/>
</span>
<div>
<small>{template.code}</small>
<strong>{template.name}</strong>
<p>{template.version} · {template.definition.description||"표준 프로젝트 템플릿"}</p>
</div>
</div>
<em className={template.status==="active"?"active":"review"}>{template.status==="active"?"사용 중":template.status==="draft"?"작성 중":"사용 중지"}</em>
</article>)}</section>
      {selectedTemplate&&<section className="panel template-detail">
<header>
<div>
<span>{selectedTemplate.name} · {selectedTemplate.version}</span>
<h2>템플릿 구성</h2>
</div>
<div>
<button onClick={()=>openTemplateEditor(selectedTemplate,true)}><Pencil size={14}/> 편집</button>
<button onClick={()=>void copyTemplate(selectedTemplate)}><Workflow size={14}/> 복사</button>
<button className="danger" disabled={!selectedTemplate.canDelete} title={selectedTemplate.canDelete?"템플릿 삭제":"자신이 만든 템플릿만 삭제할 수 있습니다."} onClick={()=>void deleteTemplate(selectedTemplate)}><Trash2 size={14}/> 삭제</button>
<button onClick={()=>void toggleTemplateStatus(selectedTemplate)}>{selectedTemplate.status==="active"?"사용 중지":"사용 전환"}</button>
</div>
</header>
{(()=>{const summary=templateSummary(selectedTemplate);return <>
<div className="template-detail-summary">
<div><span className={`template-status ${selectedTemplate.status}`}>{selectedTemplate.status==="active"?"사용 가능":selectedTemplate.status==="draft"?"작성 중":"사용 중지"}</span><strong>{selectedTemplate.definition.description||"표준 프로젝트 템플릿"}</strong></div>
<p>프로젝트 생성 전에 WBS 구조와 표준 일정, 담당 Role, Gate 및 산출물 구성을 빠르게 검토할 수 있습니다.</p>
<dl><div><dt>템플릿 코드</dt><dd>{selectedTemplate.code}</dd></div><div><dt>버전</dt><dd>{selectedTemplate.version}</dd></div><div><dt>작성자</dt><dd>{selectedTemplate.createdByName||"Dean Kim"}</dd></div><div><dt>최종 수정</dt><dd>{new Date(selectedTemplate.updatedAt*1000).toLocaleDateString("ko-KR")}</dd></div></dl>
</div>
<div className="template-decision-strip"><div><Sparkles size={18}/><span><strong>{selectedTemplate.status==="active"?"바로 프로젝트에 적용할 수 있습니다.":"검토 중인 템플릿입니다."}</strong><small>{selectedTemplate.status==="active"?"유사 프로젝트라면 그대로 사용하고, 차이가 있다면 복사 후 WBS를 조정하세요.":"복사하여 수정하거나 편집을 완료한 뒤 사용 전환하세요."}</small></span></div><button onClick={()=>void copyTemplate(selectedTemplate)}><Workflow size={15}/> 복사해서 수정</button></div>
<div className="template-config">{[["WBS 구성",`${summary.groups}개 그룹 · ${summary.tasks}개 Task`,"계층 구조에 따라 그룹과 실행 Task 자동 구분"],["담당 역할",`${selectedTemplate.definition.roles.length}개 Role`,selectedTemplate.definition.roles.join(" · ")],["산출물 계획",`${summary.deliverables}개`,summary.deliverables?`필수 ${summary.required}개 · 선택 ${summary.optional}개`:"등록된 산출물 없음"],["Gate 검토",`${summary.gates}개 Gate`,summary.gates?"주요 단계별 검토·승인 지점 포함":"Gate Task 미설정"],["표준 완료 기간",`${summary.duration}일`,"선후행 관계를 반영한 예상 완료 소요일"],["버전·사용 상태",selectedTemplate.version,selectedTemplate.status==="active"?"프로젝트 생성 시 이 버전을 복제해 보존":"현재 프로젝트 생성에서 선택할 수 없음"]].map(([title,count,desc])=>
<button key={title}>
<span>
<CircleCheck size={17}/>
</span>
<div>
<strong>{title}</strong>
<small>{desc}</small>
</div>
<em>{count}</em>
<ChevronRight size={16}/>
</button>)}</div></>})()}
<footer>
<ShieldCheck size={15}/>
<span>프로젝트 생성 시 선택한 템플릿 버전이 복제되어 보존됩니다. 이후 템플릿 변경은 기존 프로젝트에 자동 반영되지 않습니다.</span>
</footer>
</section>}</div>
      {templateEditor&&editorTabActive&&<section className="template-editor tree-editor template-editor-tab">
<div className="template-editor-body">
{draftRestored&&<div className="draft-notice"><History size={15}/><span>이전에 닫은 편집 내용을 자동으로 복구했습니다.</span><button onClick={()=>setDraftRestored(false)}>확인</button></div>}
<div className="wizard-form compact">
<label>
<span>코드</span>
<input value={templateForm.code} disabled={templateEditor==="edit"} onChange={e=>setTemplateForm(current=>({...current,code:e.target.value}))}/>
</label>
<label>
<span>버전</span>
<input value={templateForm.version} onChange={e=>setTemplateForm(current=>({...current,version:e.target.value}))}/>
</label>
<label>
<span>템플릿명</span>
<input value={templateForm.name} onChange={e=>setTemplateForm(current=>({...current,name:e.target.value}))}/>
</label>
<label>
<span>설명</span>
<input value={templateForm.description} onChange={e=>setTemplateForm(current=>({...current,description:e.target.value}))}/>
</label>
</div>
<div className="tree-toolbar">
<div className="tree-actions">
<strong className="toolbar-label">WBS 편집</strong>
<button onClick={()=>addTemplateWbs(false)}>
<Plus size={14}/> 같은 레벨</button>
<button onClick={()=>addTemplateWbs(true)}>
<Plus size={14}/> 하위 Task</button>
<button onClick={()=>changeWbsLevel(-1)}>
<IndentDecrease size={14}/> 내어쓰기</button>
<button onClick={()=>changeWbsLevel(1)}>
<IndentIncrease size={14}/> 들여쓰기</button>
<button onClick={()=>moveWbs(-1)}>
<ArrowUp size={14}/>
</button>
<button onClick={()=>moveWbs(1)}>
<ArrowDown size={14}/>
</button>
</div>
</div>
<div className="template-tree-layout">
<section className="template-tree">
<header>
<div><strong>WBS 트리</strong><span>{visibleTemplateRows.length}/{templateForm.wbs.length}개 표시</span></div>
<div className="template-grid-tools">
<label className="task-filter"><ListFilter size={15}/><span>Task Type</span><select value={templateTaskFilter} onChange={event=>setTemplateTaskFilter(event.target.value as typeof templateTaskFilter)}>
<option value="all">전체</option><option value="normal">일반 Task</option><option value="gate">Gate Task</option><option value="summary">그룹</option>
</select></label>
<div className="template-duration"><Clock3 size={16}/><span>총 소요일</span><strong>{templateDuration}<small>일</small></strong></div>
</div>
</header>
<div className="template-grid-head"><span>WBS / Task명</span><span>자동 구분</span><span>Task Type</span><span>소요일</span><span>선행</span><span>Role</span><span>산출물</span><span>삭제</span></div>
{visibleTemplateRows.map(({item,index})=>
<div role="button" tabIndex={0} key={`${item.id}-${index}`} className={`template-grid-row ${selectedTemplateWbs===index?"active":""}`} onClick={()=>setSelectedTemplateWbs(index)} onKeyDown={event=>{if(event.key==="Enter")setSelectedTemplateWbs(index)}}>
<div className="template-task-cell" style={{paddingLeft:10+(item.level-1)*20}}>
<span className="tree-code">{item.id}</span>
<span>{item.kind==="summary"?<Layers3 size={15}/>:item.taskType==="gate"?<ShieldCheck size={15}/>:<CircleDot size={15}/>}</span>
<input ref={element=>{templateNameInputs.current[index]=element}} className="tree-name-input" value={item.name} placeholder="Task명 입력" aria-label={`${item.id} Task명`} title="Enter: 다음 Task · Shift+Enter: 이전 Task · Ctrl+Enter: 하위 Task 추가" onClick={event=>event.stopPropagation()} onFocus={()=>setSelectedTemplateWbs(index)} onKeyDown={event=>handleTemplateNameKeyDown(event,index)} onChange={event=>updateTemplateWbs(index,"name",event.target.value)}/>
</div>
<span className={`auto-kind ${item.kind}`}>{item.kind==="summary"?`${Math.min(item.level,3)}레벨 그룹`:"실행 Task"}</span>
<select aria-label={`${item.id} Task Type`} value={item.taskType} disabled={item.kind==="summary"} onClick={event=>event.stopPropagation()} onFocus={()=>setSelectedTemplateWbs(index)} onChange={event=>updateTemplateWbs(index,"taskType",event.target.value)}><option value="normal">일반 Task</option><option value="gate">Gate Task</option></select>
<input ref={element=>{templateDurationInputs.current[index]=element}} aria-label={`${item.id} 표준 소요일`} title="Enter: 다음 소요일 · Shift+Enter: 이전 소요일" type="number" min="0" disabled={item.kind==="summary"} value={item.durationDays} onClick={event=>event.stopPropagation()} onFocus={()=>setSelectedTemplateWbs(index)} onKeyDown={event=>handleTemplateDurationKeyDown(event,index)} onChange={event=>updateTemplateWbs(index,"durationDays",Number(event.target.value))}/>
<select aria-label={`${item.id} 선행 Task`} value={item.predecessor||""} onClick={event=>event.stopPropagation()} onFocus={()=>setSelectedTemplateWbs(index)} onChange={event=>updateTemplateWbs(index,"predecessor",event.target.value)}><option value="">없음</option>{templateForm.wbs.filter((_,rowIndex)=>rowIndex!==index).map(row=><option key={row.id} value={row.id}>{row.id}</option>)}</select>
<select aria-label={`${item.id} 담당 Role`} value={item.role} onClick={event=>event.stopPropagation()} onFocus={()=>setSelectedTemplateWbs(index)} onChange={event=>updateTemplateWbs(index,"role",event.target.value)}>{projectRoles.filter(role=>role.enabled).map(role=><option key={role.code} value={role.code}>{role.name} ({role.code})</option>)}</select>
<span className={`grid-deliverables ${rowDeliverableCount(index)>0?"has-output":"empty"}`} title={item.kind==="summary"?"하위 실행 Task 산출물 합계":"등록된 산출물"}><FileText size={14}/><b>{rowDeliverableCount(index)}</b></span>
<button type="button" className="grid-delete" disabled={templateForm.wbs.length===1} onClick={event=>{event.stopPropagation();removeTemplateWbs(index)}} aria-label={`${item.id} ${item.name} 삭제`} title="Task 삭제"><Trash2 size={15}/></button>
</div>)}</section>{selectedWbsRow&&<section className="task-property">
<header>
<div>
<strong>{selectedWbsRow.id} 산출물</strong>
<span>{selectedWbsRow.kind==="summary"?"그룹 WBS는 하위 실행 Task의 산출물을 자동 집계합니다.":`${selectedWbsRow.name||"선택한 Task"}의 산출물을 설정합니다.`}</span>
</div>
</header>
<div className="property-grid deliverables-only">
{selectedWbsRow.kind==="summary"?<div className="wide group-deliverable-summary">
<div className="group-deliverable-icon"><Layers3 size={24}/></div>
<div><strong>하위 실행 Task 산출물 {rowDeliverableCount(selectedTemplateWbs)}개</strong><p>그룹 WBS에는 산출물을 직접 설정할 수 없습니다.<br/>필요한 산출물은 하위 실행 Task 또는 Gate Task에 등록해 주세요.</p></div>
</div>:<>
<div className="wide deliverable-editor">
<div className="deliverable-title"><span>산출물 설정</span><button type="button" onClick={addDeliverable}><Plus size={13}/> 산출물 추가</button></div>
<div className="deliverable-head"><span>1레벨</span><span>2레벨</span><span>필수 여부</span><span>산출물명</span><span>삭제</span></div>
{selectedWbsRow.deliverables.length===0?<p>등록된 산출물이 없습니다. 필요한 산출물을 추가하세요.</p>:selectedWbsRow.deliverables.map((deliverable,index)=><div className="deliverable-row" key={index}>
<DocumentCategoryPicker categories={documentCategories} value={deliverable.type} onChange={value=>updateDeliverable(index,"type",value)} label="템플릿 산출물 카테고리"/>
<select aria-label="산출물 필수 여부" value={deliverable.required===false?"optional":"required"} onChange={e=>updateDeliverable(index,"required",e.target.value==="required")}><option value="required">필수</option><option value="optional">선택</option></select>
<input aria-label="산출물명" value={deliverable.name} placeholder="산출물명" onChange={e=>updateDeliverable(index,"name",e.target.value)}/>
<button type="button" className="remove-deliverable" onClick={()=>removeDeliverable(index)} aria-label="산출물 삭제"><Trash2 size={14}/></button>
</div>)}
<small>카테고리는 회사 표준값에서 선택합니다. AI 자동 분류·신규 카테고리 제안은 고도화 단계에서 연결합니다.</small>
</div>
</>}
</div>
</section>}</div>{templateError&&<p className="wizard-error" role="alert">{templateError}</p>}</div>
<footer>
<span className="footer-save-state">{templateState==="saving"?"저장 중…":templateDirty?"변경 내용 자동 임시저장 중":"저장 완료 · 계속 편집할 수 있습니다"}</span>
<button className="primary" disabled={templateState==="saving"} onClick={()=>void saveTemplate()}>{templateState==="saving"?"저장 중…":<>
<Check size={15}/> 저장</>}</button>
</footer>
</section>}
    </> : <section className="project-wizard project-create-page panel">
      {createdProject ? <div className="project-created">
<span><CircleCheck size={30}/></span>
<h3>{projectForm.name}</h3>
<p>{creationMode==="template"?selectedTemplate?.name+" 템플릿의 WBS·산출물·Role을 기준으로 생성되었습니다.":creationMode==="copy"?"선택한 기존 프로젝트의 수행 구성을 기준으로 생성되었습니다.":"빈 프로젝트가 생성되었습니다. 일정 · WBS에서 실행 구조를 직접 작성할 수 있습니다."}</p>
<div>
<button onClick={onOpenProjects}>프로젝트 목록</button>
<button className="primary" onClick={onOpenWbs}>일정 · WBS 편집 <ArrowRight size={15}/></button>
</div>
</div> : <>
<div className="project-create-body">
<section className="project-create-section">
<div className="project-create-section-title"><span>01</span><div><strong>프로젝트 기본정보</strong><small>프로젝트의 계약 및 수행 기준 정보를 입력하세요.</small></div></div>
<div className="wizard-form project-create-form">
<label><span>프로젝트명 <em>필수</em></span><input value={projectForm.name} onChange={e=>updateProjectForm("name",e.target.value)}/></label>
<label><span>프로젝트 코드</span><input value={projectForm.code} readOnly aria-busy={projectCodeLoading} placeholder={projectCodeLoading?"자동채번 중...":"자동 생성"}/></label>
<label><span>고객사</span><select value={projectForm.customerName} onChange={e=>updateProjectForm("customerName",e.target.value)}><option value="">고객사 선택</option>{partners.filter(partner=>partner.enabled&&partner.name.trim()).map(partner=><option key={partner.id} value={partner.name}>{partner.name} · {partnerTypes.find(type=>type.id===partner.typeId)?.name||"기타"}</option>)}</select></label>
<label><span>프로젝트 유형 <em>필수</em></span><select value={projectForm.projectType} onChange={e=>updateProjectForm("projectType",e.target.value)}><option value="">프로젝트 유형 선택</option>{projectTypes.filter(type=>type.enabled&&type.name.trim()).map(type=><option key={type.id} value={type.name}>{type.name}</option>)}</select><small className="field-help">시스템 관리에서 고객사별 유형을 수정할 수 있습니다.</small></label>
<label><span>시작일 <em>필수</em></span><input type="date" value={projectForm.startDate} onChange={e=>updateProjectForm("startDate",e.target.value)}/></label>
<label><span>종료일 <em>필수</em></span><input type="date" min={projectForm.startDate} value={projectForm.endDate} onChange={e=>updateProjectForm("endDate",e.target.value)}/></label>
<label className="wide"><span>프로젝트 설명</span><textarea value={projectForm.description} onChange={e=>updateProjectForm("description",e.target.value)} placeholder="프로젝트의 목적과 주요 범위를 입력하세요."/></label>
</div>
</section>
<section className="project-create-section">
<div className="project-create-section-title"><span>02</span><div><strong>프로젝트 생성 방식</strong><small>프로젝트 특성에 맞는 시작 기준을 선택하세요.</small></div></div>
<div className="creation-mode-choice project-create-modes">
<button className={creationMode==="template"?"active":""} onClick={()=>{setCreationMode("template");openTemplatePanel();}}><span><Workflow size={21}/></span><div><strong>템플릿으로 생성</strong><small>표준 WBS·산출물·Role을 적용합니다.</small></div>{creationMode==="template"&&<Check size={17}/>}</button>
<button className={creationMode==="copy"?"active":""} onClick={()=>{setCreationMode("copy");openCopyPanel();}}><span><Copy size={21}/></span><div><strong>기존 프로젝트 복사</strong><small>유사 프로젝트의 실제 수행 구성을 재사용합니다.</small></div>{creationMode==="copy"&&<Check size={17}/>}</button>
<button className={creationMode==="blank"?"active":""} onClick={()=>setCreationMode("blank")}><span><Plus size={21}/></span><div><strong>빈 프로젝트 생성</strong><small>기본정보만 만들고 일정 · WBS에서 직접 구성합니다.</small></div>{creationMode==="blank"&&<Check size={17}/>}</button>
</div>
<div className="project-selection-area"><div className="wizard-subtitle"><strong>선택 대상</strong><span>{creationMode==="blank"?"별도의 선택 대상이 없습니다.":"선택한 기준의 WBS·Task·Role·산출물 구조가 적용됩니다."}</span></div>
{creationMode==="template"&&(selectedTemplate?(()=>{const summary=templateSummary(selectedTemplate);return <div className="project-selection-result"><div><strong>{selectedTemplate.name} <span>({selectedTemplate.code} · {selectedTemplate.version})</span></strong><em>사용 가능</em></div><div><small>Task {summary.tasks} · Role {selectedTemplate.definition.roles.length} · 산출물 {summary.deliverables} · 완료 기간 {summary.duration}일</small><button onClick={openTemplatePanel}>변경</button></div></div>})():<button className="project-selection-empty" onClick={openTemplatePanel}>적용할 템플릿을 선택하세요 <ChevronRight size={15}/></button>)}
{creationMode==="copy"&&(()=>{const project=sourceProjects.find(item=>item.id===selectedSourceProjectId);return project?<div className="project-selection-result"><div><strong>{project.name} <span>({project.code})</span></strong><em>{project.status==="completed"?"완료":project.status==="active"?"진행 중":"보류"}</em></div><div><small>{project.customerName||"내부 프로젝트"} · Task 24 · Role 6 · 산출물 12 · {project.status==="completed"?"완료":"진행"} 기간 42일{copyAssignees?" · 담당자 포함":""}</small><button onClick={openCopyPanel}>변경</button></div></div>:<button className="project-selection-empty" onClick={openCopyPanel}>복사할 기존 프로젝트를 선택하세요 <ChevronRight size={15}/></button>})()}
{creationMode==="blank"&&<div className="blank-project-note"><Plus size={18}/><div><strong>기본정보만 생성합니다.</strong><small>프로젝트 생성 후 일정 · WBS 편집 화면에서 WBS, 산출물, Role을 직접 구성할 수 있습니다.</small></div></div>}
</div>
</section>
{createError&&<p className="wizard-error" role="alert">{createError}</p>}
</div>
<footer className="project-create-actions">
<button disabled={createState==="saving"} onClick={onOpenProjects}>취소</button>
<button className="primary" disabled={createState==="saving"||projectCodeLoading} onClick={()=>void createProject()}>{createState==="saving"?<>저장 중…</>:projectCodeLoading?<>코드 생성 중…</>:<>프로젝트 생성 <Check size={15}/></>}</button>
</footer>
{templatePanelOpen&&<div className="copy-project-panel-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setTemplatePanelOpen(false)}}>
<aside className="copy-project-panel" role="dialog" aria-modal="true" aria-label="적용할 템플릿 선택">
<header><div><small>PROJECT TEMPLATE</small><h3>템플릿 선택</h3><p>새 프로젝트에 적용할 표준 구성을 선택합니다.</p></div><button onClick={()=>setTemplatePanelOpen(false)} aria-label="패널 닫기"><X size={19}/></button></header>
<div className="selection-panel-search"><label className="copy-project-search"><Search size={17}/><input value={templateSearch} onChange={event=>setTemplateSearch(event.target.value)} placeholder="템플릿명 · 코드 · 설명 검색"/></label></div>
<div className="copy-project-panel-body selection-panel-scroll"><div className="copy-project-panel-list slim-selection-list">{templates.filter(template=>template.status==="active"&&template.name!=="빈 프로젝트"&&(!templateSearch.trim()||`${template.name} ${template.code} ${template.definition.description||""}`.toLowerCase().includes(templateSearch.trim().toLowerCase()))).map(template=>{const summary=templateSummary(template);return <button key={template.id} className={draftTemplateId===template.id?"active":""} onClick={()=>setDraftTemplateId(template.id)}><div><strong>{template.name} <span>({template.code} · {template.version})</span></strong><small>Task {summary.tasks} · Role {template.definition.roles.length} · 산출물 {summary.deliverables} · 완료 기간 {summary.duration}일</small></div><em>사용 가능</em></button>})}</div></div>
<footer><button onClick={()=>setTemplatePanelOpen(false)}>취소</button><button className="primary" disabled={!draftTemplateId} onClick={()=>{setSelectedTemplateId(draftTemplateId);setTemplatePanelOpen(false)}}>선택 적용 <Check size={15}/></button></footer>
</aside></div>}
{copyPanelOpen&&<div className="copy-project-panel-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setCopyPanelOpen(false)}}>
<aside className="copy-project-panel" role="dialog" aria-modal="true" aria-label="복사할 기존 프로젝트 선택">
<header><div><small>PROJECT COPY</small><h3>복사할 프로젝트 선택</h3><p>유사 프로젝트의 WBS·산출물·Role 구성을 가져옵니다.</p></div><button onClick={()=>setCopyPanelOpen(false)} aria-label="패널 닫기"><X size={19}/></button></header>
<div className="selection-panel-search"><label className="copy-project-search"><Search size={17}/><input value={copyProjectSearch} onChange={event=>setCopyProjectSearch(event.target.value)} placeholder="프로젝트명 · 코드 · 고객사 검색"/></label><div className="copy-project-filters"><div>{["전체","진행 중","완료","보류"].map(status=><button key={status} className={copyProjectStatus===status?"active":""} onClick={()=>setCopyProjectStatus(status)}>{status}</button>)}</div><select aria-label="프로젝트 정렬" value={copyProjectSort} onChange={event=>setCopyProjectSort(event.target.value)}><option value="recent">최근 수정순</option><option value="name">프로젝트명순</option></select></div></div>
<div className="copy-project-panel-body selection-panel-scroll"><div className="copy-project-panel-list slim-selection-list">{[...sourceProjects].sort((a,b)=>copyProjectSort==="name"?a.name.localeCompare(b.name,"ko"):b.id.localeCompare(a.id)).filter((project,index)=>{const label=project.status==="completed"?"완료":project.status==="active"?"진행 중":"보류";const q=copyProjectSearch.trim().toLowerCase();return (copyProjectStatus==="전체"||copyProjectStatus===label)&&(!q||`${project.name} ${project.code} ${project.customerName||""} ${index%2?"박지연 김서준":"Dean Kim 이도현"}`.toLowerCase().includes(q))}).map(project=><button key={project.id} className={draftSourceProjectId===project.id?"active":""} onClick={()=>setDraftSourceProjectId(project.id)}><div><strong>{project.name} <span>({project.code})</span></strong><small>{project.customerName||"내부 프로젝트"} · Task 24 · Role 6 · 산출물 12 · {project.status==="completed"?"완료":"진행"} 기간 42일</small></div><em>{project.status==="completed"?"완료":project.status==="active"?"진행 중":"보류"}</em></button>)}</div>{!sourceProjects.length&&<div className="copy-project-empty"><Copy size={24}/><strong>복사할 프로젝트가 없습니다.</strong><span>먼저 프로젝트를 생성한 뒤 다시 선택해 주세요.</span></div>}</div>
{draftSourceProjectId&&<div className="selection-panel-option"><label className="copy-assignee-option"><input type="checkbox" checked={draftCopyAssignees} onChange={e=>setDraftCopyAssignees(e.target.checked)}/><span><strong>역할별·Task별 담당자 포함</strong></span></label></div>}
<footer><button onClick={()=>setCopyPanelOpen(false)}>취소</button><button className="primary" disabled={!draftSourceProjectId} onClick={()=>{setSelectedSourceProjectId(draftSourceProjectId);setCopyAssignees(draftCopyAssignees);setCopyPanelOpen(false)}}>선택 적용 <Check size={15}/></button></footer>
</aside></div>}
</>}
  </section>}</div>;
}
