"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import {useCallback,useEffect,useMemo,useRef,useState,type ComponentType,type CSSProperties} from "react";
import {
  AlertTriangle,Bell,CalendarDays,ChartNoAxesGantt,Check,ChevronDown,Clock3,CircleDollarSign,
  ChevronLeft,ChevronRight,ChevronsLeft,Columns3,FileText,Filter,Folders,GanttChartSquare,
  FileStack,GitPullRequestArrow,History,LayoutDashboard,Link2,List,LogOut,MessageSquareText,MoreHorizontal,
  PanelLeftClose,PanelRightClose,PanelRightOpen,Plus,Search,Send,SlidersHorizontal,Unplug,
  RefreshCw,ShieldCheck,Sparkles,Table2,Target,Trash2,Users,Workflow,X,
} from "lucide-react";
import "./work-view-v2.css";
import "./v2-date-input.css";
import {FilteredMyWorkWorkspace,type MyWorkScope} from "./my-workspace";
import {durationFromRange,endFromDuration,nextBusinessDate,setActiveBusinessCalendar,toBusinessDate,type BusinessCalendar} from "./business-calendar";
import {CommonProjectSelector} from "./common-project-selector";
import {FilterChipGroup,FilterSection,FilterText,WorkspaceFilterContent,type WorkspaceFilterConfig} from "./workspace-filter-panel";
import {AiSelectionBar} from "./ai-context-selection";
import {UserAvatar} from "./user-avatar";
import GlobalRail from "./global-rail";
import {EcrWorkspace,MyWorkWorkflowWorkspace,ProjectWorkflowWorkspace,QualityWorkspace,SourceCreateWorkspace,WorkflowCreateWorkspace,WorkflowTemplateWorkspace} from "./workflow-workspaces";
import {
  AdvancedGanttView,AdvancedWbsEditor,ArtifactPreviewView,BomCompareWorkspace,ConnectedAiPanel,ContinuingAiHomeWorkspace,CostManagementWorkspace,
  FilteredIssuesWorkspace,GatePortfolioDashboard,GateProjectDashboard,GateWorkPanel,IntegratedGlobalSearch,
  NotificationCenterV2,PartBomWorkspace,PreviewDocumentsWorkspace,ProjectCreateWorkspace,ProjectEditWorkspace,ProjectListWorkspace,
  CalendarView,KanbanView,ListView,ProjectMembersMasterDialog,ReportsWorkspace,SystemSettingsSuite,TemplateWorkspace,TimelineView,WorkPanel,
  type AiDraftRequest,type ArtifactPreviewData,type ContextItem,type IntegratedSearchResult,type PortfolioProjectPreset,
  type ReportAiRequest,type V2Project,
} from "./deferred-workspaces";
import {loadPinnedTabs,type PinnedView} from "./pinned-tabs-settings";

type Project=V2Project;
type Deliverable={id?:string;name:string;type?:string;required?:boolean;status?:string;documentKind?:"document"|"drawing"};
type Task={id:string;wbsCode:string;parentId?:string|null;parentCode?:string|null;level:number;sortOrder:number;kind:"summary"|"task";name:string;taskType:"normal"|"gate";durationDays:number;plannedStart?:string;plannedEnd?:string;predecessorCode?:string;roleCode?:string;assigneeUserId?:string;assigneeName?:string;completionActor?:string;completionCriteria?:string;progress:number;status:string;deliverables:Deliverable[];issueCount?:number;draft?:boolean};
type BaselineTask={taskId:string;wbsCode:string;name:string;plannedStart?:string;plannedEnd?:string;durationDays:number;sortOrder:number};
type BaselineData={baseline:null|{id:string;version:number;name:string;capturedAt:number};tasks:BaselineTask[];summary:{changed:number;delayed:number;ahead:number;maxDelayDays:number}};
type WorkView="list"|"timeline"|"gantt"|"kanban"|"calendar"|"edit";
type PanelTab="detail"|"actual"|"deliverable"|"issue"|"gate"|"history"|"ai"|"filter";
type DeliverableRegistrationRequest={key:number;mode:"deliverable"|"drawing";deliverableId?:string;projectId?:string;taskId?:string;standalone?:boolean};
type WorkspaceView="portfolio"|"projects"|"dashboard"|"edit-project"|"create-project"|"templates"|"template-editor"|"workflow-templates"|"wbs"|"documents"|"product-data"|"bom-compare"|"cost"|"workflows"|"create-workflow"|"ecr"|"create-ecr"|"quality"|"create-quality"|"issues"|"reports"|"my-work"|"my-ai"|"settings"|"artifact-preview";
const workspaceLabels:Record<WorkspaceView,string>={portfolio:"전사 대시보드",projects:"프로젝트 목록",dashboard:"프로젝트 대시보드","edit-project":"프로젝트 정보 수정","create-project":"새 프로젝트",templates:"프로젝트 템플릿","template-editor":"템플릿 편집","workflow-templates":"워크플로우 템플릿",wbs:"일정 · WBS",documents:"문서 · 산출물","product-data":"PART · BOM","bom-compare":"BOM 비교",cost:"원가 관리",workflows:"워크플로우","create-workflow":"새 워크플로우",ecr:"설계변경","create-ecr":"새 설계변경",quality:"품질관리","create-quality":"새 품질문제",issues:"이슈 · 리스크",reports:"보고 · 회의","my-work":"MY WORK","my-ai":"MY AI HOME",settings:"시스템 설정","artifact-preview":"AI 결과 미리보기"};
type WorkspaceTab={key:string;view:WorkspaceView;entityId?:string;editId?:string;title:string};
const genericWorkspaceTab=(view:WorkspaceView):WorkspaceTab=>({key:view,view,title:workspaceLabels[view]});
type SearchResult={id:string;kind:"project"|"task"|"document"|"issue";projectId:string;taskId?:string;eyebrow:string;title:string;meta:string};
type DashboardNotification={kind:"review"|"delayed"|"deliverable";taskId:string;projectId:string;projectCode:string;projectName:string;wbsCode:string;title:string;dueDate?:string;message:string;createdAt:number};
type ProjectRole={code:string;name:string;sortOrder?:number};
type ProjectMember={userId:string;name:string;email?:string;projectRole:string;assignedTaskCount?:number};
type SessionUser={id:string;name:string;email?:string;avatarKey?:string;systemRoles:string[]};
type SortKey="order"|"name"|"start"|"end"|"progress"|"status";
type FilterState={statuses:string[];assignee:string;flags:string[];levels:number[]};
type ColumnKey="type"|"start"|"end"|"assignee"|"deliverables"|"issues"|"progress"|"status"|"actual";

const viewTabs:[WorkView,string,ComponentType<{size?:number}>][]=[
  ["list","목록",List],["timeline","타임라인",ChartNoAxesGantt],["gantt","간트",GanttChartSquare],
  ["kanban","칸반",Columns3],["calendar","캘린더",CalendarDays],["edit","WBS 편집",Table2],
];
const panelTabs:[PanelTab,string][]=[["detail","상세"],["actual","실적"],["deliverable","산출물"],["issue","이슈·협업"],["gate","Gate"],["history","이력"],["ai","AI 대화"]];
const statusLabel=(status:string)=>status==="completed"?"완료":status==="review"?"완료 검토":status==="active"?"진행 중":status==="hold"?"보류":status==="stopped"?"중단":status==="preparing"?"준비 중":"예정";
const completionLabels:Record<string,string>={PROGRESS:"진척 완료",REQUIRED_UPLOAD:"필수 등록",REQUIRED_APPROVAL:"필수 승인",CHILD_COMPLETE:"하위 완료",GATE_APPROVAL:"Gate 승인",OWNER_CONFIRM:"담당 확인"};
const completionCriteriaLabel=(value?:string)=>{const labels=(value||"").split(",").map(code=>completionLabels[code.trim()]).filter(Boolean);return labels.length?labels.join(" · "):value||"등록된 완료 조건이 없습니다."};
const isoShort=(value?:string)=>value?value.slice(5).replace("-","."):"미정";
const DAY=86_400_000;
const parseDay=(value?:string)=>value?Date.parse(`${value}T00:00:00Z`):Number.NaN;
const isTaskDelayed=(task:Pick<Task,"status"|"progress"|"plannedEnd">)=>task.status!=="completed"&&task.progress<100&&Number.isFinite(parseDay(task.plannedEnd))&&parseDay(task.plannedEnd)<parseDay(new Date().toISOString().slice(0,10));
const formatDay=(value:number)=>new Date(value).toISOString().slice(0,10);
const addDays=(value:number,days:number)=>value+days*DAY;
const recalculateSchedule=(source:Task[])=>{const next=source.map(task=>({...task}));const byCode=new Map(next.map(task=>[task.wbsCode,task]));for(let pass=0;pass<next.length;pass++){let changed=false;for(const task of next){if(task.kind==="summary")continue;const predecessor=task.predecessorCode?byCode.get(task.predecessorCode):undefined;const plannedStart=task.plannedStart?toBusinessDate(task.plannedStart):undefined;const dependencyStart=predecessor?.plannedEnd?nextBusinessDate(predecessor.plannedEnd):undefined;const start=plannedStart&&dependencyStart?(plannedStart>dependencyStart?plannedStart:dependencyStart):plannedStart||dependencyStart;if(start){const end=endFromDuration(start,task.durationDays);if(task.plannedStart!==start||task.plannedEnd!==end){task.plannedStart=start;task.plannedEnd=end;changed=true}}}if(!changed)break}for(let index=next.length-1;index>=0;index--){const group=next[index];if(group.kind!=="summary")continue;const children=next.slice(index+1).filter((item,childIndex)=>{const absolute=index+1+childIndex;if(item.level<=group.level)return false;return !next.slice(index+1,absolute).some(candidate=>candidate.level<=group.level)});const leaves=children.filter(item=>item.kind==="task");const starts=leaves.map(item=>item.plannedStart).filter(Boolean) as string[],ends=leaves.map(item=>item.plannedEnd).filter(Boolean) as string[];if(starts.length)group.plannedStart=starts.sort()[0];if(ends.length)group.plannedEnd=ends.sort().at(-1);if(leaves.length){group.durationDays=group.plannedStart&&group.plannedEnd?durationFromRange(group.plannedStart,group.plannedEnd):0;group.progress=Math.round(leaves.reduce((sum,item)=>sum+item.progress,0)/leaves.length);group.status=leaves.every(item=>item.status==="completed")?"completed":leaves.some(item=>item.status==="active"||item.progress>0)?"active":leaves.some(item=>item.status==="hold")?"hold":"planned"}}return next};
const normalizeHierarchy=(source:Task[])=>{const counters=[0,0,0,0,0],stack:Task[]=[];const next=source.map((task,index)=>{const level=Math.max(1,Math.min(5,index===0?1:Math.min(task.level,(source[index-1]?.level||1)+1)));counters[level-1]++;for(let cursor=level;cursor<5;cursor++)counters[cursor]=0;const copy={...task,level,sortOrder:index,wbsCode:counters.slice(0,level).join("."),parentId:level>1?stack[level-2]?.id||null:null};stack[level-1]=copy;stack.length=level;return copy});for(let index=0;index<next.length;index++)next[index].kind=Boolean(next[index+1]&&next[index+1].level>next[index].level)?"summary":"task";return recalculateSchedule(next)};
const defaultFilter:FilterState={statuses:[],assignee:"",flags:[],levels:[]};
const defaultColumns:ColumnKey[]=["type","start","end","assignee","deliverables","issues","progress","status","actual"];
const taskRange=(tasks:Array<{plannedStart?:string;plannedEnd?:string}>)=>{
  const values=tasks.flatMap(task=>[parseDay(task.plannedStart),parseDay(task.plannedEnd)]).filter(Number.isFinite);
  const start=values.length?Math.min(...values):Date.now();
  const end=values.length?Math.max(...values):addDays(start,28);
  return {start,end:Math.max(end,addDays(start,1)),days:Math.max(1,Math.ceil((Math.max(end,addDays(start,1))-start)/DAY)+1)};
};
const issueCountFor=(task:Task,tasks:Task[])=>task.kind==="summary"?tasks.filter(candidate=>candidate.kind==="task"&&candidate.wbsCode.startsWith(`${task.wbsCode}.`)).reduce((sum,candidate)=>sum+Number(candidate.issueCount||0),0):Number(task.issueCount||0);

export default function NewWorkViewApp(){
  const [sessionUser,setSessionUser]=useState<SessionUser|null>(null);
  const [projects,setProjects]=useState<Project[]>([]);
  const [project,setProject]=useState<Project|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [roles,setRoles]=useState<ProjectRole[]>([]);const [members,setMembers]=useState<ProjectMember[]>([]);const [membersOpen,setMembersOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState("");
  const [view,setView]=useState<WorkView>("list");
  const [contextOpen,setContextOpen]=useState(true);
  const [selectedId,setSelectedId]=useState("");
  const [panelOpen,setPanelOpen]=useState(false);
  const [panelTab,setPanelTab]=useState<PanelTab>("detail");
  const [panelWide,setPanelWide]=useState(true);
  const [query,setQuery]=useState("");
  const [globalOpen,setGlobalOpen]=useState(false);
  const [globalQuery,setGlobalQuery]=useState("");
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [filters,setFilters]=useState<FilterState>(defaultFilter);
  const [workspaceFilter,setWorkspaceFilter]=useState<WorkspaceFilterConfig|null>(null);
  const [deliverableRegistrationRequest,setDeliverableRegistrationRequest]=useState<DeliverableRegistrationRequest|null>(null);
  const [sortKey,setSortKey]=useState<SortKey>("order");
  const [sortDirection,setSortDirection]=useState<"asc"|"desc">("asc");
  const [visibleColumns,setVisibleColumns]=useState<Set<ColumnKey>>(new Set(defaultColumns));
  const [toolbarMenu,setToolbarMenu]=useState<"sort"|"columns"|null>(null);
  const [saving,setSaving]=useState(false);
  const [saveNotice,setSaveNotice]=useState("");
  const [statusSaving,setStatusSaving]=useState(false);
  const [statusNotice,setStatusNotice]=useState("");
  const [workspaceView,setWorkspaceViewState]=useState<WorkspaceView>("my-work");
  const [workspaceTabs,setWorkspaceTabs]=useState<WorkspaceTab[]>([genericWorkspaceTab("my-work")]);
  const [activeWorkspaceTab,setActiveWorkspaceTab]=useState("my-work");
  const [pinnedWorkspaceViews,setPinnedWorkspaceViews]=useState<PinnedView[]>(["my-work"]);
  const logoutInProgress=useRef(false);
  const [templateEditorId,setTemplateEditorId]=useState<string|undefined>(undefined);
  const [tabsReady,setTabsReady]=useState(false);
  const [preferencesReady,setPreferencesReady]=useState(false);
  const [pendingTask,setPendingTask]=useState<{projectId:string;taskId:string;tab:PanelTab}|null>(null);
  const [issueProjectPreset,setIssueProjectPreset]=useState("");
  const [myWorkScope,setMyWorkScope]=useState<MyWorkScope>("all");
  const [notifications,setNotifications]=useState<DashboardNotification[]>([]);const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [aiDraft,setAiDraft]=useState<AiDraftRequest|null>(null);
  const [artifactPreview,setArtifactPreview]=useState<ArtifactPreviewData|null>(null);
  const [approvedDeliverableId,setApprovedDeliverableId]=useState("");
  const [pendingWorkflowDetail,setPendingWorkflowDetail]=useState<{view:"workflows"|"ecr"|"quality";id:string}|null>(null);
  const [baseline,setBaseline]=useState<BaselineData>({baseline:null,tasks:[],summary:{changed:0,delayed:0,ahead:0,maxDelayDays:0}});
  const [baselineRefresh,setBaselineRefresh]=useState(0);
  const [confirmDialog,setConfirmDialog]=useState<{title:string;message:string;danger?:boolean}|null>(null);
  const confirmResolver=useRef<((value:boolean)=>void)|null>(null);
  const askConfirm=(title:string,message:string,danger=false)=>new Promise<boolean>(resolve=>{confirmResolver.current=resolve;setConfirmDialog({title,message,danger})});
  const closeConfirm=(value:boolean)=>{confirmResolver.current?.(value);confirmResolver.current=null;setConfirmDialog(null)};
  const openWorkspaceTab=(tab:WorkspaceTab)=>{setWorkspaceTabs(current=>current.some(item=>item.key===tab.key)?current:[...current,tab]);setActiveWorkspaceTab(tab.key);setWorkspaceViewState(tab.view)};
  const openBomCompare=(leftRootId:string,rightRootId?:string)=>{if(!leftRootId)return;const key=`bom-compare:${leftRootId}${rightRootId?`:${rightRootId}`:""}`;openWorkspaceTab({key,view:"bom-compare",entityId:leftRootId,editId:rightRootId,title:"BOM 비교"})};
  const setWorkspaceView=(next:WorkspaceView)=>{if(next==="issues")setIssueProjectPreset("");if(next==="wbs"&&project){openWorkspaceTab({key:`wbs:${project.id}`,view:"wbs",entityId:project.id,title:`WBS · ${project.name}`});return}openWorkspaceTab(genericWorkspaceTab(next))};
  const openTemplateEditor=(templateId?:string,templateName="새 템플릿")=>{const key=templateId?`template-editor:${templateId}`:`template-editor:new-${Date.now()}`;setTemplateEditorId(templateId);openWorkspaceTab({key,view:"template-editor",entityId:templateId,title:`템플릿 · ${templateName}`})};
  const openCreateWorkspace=(view:"create-workflow"|"create-ecr"|"create-quality",initialProjectId="")=>openWorkspaceTab({key:view,view,entityId:initialProjectId||undefined,title:workspaceLabels[view]});
  const openEditWorkspace=(view:"create-workflow"|"create-ecr"|"create-quality",editId:string)=>openWorkspaceTab({key:`${view}:${editId}`,view,editId,title:view==="create-workflow"?"워크플로우 수정":view==="create-ecr"?"설계변경 수정":"품질문제 수정"});
  const finishCreateWorkspace=(createView:"create-workflow"|"create-ecr"|"create-quality",listView:"workflows"|"ecr"|"quality",workflowId?:string)=>{const listTab=genericWorkspaceTab(listView),closingKey=workspaceTabs.find(item=>item.key===activeWorkspaceTab&&item.view===createView)?.key||createView;setWorkspaceTabs(current=>{const remaining=current.filter(item=>item.key!==closingKey);return remaining.some(item=>item.key===listTab.key)?remaining:[...remaining,listTab]});setActiveWorkspaceTab(listTab.key);setWorkspaceViewState(listView);if(workflowId)setPendingWorkflowDetail({view:listView,id:workflowId})};
  const activateWorkspaceTab=(tab:WorkspaceTab)=>{setActiveWorkspaceTab(tab.key);setWorkspaceViewState(tab.view);if(tab.view==="template-editor")setTemplateEditorId(tab.entityId);if(tab.view==="wbs"&&tab.entityId){const next=projects.find(item=>item.id===tab.entityId);if(next)setProject(next)}};

  useEffect(()=>{const controller=new AbortController();fetch("/api/session",{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);setSessionUser(data.user??null)}).catch(()=>{if(!controller.signal.aborted)setSessionUser(null)});return()=>controller.abort()},[]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setGlobalOpen(true)}};
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[]);
  useEffect(()=>{
    const openArtifact=(event:Event)=>{const detail=(event as CustomEvent<ArtifactPreviewData>).detail;if(!detail?.type||!detail.content)return;setArtifactPreview(detail);setWorkspaceView("artifact-preview")};
    window.addEventListener("jsolution-ai-artifact-preview",openArtifact);
    return()=>window.removeEventListener("jsolution-ai-artifact-preview",openArtifact);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    const applyPinned=(next:PinnedView[])=>{
      setPinnedWorkspaceViews(next);
      const pinnedTabs=next.map(view=>genericWorkspaceTab(view as WorkspaceView));
      const pinnedViews=new Set(next);
      setWorkspaceTabs(current=>[...pinnedTabs,...current.filter(item=>!pinnedViews.has(item.view as PinnedView))]);
    };
    Promise.all([
      loadPinnedTabs(),
      fetch("/api/state?key=v2-workspace-tabs",{cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():{}),
    ]).then(([pinned,{value}]:[PinnedView[],{value?:{tabs?:Array<WorkspaceTab|WorkspaceView>;active?:string;templateEditorId?:string}}])=>{
      if(!active)return;
      setPinnedWorkspaceViews(pinned);
      if(typeof value?.templateEditorId==="string")setTemplateEditorId(value.templateEditorId);
      const pinnedTabs=pinned.map(view=>genericWorkspaceTab(view as WorkspaceView));
      const pinnedKeys=new Set(pinnedTabs.map(item=>item.key));
      const restored=(value?.tabs??[]).map(item=>typeof item==="string"&&item in workspaceLabels?genericWorkspaceTab(item as WorkspaceView):typeof item==="object"&&item&&item.view in workspaceLabels?(item.key===item.view?genericWorkspaceTab(item.view as WorkspaceView):item):null).filter((item):item is WorkspaceTab=>Boolean(item)).filter(item=>item.view!=="portfolio"&&!pinnedKeys.has(item.key));
      const normalized=[...pinnedTabs,...restored];
      const requested=typeof value?.active==="string"?value.active:"";
      const nextActive=normalized.find(item=>item.key===requested)??normalized[0]??genericWorkspaceTab("my-work");
      setWorkspaceTabs(normalized.length?normalized:[genericWorkspaceTab("my-work")]);
      setActiveWorkspaceTab(nextActive.key);
      setWorkspaceViewState(nextActive.view);
    }).catch(()=>{}).finally(()=>{if(active&&!controller.signal.aborted)setTabsReady(true)});
    const onPinnedChanged=(event:Event)=>{
      const next=(event as CustomEvent<PinnedView[]>).detail;
      if(Array.isArray(next)&&next.length)applyPinned(next);
    };
    window.addEventListener("v2-pinned-tabs-changed",onPinnedChanged);
    return()=>{active=false;controller.abort();window.removeEventListener("v2-pinned-tabs-changed",onPinnedChanged)};
  },[]);
  useEffect(()=>{if(!tabsReady||logoutInProgress.current)return;const timer=window.setTimeout(()=>{void fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:"v2-workspace-tabs",value:{tabs:workspaceTabs,active:activeWorkspaceTab,templateEditorId}})}).catch(()=>undefined)},180);return()=>window.clearTimeout(timer)},[workspaceTabs,activeWorkspaceTab,templateEditorId,tabsReady]);
  useEffect(()=>{const controller=new AbortController();fetch("/api/state?key=v2-wbs-view-preferences",{cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(({value}:{value?:{filters?:FilterState;sortKey?:SortKey;sortDirection?:"asc"|"desc";columns?:ColumnKey[]}})=>{if(value?.filters)setFilters({...defaultFilter,...value.filters});if(value?.sortKey)setSortKey(value.sortKey);if(value?.sortDirection)setSortDirection(value.sortDirection);if(value?.columns?.length)setVisibleColumns(new Set(value.columns))}).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setPreferencesReady(true)});return()=>controller.abort()},[]);
  useEffect(()=>{if(!preferencesReady)return;const timer=window.setTimeout(()=>{void fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:"v2-wbs-view-preferences",value:{filters,sortKey,sortDirection,columns:Array.from(visibleColumns)}})}).catch(()=>undefined)},220);return()=>window.clearTimeout(timer)},[filters,sortKey,sortDirection,visibleColumns,preferencesReady]);
  const closeWorkspaceTab=(key:string)=>{const closing=workspaceTabs.find(item=>item.key===key);if(pinnedWorkspaceViews.includes(closing?.view as PinnedView))return;if(workspaceTabs.length===1)return;if(key==="my-work"||closing?.view==="my-work")setMyWorkScope("all");if(closing?.view==="wbs"){setQuery("");setFilters({...defaultFilter,statuses:[],flags:[],levels:[]});setSortKey("order");setSortDirection("asc");setSelectedId("");setCollapsed(new Set());setPanelOpen(false);setPanelTab("detail");setPanelWide(true);setWorkspaceFilter(null);setToolbarMenu(null);setPendingTask(null);setAiDraft(null)}if(closing?.view==="issues"){setIssueProjectPreset("");setWorkspaceFilter(null);setPanelOpen(false);setSelectedId("");void fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:"v2-issues-workspace-state:all",value:{query:"",projectFilter:"all",typeFilter:"all",statusFilter:"all",filters:{severities:[],owner:"",dueFrom:"",dueTo:"",attachments:""}}})}).catch(()=>undefined)}const index=workspaceTabs.findIndex(item=>item.key===key),next=workspaceTabs.filter(item=>item.key!==key);setWorkspaceTabs(next);if(activeWorkspaceTab===key)activateWorkspaceTab(next[Math.max(0,index-1)]??next[0]??genericWorkspaceTab("projects"))};
  useEffect(()=>{const active=workspaceTabs.find(item=>item.key===activeWorkspaceTab);if(active?.view!=="wbs"||!active.entityId||!projects.length)return;const next=projects.find(item=>item.id===active.entityId);if(next&&next.id!==project?.id)setProject(next)},[projects,activeWorkspaceTab]);
  useEffect(()=>{if(workspaceView!=="wbs"||!project)return;const active=workspaceTabs.find(item=>item.key===activeWorkspaceTab);if(active?.view==="wbs"&&active.entityId&&active.entityId!==project.id)return;const key=`wbs:${project.id}`;if(activeWorkspaceTab===key)return;const tab={key,view:"wbs" as const,entityId:project.id,title:`WBS · ${project.name}`};setWorkspaceTabs(current=>{const withoutPlaceholder=current.filter(item=>item.key!=="wbs");return withoutPlaceholder.some(item=>item.key===key)?withoutPlaceholder:[...withoutPlaceholder,tab]});setActiveWorkspaceTab(key)},[workspaceView,project?.id]);
  useEffect(()=>{const controller=new AbortController();const apply=(calendar:BusinessCalendar)=>{setActiveBusinessCalendar(calendar);setTasks(current=>recalculateSchedule(current))};const load=()=>fetch("/api/system/calendar",{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error();return data.calendar as BusinessCalendar}).then(apply).catch(()=>{if(!controller.signal.aborted)setActiveBusinessCalendar()});const onUpdated=(event:Event)=>apply((event as CustomEvent<BusinessCalendar>).detail);void load();window.addEventListener("v2-business-calendar-updated",onUpdated);return()=>{controller.abort();window.removeEventListener("v2-business-calendar-updated",onUpdated)}},[]);
  useEffect(()=>{const controller=new AbortController();fetch("/api/dashboard",{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error();setNotifications(data.notifications??[])}).catch(()=>{if(!controller.signal.aborted)setNotifications([])});return()=>controller.abort()},[]);
  const loadProjects=(preferredId?:string)=>{
    setLoading(true);
    fetch("/api/projects",{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error();return response.json()}).then((data:{projects?:Project[]})=>{
      const next=data.projects??[];setProjects(next);setProject(current=>next.find(item=>item.id===preferredId)??next.find(item=>item.id===current?.id)??next[0]??null);setLoadError("");
    }).catch(()=>{setProjects([]);setProject(null);setTasks([]);setLoadError("프로젝트 데이터를 불러오지 못했습니다.")}).finally(()=>setLoading(false));
  };
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/projects",{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();return response.json()}).then((data:{projects?:Project[]})=>{
      const next=data.projects??[];setProjects(next);setProject(next[0]??null);setLoadError("");
    }).catch(error=>{if(error instanceof DOMException&&error.name==="AbortError")return;setProjects([]);setProject(null);setTasks([]);setLoadError("프로젝트 데이터를 불러오지 못했습니다.")}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(!project?.id)return;
    const controller=new AbortController();
    fetch(`/api/projects/${project.id}/wbs`,{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();return response.json()}).then((data:{tasks?:Task[];roles?:ProjectRole[];members?:ProjectMember[]})=>{
      const next=recalculateSchedule(data.tasks??[]);const preferred=pendingTask?.projectId===project.id&&next.some(item=>item.id===pendingTask.taskId)?pendingTask.taskId:"";setTasks(next);queueMicrotask(()=>window.dispatchEvent(new CustomEvent("v2-project-issues-updated",{detail:{projectId:project.id}})));setRoles(data.roles??[]);setMembers(data.members??[]);setSelectedId(preferred||next.find(item=>item.kind==="task")?.id||next[0]?.id||"");if(preferred){setPanelTab(pendingTask!.tab);setPanelOpen(true);setPendingTask(null)}setLoadError("");
    }).catch(error=>{if(error instanceof DOMException&&error.name==="AbortError")return;setTasks([]);setSelectedId("");setLoadError("WBS 데이터를 불러오지 못했습니다.")}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[project?.id]);
  useEffect(()=>{if(!project?.id){setBaseline({baseline:null,tasks:[],summary:{changed:0,delayed:0,ahead:0,maxDelayDays:0}});return}const controller=new AbortController();fetch(`/api/projects/${project.id}/baseline`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error();setBaseline({baseline:data.baseline??null,tasks:data.tasks??[],summary:data.summary??{changed:0,delayed:0,ahead:0,maxDelayDays:0}})}).catch(error=>{if(!(error instanceof DOMException&&error.name==="AbortError"))setBaseline({baseline:null,tasks:[],summary:{changed:0,delayed:0,ahead:0,maxDelayDays:0}})});return()=>controller.abort()},[project?.id,project?.status,baselineRefresh]);
  useEffect(()=>{
    if(!project?.id)return;let active=true;
    const refresh=()=>fetch(`/api/projects/${project.id}/issues`,{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error();return (data.issues??[]) as Array<{taskId?:string;status:string}>}).then(issues=>{if(!active)return;const counts=new Map<string,number>();for(const issue of issues)if(issue.taskId&&!['resolved','closed'].includes(issue.status))counts.set(issue.taskId,(counts.get(issue.taskId)||0)+1);setTasks(current=>current.map(task=>({...task,issueCount:counts.get(task.id)||0}))) }).catch(()=>undefined);
    const onUpdated=(event:Event)=>{const detail=(event as CustomEvent<{projectId?:string}>).detail;if(!detail?.projectId||detail.projectId===project.id)void refresh()};
    void refresh();window.addEventListener("v2-project-issues-updated",onUpdated);return()=>{active=false;window.removeEventListener("v2-project-issues-updated",onUpdated)};
  },[project?.id]);

  const selected=project?(tasks.find(task=>task.id===selectedId)??tasks[0]):undefined;
  useEffect(()=>{if(workspaceView!=="wbs"||!selectedId)return;const frame=window.requestAnimationFrame(()=>{document.querySelector<HTMLElement>(".wv2-table tr.selected")?.scrollIntoView({block:"center",behavior:"smooth"})});return()=>window.cancelAnimationFrame(frame)},[workspaceView,activeWorkspaceTab,selectedId]);
  const visible=useMemo(()=>{const keyword=query.trim().toLowerCase(),today=new Date().toISOString().slice(0,10);const matched=new Set(tasks.filter(task=>{if(keyword&&!`${task.wbsCode} ${task.name} ${task.assigneeName??""} ${task.roleCode??""}`.toLowerCase().includes(keyword))return false;if(filters.statuses.length&&!filters.statuses.includes(task.status))return false;if(filters.assignee&&!`${task.assigneeName??""} ${task.roleCode??""}`.toLowerCase().includes(filters.assignee.toLowerCase()))return false;if(filters.levels.length&&!filters.levels.includes(task.level)&&!(filters.levels.includes(0)&&task.kind==="task"))return false;if(filters.flags.includes("delayed")&&!(task.status!=="completed"&&Boolean(task.plannedEnd)&&task.plannedEnd!<today))return false;if(filters.flags.includes("unassigned")&&Boolean(task.assigneeUserId))return false;if(filters.flags.includes("no-deliverable")&&task.deliverables.length>0)return false;if(filters.flags.includes("no-actual")&&task.progress>0)return false;return true}).map(task=>task.id));tasks.forEach((task,index)=>{if(!matched.has(task.id))return;let level=task.level;for(let cursor=index-1;cursor>=0&&level>1;cursor--){if(tasks[cursor].level<level){matched.add(tasks[cursor].id);level=tasks[cursor].level}}});const allowed=tasks.filter((task,index)=>matched.has(task.id)&&!tasks.slice(0,index).some(parent=>parent.level<task.level&&collapsed.has(parent.id)&&task.wbsCode.startsWith(`${parent.wbsCode}.`)));if(sortKey==="order")return sortDirection==="asc"?allowed:[...allowed].reverse();const value=(task:Task)=>sortKey==="name"?task.name.toLowerCase():sortKey==="start"?task.plannedStart||"9999":sortKey==="end"?task.plannedEnd||"9999":sortKey==="progress"?task.progress:task.status;const compare=(a:Task,b:Task)=>{const av=value(a),bv=value(b);return (av<bv?-1:av>bv?1:0)*(sortDirection==="asc"?1:-1)};const byParent=new Map<string,Task[]>();for(const task of allowed){const key=task.parentId&&matched.has(task.parentId)?task.parentId:"root";byParent.set(key,[...(byParent.get(key)||[]),task])}const output:Task[]=[];const append=(key:string)=>{for(const item of [...(byParent.get(key)||[])].sort(compare)){output.push(item);append(item.id)}};append("root");return output.length===allowed.length?output:[...allowed].sort(compare)},[tasks,query,collapsed,filters,sortKey,sortDirection]);
  const progress=Math.round(tasks.reduce((sum,task)=>sum+Number(task.progress||0),0)/Math.max(1,tasks.length));

  const openPanel=(tab:PanelTab,id=selectedId)=>{if(id)setSelectedId(id);if(!id&&tab!=="ai"&&tab!=="filter")return;if(workspaceFilter)workspaceFilter.onCancel();setWorkspaceFilter(null);setPanelTab(tab);setPanelOpen(true)};
  const openReportAi=(request:ReportAiRequest)=>{setSelectedId("");setAiDraft({key:Date.now(),...request});setPanelTab("ai");setPanelOpen(true)};
  const openWorkspaceFilter=useCallback((config:WorkspaceFilterConfig)=>{const finish=(action:"apply"|"cancel")=>{if(action==="apply")config.onApply();else config.onCancel();setWorkspaceFilter(null);setPanelOpen(false)};setWorkspaceFilter({...config,onApply:()=>finish("apply"),onCancel:()=>finish("cancel")});setPanelTab("filter");setPanelOpen(true)},[]);
  const openPortfolioProjectList=(preset:PortfolioProjectPreset)=>{const filters={statuses:preset.statuses??[],partnerIds:preset.partnerIds??[],projectTypeIds:[],pmQuery:"",assigneeQuery:"",currentGates:[],passedGates:preset.passedGates??[],attention:preset.attention??"",startDate:"",endDate:""};void fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:"v2-project-list-filter",value:{query:"",sortKey:preset.attention==="delayed"?"delayed":"updated",filters}})}).catch(()=>undefined).finally(()=>setWorkspaceView("projects"))};
  const closePanel=()=>{if(panelTab==="filter"&&workspaceFilter)workspaceFilter.onCancel();setWorkspaceFilter(null);setDeliverableRegistrationRequest(null);setPanelOpen(false)};
  const openWorkspaceTask=(projectId:string,taskId:string,tab:PanelTab="actual",keepWorkspace=false)=>{const next=projects.find(item=>item.id===projectId);if(!next||!taskId)return;setView("list");if(!keepWorkspace)openWorkspaceTab({key:`wbs:${next.id}`,view:"wbs",entityId:next.id,title:`WBS · ${next.name}`});if(next.id===project?.id&&tasks.some(item=>item.id===taskId)){setSelectedId(taskId);setPanelTab(tab);setPanelOpen(true);setPendingTask(null);return}setPendingTask({projectId,taskId,tab});setProject(next)};
  const openDeliverableRegistration=(projectId="",taskId="",mode:"deliverable"|"drawing"="deliverable",deliverableId?:string,standalone=false)=>{const request={key:Date.now(),mode,deliverableId,projectId,taskId,standalone};setDeliverableRegistrationRequest(request);if(standalone){setSelectedId("");setWorkspaceFilter(null);setPanelTab("deliverable");setPanelOpen(true);return}openWorkspaceTask(projectId,taskId,"deliverable",true)};
  const openSearchResult=(result:SearchResult)=>{const next=projects.find(item=>item.id===result.projectId);if(next)setProject(next);setGlobalOpen(false);if(result.kind==="project"){setWorkspaceView("wbs");return}if(result.kind==="document"&&!result.taskId){setWorkspaceView("documents");return}if(result.kind==="issue"&&!result.taskId){setWorkspaceView("issues");return}if(result.taskId)openWorkspaceTask(result.projectId,result.taskId,result.kind==="document"?"deliverable":result.kind==="issue"?"issue":"detail")};
  const selectTask=(id:string)=>{setSelectedId(id);setPanelTab("detail");setPanelOpen(true)};
  const addTask=(preset:Partial<Task>={})=>{
    if(!project)return;
    const nextNumber=String(Math.max(0,...tasks.map(task=>Number(task.wbsCode.split(".")[0])||0))+1);
    const next:Task={id:`draft-${Date.now()}`,wbsCode:nextNumber,level:1,sortOrder:tasks.length,kind:"task",name:"새 업무",taskType:"normal",durationDays:1,plannedStart:preset.plannedStart??project.startDate,plannedEnd:preset.plannedEnd??preset.plannedStart??project.startDate,completionCriteria:"",progress:0,status:preset.status??"planned",deliverables:[],draft:true,...preset};
    setTasks(current=>normalizeHierarchy([...current,next]));setSelectedId(next.id);setPanelTab("detail");setPanelOpen(true);
  };
  const addRelatedTask=(id:string,child:boolean)=>{const parent=tasks.find(item=>item.id===id);if(!parent||!project)return;const index=tasks.findIndex(item=>item.id===id);let insert=index+1;while(insert<tasks.length&&tasks[insert].level>parent.level)insert++;const level=child?Math.min(5,parent.level+1):parent.level;const next:Task={id:`draft-${Date.now()}`,wbsCode:"",level,sortOrder:insert,kind:"task",name:"새 업무",taskType:"normal",durationDays:1,plannedStart:parent.plannedStart||project.startDate,plannedEnd:parent.plannedStart||project.startDate,completionCriteria:"",progress:0,status:"planned",deliverables:[],draft:true};setTasks(current=>normalizeHierarchy([...current.slice(0,insert),next,...current.slice(insert)]));setSelectedId(next.id)};
  const moveTask=(id:string,direction:-1|1)=>setTasks(current=>{const index=current.findIndex(item=>item.id===id);if(index<0)return current;const level=current[index].level;const start=index;let end=index+1;while(end<current.length&&current[end].level>level)end++;let target=-1;if(direction<0){for(let cursor=start-1;cursor>=0;cursor--)if(current[cursor].level===level){target=cursor;break}}else{for(let cursor=end;cursor<current.length;cursor++)if(current[cursor].level===level){let targetEnd=cursor+1;while(targetEnd<current.length&&current[targetEnd].level>level)targetEnd++;target=targetEnd;break}}if(target<0)return current;const block=current.slice(start,end),rest=[...current.slice(0,start),...current.slice(end)];const insert=direction<0?target:target-(end-start);return normalizeHierarchy([...rest.slice(0,insert),...block,...rest.slice(insert)])});
  const changeIndent=(id:string,delta:-1|1)=>setTasks(current=>{const index=current.findIndex(item=>item.id===id);if(index<0)return current;const task=current[index];if(delta>0&&(index===0||task.level>=5||current[index-1].level<task.level))return current;if(delta<0&&task.level<=1)return current;let end=index+1;while(end<current.length&&current[end].level>task.level)end++;const next=current.map((item,row)=>row>=index&&row<end?{...item,level:Math.max(1,Math.min(5,item.level+delta))}:item);return normalizeHierarchy(next)});
  const duplicateTasks=(ids:string[],includeChildren:boolean)=>setTasks(current=>{
    const selected=new Set(ids),roots=current.map((item,index)=>({item,index})).filter(({item})=>selected.has(item.id)).filter(({item,index})=>!current.slice(0,index).some((candidate,candidateIndex)=>selected.has(candidate.id)&&candidate.level<item.level&&!current.slice(candidateIndex+1,index+1).some(between=>between.level<=candidate.level)));
    if(!roots.length)return current;
    const insertions=new Map<number,Task[]>(),sourceCodeByClone=new Map<string,string|undefined>(),cloneIdBySourceCode=new Map<string,string>();
    roots.forEach(({item,index},rootIndex)=>{let end=index+1;if(includeChildren)while(end<current.length&&current[end].level>item.level)end++;const block=current.slice(index,end);const idMap=new Map(block.map((source,row)=>[source.id,`draft-copy-${Date.now()}-${rootIndex}-${row}`]));const clones=block.map(source=>{const id=idMap.get(source.id)!;cloneIdBySourceCode.set(source.wbsCode,id);sourceCodeByClone.set(id,source.predecessorCode);return {...source,id,wbsCode:"",parentId:null,parentCode:null,sortOrder:0,assigneeUserId:undefined,assigneeName:undefined,progress:0,status:"planned",deliverables:source.deliverables.map(output=>({...output,id:undefined})),draft:true}});insertions.set(end-1,[...(insertions.get(end-1)||[]),...clones])});
    const expanded=current.flatMap((item,index)=>[item,...(insertions.get(index)||[])]),normalized=normalizeHierarchy(expanded),codeById=new Map(normalized.map(item=>[item.id,item.wbsCode]));
    const result=normalized.map(item=>{if(!sourceCodeByClone.has(item.id))return item;const predecessorCloneId=cloneIdBySourceCode.get(sourceCodeByClone.get(item.id)||"");return {...item,predecessorCode:predecessorCloneId?codeById.get(predecessorCloneId):undefined}});
    const firstClone=result.find(item=>sourceCodeByClone.has(item.id));if(firstClone)queueMicrotask(()=>setSelectedId(firstClone.id));return recalculateSchedule(result);
  });
  const removeTask=async(id:string)=>{const task=tasks.find(item=>item.id===id);if(!task)return;const confirmed=await askConfirm("업무 삭제",`\'${task.name}\'${task.kind==="summary"?" 및 모든 하위 업무를":"를"} 삭제할까요?`,true);if(!confirmed)return;setTasks(current=>{const index=current.findIndex(item=>item.id===id);let end=index+1;while(end<current.length&&current[end].level>task.level)end++;return normalizeHierarchy([...current.slice(0,index),...current.slice(end)])});setSelectedId("")};
  const patchTask=(id:string,patch:Partial<Task>)=>setTasks(current=>{const changed=current.map(task=>{if(task.id!==id)return task;const next={...task,...patch};if(task.kind!=="summary"&&patch.plannedEnd&&task.plannedStart&&!patch.plannedStart&&!patch.durationDays)next.durationDays=durationFromRange(task.plannedStart,patch.plannedEnd);if(task.kind!=="summary"&&(patch.plannedStart||patch.durationDays)&&next.plannedStart)next.plannedEnd=endFromDuration(next.plannedStart,next.durationDays);return next});if(project?.id)queueMicrotask(()=>window.dispatchEvent(new CustomEvent("v2-project-data-updated",{detail:{projectId:project.id}})));return recalculateSchedule(changed)});
  const saveWbs=async()=>{
    if(!project||saving)return;
    setSaving(true);setSaveNotice("");
    const byCode=new Map(tasks.map(task=>[task.wbsCode,task]));
    const payload={tasks:tasks.map(task=>({
      id:task.draft?undefined:task.id,clientKey:task.id,wbsCode:task.wbsCode,level:task.level,name:task.name,
      taskType:task.taskType,durationDays:task.durationDays,plannedStart:task.plannedStart,plannedEnd:task.plannedEnd,
      predecessorClientKey:task.predecessorCode?byCode.get(task.predecessorCode)?.id:undefined,roleCode:task.roleCode,
      assigneeUserId:task.assigneeUserId,completionActor:task.completionActor,completionCriteria:task.completionCriteria,
      deliverables:task.deliverables,
    }))};
    try{
      const response=await fetch(`/api/projects/${project.id}/wbs`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||"WBS를 저장하지 못했습니다.");
      const refreshed=await fetch(`/api/projects/${project.id}/wbs`,{cache:"no-store"});
      if(!refreshed.ok)throw new Error("저장된 WBS를 다시 불러오지 못했습니다.");
      const data=await refreshed.json() as {tasks?:Task[]};
      const next=recalculateSchedule(data.tasks??[]);setTasks(next);setSelectedId(next.find(item=>item.kind==="task")?.id??next[0]?.id??"");setSaveNotice("저장했습니다.");
    }catch(error){setSaveNotice(error instanceof Error?error.message:"WBS를 저장하지 못했습니다.");}
    finally{setSaving(false)}
  };
  const changeProjectStatus=async(action:"start"|"stop"|"resume"|"complete"|"prepare",force=false)=>{if(!project||statusSaving)return;if(action==="prepare"&&!(await askConfirm("준비 상태 전환","프로젝트를 준비 상태로 전환할까요? 기존 실적·산출물과 Baseline은 유지되고 WBS 편집이 다시 활성화됩니다.")))return;const reason=action==="stop"?window.prompt("프로젝트 중단 사유를 입력해 주세요.")||"":"";if(action==="stop"&&!reason)return;setStatusSaving(true);setStatusNotice("");try{const response=await fetch(`/api/projects/${project.id}/status`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,force,reason})});const result=await response.json();if(!response.ok)throw new Error(result.error||"프로젝트 상태를 변경하지 못했습니다.");if(result.requiresConfirmation){const detail=(result.warnings??[]).slice(0,5).map((item:{message:string;taskName?:string})=>`• ${item.taskName?`${item.taskName}: `:""}${item.message}`).join("\n");if(await askConfirm("상태 변경 확인",`확인이 필요한 항목이 있습니다.\n${detail}\n그래도 계속할까요?`)){setStatusSaving(false);await changeProjectStatus(action,true)}return}const updated={...project,status:result.status};setProject(updated);setProjects(current=>current.map(item=>item.id===updated.id?updated:item));setStatusNotice(action==="start"?"프로젝트를 시작했습니다.":action==="resume"?"프로젝트를 재개했습니다.":action==="stop"?"프로젝트를 중단했습니다.":action==="prepare"?"준비 상태로 전환했습니다. WBS를 편집할 수 있습니다.":"프로젝트를 완료했습니다.");if(action==="prepare")setView("edit");if(action==="start")setView("list");window.setTimeout(()=>setStatusNotice(""),2400)}catch(reasonValue){setStatusNotice(reasonValue instanceof Error?reasonValue.message:"프로젝트 상태를 변경하지 못했습니다.")}finally{setStatusSaving(false)}};

  const activeWorkspace=workspaceTabs.find(item=>item.key===activeWorkspaceTab);

  return <main className={`wv2 ${contextOpen?"context-open":""} ${panelOpen?"panel-open":""}`}>
    <GlobalRail onSearch={()=>setGlobalOpen(true)} onView={setWorkspaceView} active={workspaceView} />
     {contextOpen&&<ContextNav project={project} projects={projects} user={sessionUser} active={workspaceView} onView={setWorkspaceView} onProject={next=>{setProject(next);setSelectedId("");setPanelOpen(false);if(workspaceView==="wbs")openWorkspaceTab({key:`wbs:${next.id}`,view:"wbs",entityId:next.id,title:`WBS · ${next.name}`})}} onClose={()=>setContextOpen(false)}/>} 
    <section className="wv2-workspace">
      <header className="wv2-topbar">
        <button className="wv2-nav-toggle" onClick={()=>setContextOpen(value=>!value)} aria-label="프로젝트 탐색 열기">{contextOpen?<PanelLeftClose size={18}/>:<ChevronRight size={18}/>}</button>
        <button className="wv2-global-trigger" onClick={()=>setGlobalOpen(true)}><Search size={18}/><span>프로젝트, 업무, 문서 통합검색</span><kbd>Ctrl K</kbd></button>
        <div className="wv2-top-actions"><div className="wv2-notification-wrap"><button className={notificationsOpen?"active":""} aria-label={`알림 ${notifications.length}건`} onClick={()=>setNotificationsOpen(value=>!value)}><Bell size={18}/>{notifications.length>0&&<span>{notifications.length>99?"99+":notifications.length}</span>}</button>{notificationsOpen&&<NotificationCenterV2 items={notifications} onClose={()=>setNotificationsOpen(false)} onOpen={item=>{setNotificationsOpen(false);openWorkspaceTask(item.projectId,item.taskId,item.kind==="review"?"actual":item.kind==="deliverable"?"deliverable":"detail")}}/>}</div><button className="wv2-ai-button" onClick={()=>openPanel("ai")}><Sparkles size={18}/><b>AI</b></button><button className="wv2-logout-button" onClick={async()=>{logoutInProgress.current=true;try{await fetch("/api/auth/logout",{method:"POST"})}finally{window.location.replace("/login")}}}>로그아웃</button><button className="wv2-avatar" aria-label="사용자 메뉴"><UserAvatar avatarKey={sessionUser?.avatarKey} name={sessionUser?.name||"사용자"} size={32}/></button></div>
      </header>
       <WorkspaceTabs tabs={workspaceTabs} active={activeWorkspaceTab} pinned={pinnedWorkspaceViews} onView={activateWorkspaceTab} onClose={closeWorkspaceTab}/>
      <section className="wv2-content">
        {workspaceView==="artifact-preview"&&(artifactPreview?<ArtifactPreviewView data={artifactPreview}/>:<div className="wv2-project-empty"><FileText size={34}/><h2>미리보기 결과가 없습니다.</h2></div>)}
        {workspaceView==="portfolio"&&<GatePortfolioDashboard projects={projects} onOpenProject={next=>{setProject(next);setWorkspaceView("dashboard")}} onOpenProjectList={openPortfolioProjectList}/>} 
        {workspaceView==="projects"&&<ProjectListWorkspace projects={projects} loading={loading} onCreate={()=>setWorkspaceView("create-project")} onOpen={next=>{setProject(next);setWorkspaceView("dashboard")}} onOpenFilter={openWorkspaceFilter}/>} 
        {workspaceView==="dashboard"&&<GateProjectDashboard project={project} tasks={tasks} onOpenTask={(taskId,tab="detail")=>openWorkspaceTask(project?.id||"",taskId,tab)} onNavigate={destination=>{if(destination==="gantt"){setView("gantt");setWorkspaceView("wbs");return}if(destination==="issues"){setIssueProjectPreset(project?.id||"");openWorkspaceTab(genericWorkspaceTab("issues"));return}setWorkspaceView(destination)}} onEdit={()=>setWorkspaceView("edit-project")} onAi={request=>{setAiDraft({key:Date.now(),...request});setPanelTab("ai");setPanelOpen(true)}}/>}
        {workspaceView==="edit-project"&&project&&<ProjectEditWorkspace project={project} onCancel={()=>setWorkspaceView("dashboard")} onSaved={next=>{const updated={...project,...next};setProject(updated);setProjects(current=>current.map(item=>item.id===next.id?updated:item));setWorkspaceView("dashboard")}}/>}
        {workspaceView==="create-project"&&<ProjectCreateWorkspace onCancel={()=>setWorkspaceView("projects")} onCreated={next=>{setProject(next);setProjects(current=>[next,...current.filter(item=>item.id!==next.id)]);setWorkspaceView("wbs");loadProjects(next.id)}}/>}
         {workspaceView==="templates"&&<TemplateWorkspace onBack={()=>setWorkspaceView("projects")} onOpenEditor={openTemplateEditor}/>} 
         {workspaceTabs.filter(tab=>tab.view==="template-editor").map(tab=><div key={tab.key} hidden={activeWorkspaceTab!==tab.key}><TemplateWorkspace editorOnly initialTemplateId={tab.entityId} onBack={()=>setWorkspaceView("templates")} onCloseEditor={()=>closeWorkspaceTab(tab.key)}/></div>)} 
        {workspaceView==="workflow-templates"&&<WorkflowTemplateWorkspace/>}
        {workspaceView==="my-work"&&(myWorkScope==="workflow"?<MyWorkWorkflowWorkspace onBack={()=>setMyWorkScope("all")} onOpenFilter={openWorkspaceFilter}/>:<FilteredMyWorkWorkspace scope={myWorkScope} onScopeChange={setMyWorkScope} onOpenTask={(projectId,taskId,panel="actual")=>openWorkspaceTask(projectId,taskId,panel)} onOpenFilter={openWorkspaceFilter}/>)} 
        {workspaceView==="documents"&&<PreviewDocumentsWorkspace project={project} projects={projects} tasks={tasks} initialDeliverableId={approvedDeliverableId} onInitialOpened={()=>setApprovedDeliverableId("")} onOpenTask={(projectId,taskId)=>openWorkspaceTask(projectId,taskId,"deliverable")} onAddDeliverable={(projectId,taskId,mode,deliverableId)=>openDeliverableRegistration(projectId,taskId,mode,deliverableId,true)} onOpenFilter={openWorkspaceFilter}/>} 
        {workspaceView==="product-data"&&<PartBomWorkspace onOpenBomCompare={openBomCompare}/>} 
        {workspaceView==="bom-compare"&&activeWorkspace&&<BomCompareWorkspace initialLeftRootId={activeWorkspace.entityId||""} initialRightRootId={activeWorkspace.editId} onClose={()=>closeWorkspaceTab(activeWorkspace.key)}/>} 
        {workspaceView==="cost"&&<CostManagementWorkspace/>}
        {workspaceView==="workflows"&&<ProjectWorkflowWorkspace projects={projects} onCreate={projectId=>openCreateWorkspace("create-workflow",projectId)} onEdit={id=>openEditWorkspace("create-workflow",id)} initialDetailId={pendingWorkflowDetail?.view==="workflows"?pendingWorkflowDetail.id:""} onInitialDetailOpened={()=>setPendingWorkflowDetail(null)} onOpenDocuments={deliverableId=>{setApprovedDeliverableId(deliverableId);setWorkspaceView("documents")}} onOpenFilter={openWorkspaceFilter}/>} 
        {workspaceView==="create-workflow"&&<WorkflowCreateWorkspace projects={projects} initialProjectId={workspaceTabs.find(item=>item.key===activeWorkspaceTab)?.entityId||""} editId={workspaceTabs.find(item=>item.key===activeWorkspaceTab)?.editId} onCancel={()=>finishCreateWorkspace("create-workflow","workflows")} onCreated={workflowId=>finishCreateWorkspace("create-workflow","workflows",workflowId)}/>} 
        {workspaceView==="ecr"&&<EcrWorkspace projects={projects} onCreate={projectId=>openCreateWorkspace("create-ecr",projectId)} onEdit={id=>openEditWorkspace("create-ecr",id)} initialDetailId={pendingWorkflowDetail?.view==="ecr"?pendingWorkflowDetail.id:""} onInitialDetailOpened={()=>setPendingWorkflowDetail(null)} onOpenDocuments={deliverableId=>{setApprovedDeliverableId(deliverableId);setWorkspaceView("documents")}}/>} 
        {workspaceView==="create-ecr"&&<SourceCreateWorkspace kind="ECR" projects={projects} initialProjectId={workspaceTabs.find(item=>item.key===activeWorkspaceTab)?.entityId||""} editId={workspaceTabs.find(item=>item.key===activeWorkspaceTab)?.editId} onCancel={()=>finishCreateWorkspace("create-ecr","ecr")} onCreated={workflowId=>finishCreateWorkspace("create-ecr","ecr",workflowId)}/>} 
        {workspaceView==="quality"&&<QualityWorkspace projects={projects} onCreate={projectId=>openCreateWorkspace("create-quality",projectId)} onEdit={id=>openEditWorkspace("create-quality",id)} initialDetailId={pendingWorkflowDetail?.view==="quality"?pendingWorkflowDetail.id:""} onInitialDetailOpened={()=>setPendingWorkflowDetail(null)} onOpenDocuments={deliverableId=>{setApprovedDeliverableId(deliverableId);setWorkspaceView("documents")}}/>} 
        {workspaceView==="create-quality"&&<SourceCreateWorkspace kind="QUALITY" projects={projects} initialProjectId={workspaceTabs.find(item=>item.key===activeWorkspaceTab)?.entityId||""} editId={workspaceTabs.find(item=>item.key===activeWorkspaceTab)?.editId} onCancel={()=>finishCreateWorkspace("create-quality","quality")} onCreated={workflowId=>finishCreateWorkspace("create-quality","quality",workflowId)}/>} 
        {workspaceView==="issues"&&<FilteredIssuesWorkspace project={project} projects={projects} tasks={tasks} initialProjectId={issueProjectPreset} onOpenTask={(projectId,taskId)=>openWorkspaceTask(projectId,taskId,"issue")} onAddIssue={taskId=>openWorkspaceTask(project?.id||"",taskId,"issue",true)} onOpenFilter={openWorkspaceFilter}/>} 
        {workspaceView==="reports"&&<ReportsWorkspace project={project} tasks={tasks} onAi={openReportAi}/>} 
        {workspaceView==="my-ai"&&<ContinuingAiHomeWorkspace/>}
        {workspaceView==="settings"&&<SystemSettingsSuite/>}
        {workspaceView==="wbs"&&<>
        {!project&&<div className="wv2-project-empty"><Folders size={34}/><h2>{loadError||"등록된 프로젝트가 없습니다."}</h2><p>저장된 프로젝트가 이곳에 표시됩니다.</p></div>}
        {project&&<>
        <header className="wv2-project-head">
          <div><span className="wv2-project-code">{project.code}</span><h1>{project.name}</h1><button><ChevronDown size={18}/></button></div>
          <div className="wv2-project-meta"><span>{isoShort(project.startDate)} — {isoShort(project.endDate)}</span><span className="wv2-health"><i/> {statusLabel(project.status)}</span><span><b>{progress}%</b> 진행률</span><button className="wv2-project-state" onClick={()=>setMembersOpen(true)}><Users size={18}/>참여자 {members.length}</button>{project.status==="preparing"&&<button className="wv2-project-start" disabled={statusSaving} onClick={()=>changeProjectStatus("start")}><Check size={18}/>{statusSaving?"시작 중…":"프로젝트 시작"}</button>}{(project.status==="active"||project.status==="stopped")&&<button className="wv2-project-state" disabled={statusSaving} onClick={()=>changeProjectStatus("prepare")}>준비 전환</button>}{project.status==="active"&&<><button className="wv2-project-state" disabled={statusSaving} onClick={()=>changeProjectStatus("stop")}>중단</button><button className="wv2-project-start" disabled={statusSaving} onClick={()=>changeProjectStatus("complete")}>완료</button></>}{project.status==="stopped"&&<button className="wv2-project-start" disabled={statusSaving} onClick={()=>changeProjectStatus("resume")}>재개</button>}<button><MoreHorizontal size={18}/></button></div>
        </header>
        {statusNotice&&<p className="wv2-status-notice">{statusNotice}</p>}
        <nav className="wv2-view-tabs" aria-label="Work View">
          {viewTabs.map(([key,label,Icon])=><button key={key} disabled={key==="edit"&&project.status!=="preparing"} className={view===key?"active":""} onClick={()=>setView(key)}><Icon size={18}/>{label}</button>)}
        </nav>
        <div className="wv2-toolbar">
          <button className="wv2-add" disabled={project.status!=="preparing"} onClick={()=>addTask()}><Plus size={18}/> 업무 추가 <ChevronDown size={18}/></button>
          <label><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="WBS, 업무, 담당자 검색"/></label>
          <button className={filters.statuses.length||filters.assignee||filters.flags.length||filters.levels.length?"active":""} onClick={()=>openPanel("filter")}><Filter size={18}/> 필터{filters.statuses.length+filters.flags.length+filters.levels.length>0&&<em>{filters.statuses.length+filters.flags.length+filters.levels.length}</em>}</button><div className="wv2-toolbar-menu"><button onClick={()=>setToolbarMenu(current=>current==="sort"?null:"sort")}><SlidersHorizontal size={18}/> 정렬</button>{toolbarMenu==="sort"&&<div className="popover"><b>정렬 기준</b>{([['order','기본 Order'],['name','업무명'],['start','계획 시작'],['end','계획 종료'],['progress','진척률'],['status','상태']] as const).map(([key,label])=><button className={sortKey===key?"active":""} key={key} onClick={()=>{if(sortKey===key)setSortDirection(value=>value==="asc"?"desc":"asc");else{setSortKey(key);setSortDirection("asc")}}}>{label}<span>{sortKey===key?(sortDirection==="asc"?"↑":"↓"):""}</span></button>)}</div>}</div><div className="wv2-toolbar-menu"><button onClick={()=>setToolbarMenu(current=>current==="columns"?null:"columns")}><Columns3 size={18}/> 표시 열</button>{toolbarMenu==="columns"&&<div className="popover columns"><b>표시할 열</b>{([['type','구분'],['start','계획 시작'],['end','계획 종료'],['assignee','담당'],['deliverables','산출물'],['issues','이슈'],['progress','진척률'],['status','상태'],['actual','실적']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={visibleColumns.has(key)} onChange={()=>setVisibleColumns(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next})}/>{label}</label>)}<button onClick={()=>setVisibleColumns(new Set(defaultColumns))}>기본값 복원</button></div>}</div>
          <span className="wv2-result-count">업무 {visible.length}건</span>
        </div>
        <section className="wv2-canvas">
          {loading&&<div className="wv2-loading">프로젝트 데이터를 불러오는 중…</div>}
          {!loading&&loadError&&<div className="wv2-project-empty compact"><AlertTriangle size={28}/><h3>{loadError}</h3></div>}
          {!loading&&!loadError&&!tasks.length&&<div className="wv2-project-empty compact"><Workflow size={30}/><h3>등록된 WBS가 없습니다.</h3><p>업무 추가로 첫 WBS를 구성하세요.</p><button className="wv2-add" onClick={()=>addTask()}><Plus size={18}/> 업무 추가</button></div>}
          {!loading&&!loadError&&tasks.length>0&&view==="list"&&<ListView tasks={visible} columns={visibleColumns} selectedId={selectedId} collapsed={collapsed} onCollapse={id=>setCollapsed(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next})} onSelect={selectTask} onActual={id=>openPanel("actual",id)} patchTask={patchTask}/>} 
          {!loading&&!loadError&&tasks.length>0&&view==="timeline"&&<TimelineView tasks={visible} onSelect={selectTask}/>} 
          {!loading&&!loadError&&tasks.length>0&&view==="gantt"&&<AdvancedGanttView projectId={project.id} canEdit={project.status!=="completed"} canInitializeBaseline={project.status!=="completed"} onBaselineCreated={()=>setBaselineRefresh(value=>value+1)} tasks={visible} baseline={baseline} onSelect={selectTask} onChanged={updates=>{const byId=new Map(updates.map(item=>[item.id,item]));setTasks(current=>recalculateSchedule(current.map(task=>byId.has(task.id)?{...task,...byId.get(task.id)!}:task)));setBaselineRefresh(value=>value+1)}} onAi={request=>{setAiDraft({key:Date.now(),...request});setPanelTab("ai");setPanelOpen(true)}}/>}
          {!loading&&!loadError&&tasks.length>0&&view==="kanban"&&<KanbanView tasks={tasks} onSelect={selectTask} onAdd={status=>addTask({status})} patchTask={patchTask} canAdd={project.status==="preparing"}/>} 
          {!loading&&!loadError&&tasks.length>0&&view==="calendar"&&<CalendarView tasks={tasks} onSelect={selectTask} onAdd={date=>addTask({plannedStart:date,plannedEnd:date})} canAdd={project.status==="preparing"}/>} 
          {!loading&&!loadError&&tasks.length>0&&view==="edit"&&<AdvancedWbsEditor tasks={visible} roles={roles} members={members} patchTask={patchTask} onAdd={addTask} onAddRelated={addRelatedTask} onMove={moveTask} onIndent={changeIndent} onDuplicate={duplicateTasks} onRemove={removeTask} onSave={saveWbs} saving={saving} notice={saveNotice}/>} 
        </section>
        </>}
        </>}
      </section>
    </section>
    <AiSelectionBar onStart={items=>{setAiDraft({key:Date.now(),contextItems:items,source:"V2 선택 업무"});setPanelTab("ai");setPanelOpen(true)}}/>
    {panelOpen&&<WorkPanel project={project} projects={projects} task={selected} tasks={tasks} members={members} tab={panelTab} wide={panelWide} onWide={()=>setPanelWide(value=>!value)} onTab={setPanelTab} onTaskSelect={setSelectedId} onClose={closePanel} patchTask={patchTask} filters={filters} setFilters={setFilters} workspaceFilter={workspaceFilter} deliverableRegistrationRequest={deliverableRegistrationRequest} onDeliverableRegistrationHandled={()=>setDeliverableRegistrationRequest(null)} onDeliverableRegistrationCompleted={closePanel} aiDraft={aiDraft}/>} 
    {globalOpen&&<IntegratedGlobalSearch query={globalQuery} setQuery={setGlobalQuery} onClose={()=>{setGlobalOpen(false);setGlobalQuery("")}} onOpen={(result:IntegratedSearchResult)=>{if(!result.projectId)return;openSearchResult({id:result.id,kind:result.kind as "project"|"task"|"document"|"issue",projectId:result.projectId,taskId:result.taskId,eyebrow:result.eyebrow,title:result.title,meta:result.meta})}} onAi={(items,prompt)=>{setGlobalOpen(false);setGlobalQuery("");setAiDraft({key:Date.now(),contextItems:items,source:"통합검색",prompt});setPanelTab("ai");setPanelOpen(true)}}/>} 
    {membersOpen&&project&&<ProjectMembersMasterDialog project={project} onClose={()=>setMembersOpen(false)} onSaved={next=>{setMembers(next);setMembersOpen(false)}}/>}
    {confirmDialog&&<ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} danger={confirmDialog.danger} onConfirm={()=>closeConfirm(true)} onCancel={()=>closeConfirm(false)}/>} 
  </main>;
}

function ContextNav({project,projects,user,active,onView,onProject,onClose}:{project:Project|null;projects:Project[];user:SessionUser|null;active:WorkspaceView;onView:(view:WorkspaceView)=>void;onProject:(project:Project)=>void;onClose:()=>void}){
  const [groups,setGroups]=useState({project:true,personal:true});
  const toggle=(key:"project"|"personal")=>setGroups(current=>({...current,[key]:!current[key]}));
  return <aside className="wv2-context">
    <header><div><small>WORKSPACE</small><b>J SOLUTION AI PMS</b></div><button onClick={onClose}><ChevronsLeft size={18}/></button></header>
    <CommonProjectSelector projects={projects} value={project?.id??""} allLabel={projects.length?"프로젝트 선택":"프로젝트 없음"} onChange={id=>{const next=projects.find(item=>item.id===id);if(next)onProject(next)}}/>
    <nav>
      <button className="wv2-context-group" onClick={()=>toggle("project")}><span>프로젝트</span><ChevronDown size={18} className={groups.project?"open":""}/></button>
      {groups.project&&<div className="wv2-context-level2"><button className={active==="portfolio"?"active":""} onClick={()=>onView("portfolio")}><LayoutDashboard size={18}/>전사 대시보드</button><button className={active==="dashboard"?"active":""} onClick={()=>onView("dashboard")}><Target size={18}/>프로젝트 대시보드</button><button className={active==="templates"?"active":""} onClick={()=>onView("templates")}><FileStack size={18}/>프로젝트 템플릿</button><button className={active==="workflow-templates"?"active":""} onClick={()=>onView("workflow-templates")}><Workflow size={18}/>워크플로우 템플릿</button><button className={active==="create-project"?"active":""} onClick={()=>onView("create-project")}><Plus size={18}/>새 프로젝트</button><button className={active==="projects"?"active":""} onClick={()=>onView("projects")}><Folders size={18}/>프로젝트 목록</button><button className={active==="wbs"?"active":""} onClick={()=>onView("wbs")}><Workflow size={18}/>일정 · WBS</button><button className={active==="documents"?"active":""} onClick={()=>onView("documents")}><FileText size={18}/>문서 · 산출물</button><button className={active==="product-data"?"active":""} onClick={()=>onView("product-data")}><Table2 size={18}/>PART · BOM</button><button className={active==="cost"?"active":""} onClick={()=>onView("cost")}><CircleDollarSign size={18}/>원가 관리</button><button className={active==="issues"?"active":""} onClick={()=>onView("issues")}><AlertTriangle size={18}/>이슈 · 리스크</button><button className={active==="workflows"?"active":""} onClick={()=>onView("workflows")}><GitPullRequestArrow size={18}/>워크플로우</button><button className={active==="ecr"?"active":""} onClick={()=>onView("ecr")}><RefreshCw size={18}/>설계변경</button><button className={active==="quality"?"active":""} onClick={()=>onView("quality")}><ShieldCheck size={18}/>품질관리</button><button className={active==="reports"?"active":""} onClick={()=>onView("reports")}><MessageSquareText size={18}/>보고 · 회의</button></div>}
      <button className="wv2-context-group" onClick={()=>toggle("personal")}><span>개인 업무</span><ChevronDown size={18} className={groups.personal?"open":""}/></button>
      {groups.personal&&<div className="wv2-context-level2"><button className={active==="my-work"?"active":""} onClick={()=>onView("my-work")}><Check size={18}/>MY WORK</button><button className={active==="my-ai"?"active":""} onClick={()=>onView("my-ai")}><Sparkles size={18}/>MY AI HOME</button></div>}
    </nav>
    <footer><div>{user?.name?.slice(0,1)||"U"}</div><span><b>{user?.name||"로그인 필요"}</b><small>{user?.email||"사용자 계정"}</small></span><MoreHorizontal size={18}/></footer>
  </aside>;
}

function WorkspaceTabs({tabs,active,pinned,onView,onClose}:{tabs:WorkspaceTab[];active:string;pinned:PinnedView[];onView:(tab:WorkspaceTab)=>void;onClose:(key:string)=>void}){
  const pinnedViews=new Set(pinned);
  return <nav className="wv2-work-tabs">{tabs.map(tab=>{const fixed=pinnedViews.has(tab.view as PinnedView);return <button key={tab.key} title={tab.title} className={active===tab.key?"active":""} onClick={()=>onView(tab)}><span>{tab.title}</span>{!fixed&&<i role="button" aria-label={`${tab.title} 탭 닫기`} onClick={event=>{event.stopPropagation();onClose(tab.key)}}><X size={18}/></i>}</button>})}</nav>;
}

function ConfirmDialog({title,message,danger,onConfirm,onCancel}:{title:string;message:string;danger?:boolean;onConfirm:()=>void;onCancel:()=>void}){useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onCancel()};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[onCancel]);return <div className="wv2-confirm-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel()}}><section className="wv2-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="wv2-confirm-title"><header><h2 id="wv2-confirm-title">{title}</h2></header><p>{message}</p><footer><button onClick={onCancel}>취소</button><button className={danger?"danger":"primary"} autoFocus onClick={onConfirm}>확인</button></footer></section></div>}
