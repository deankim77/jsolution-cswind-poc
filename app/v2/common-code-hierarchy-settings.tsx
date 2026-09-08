"use client";

import {useEffect,useMemo,useState,type FormEvent} from "react";
import {ChevronRight,Plus,Search,Settings2,ShieldCheck,Trash2} from "lucide-react";
import {SystemSettingsPanel} from "./system-settings-panel";
import "./common-code-hierarchy-settings.css";

type CommonCode={id:string;groupCode:string;code:string;label:string;version?:number;sortOrder?:number;enabled?:number|boolean;systemControlled?:boolean};
type ProjectType={id:string;code:string;name:string;description?:string;status?:string};
type ProjectRole={id:string;code:string;name:string;groupName?:string;required?:boolean|number;enabled?:boolean|number;sortOrder?:number};
type CostGroup="MATERIAL"|"EXPENSE"|"OUTSOURCE"|"OTHER";
type CostCategory={id:string;code:string;groupCode:CostGroup;name:string;sourceType?:"BOM"|"MANUAL";enabled?:number|boolean;sortOrder?:number};
type GroupKind="code"|"projectType"|"projectRole"|"projectCost"|"system";
type GroupMeta={label:string;description:string;systemControlled?:boolean};
type GroupRow={groupCode:string;label:string;description:string;total:number;active:number;kind:GroupKind;systemControlled?:boolean};
type ManagedRow={id:string;code:string;label:string;enabled:boolean;sortOrder?:number;note?:string;raw:any;locked?:boolean};

const GROUP_META:Record<string,GroupMeta>={
  COMPLETION_CONDITION:{label:"WBS 완료 조건",description:"WBS Task 완료 기준을 선택할 때 사용합니다."},
  DELIVERABLE_STATUS:{label:"산출물 상태",description:"산출물의 등록·검토·승인 상태를 표시할 때 사용합니다."},
  DESIGN_CHANGE_TYPE:{label:"설계변경 유형",description:"설계변경 등록·수정 시 변경 사유를 분류합니다."},
  DRAWING_TYPE:{label:"도면 유형",description:"도면 등록·수정 시 제품도·부품도·조립도 등의 유형을 선택합니다."},
  ISSUE_SEVERITY:{label:"이슈 심각도",description:"이슈·리스크의 중요도와 대응 우선순위를 구분합니다."},
  PARTNER_CATEGORY:{label:"거래처 유형",description:"거래처를 고객사·공급사·외주처 등으로 구분합니다."},
  QUALITY_ISSUE_TYPE:{label:"품질 문제 유형",description:"품질 문제 등록·수정 시 문제 유형을 선택합니다."},
  ISSUE_TYPE:{label:"이슈·리스크 유형",description:"이슈·리스크·협업 요청의 유형을 구분합니다."},
  PROJECT_STATUS:{label:"프로젝트 상태",description:"프로젝트 목록과 대시보드의 진행 상태를 구분합니다."},
  TASK_STATUS:{label:"Task 상태",description:"일정·WBS와 MY WORK의 Task 상태를 구분합니다."},
  TASK_TYPE:{label:"Task 유형",description:"WBS와 템플릿의 Task 성격을 구분합니다."},
  ROLE:{label:"WBS Role",description:"WBS와 템플릿에서 업무 Role을 선택할 때 사용합니다."},
  WORKFLOW_STATUS:{label:"워크플로우 상태",description:"워크플로우 진행 로직에서 사용하는 고정 상태값입니다. 조회만 가능합니다.",systemControlled:true},
  WORKFLOW_ACTION_TYPE:{label:"워크플로우 처리구분",description:"워크플로우 템플릿 단계의 처리 성격을 결정하는 고정 값입니다. 조회만 가능합니다.",systemControlled:true},
};
const COST_NAMES:Record<CostGroup,string>={MATERIAL:"재료비",EXPENSE:"경비",OUTSOURCE:"외주비",OTHER:"기타"};
const COST_GROUPS=Object.keys(COST_NAMES) as CostGroup[];
const SYSTEM_CODES:Record<string,CommonCode[]>={
  WORKFLOW_STATUS:[
    {id:"workflow-status-draft",groupCode:"WORKFLOW_STATUS",code:"draft",label:"임시저장",enabled:1,systemControlled:true},
    {id:"workflow-status-progress",groupCode:"WORKFLOW_STATUS",code:"in_progress",label:"결재 진행 중",enabled:1,systemControlled:true},
    {id:"workflow-status-supplement",groupCode:"WORKFLOW_STATUS",code:"supplement",label:"보완",enabled:1,systemControlled:true},
    {id:"workflow-status-approved",groupCode:"WORKFLOW_STATUS",code:"approved",label:"승인 완료",enabled:1,systemControlled:true},
    {id:"workflow-status-rejected",groupCode:"WORKFLOW_STATUS",code:"rejected",label:"반려",enabled:1,systemControlled:true},
    {id:"workflow-status-recalled",groupCode:"WORKFLOW_STATUS",code:"recalled",label:"회수",enabled:1,systemControlled:true},
  ],
  WORKFLOW_ACTION_TYPE:[
    {id:"workflow-action-write",groupCode:"WORKFLOW_ACTION_TYPE",code:"WRITE",label:"작성",enabled:1,systemControlled:true},
    {id:"workflow-action-process",groupCode:"WORKFLOW_ACTION_TYPE",code:"PROCESS",label:"처리",enabled:1,systemControlled:true},
    {id:"workflow-action-review",groupCode:"WORKFLOW_ACTION_TYPE",code:"REVIEW",label:"검토",enabled:1,systemControlled:true},
    {id:"workflow-action-agreement",groupCode:"WORKFLOW_ACTION_TYPE",code:"AGREEMENT",label:"합의",enabled:1,systemControlled:true},
    {id:"workflow-action-approval",groupCode:"WORKFLOW_ACTION_TYPE",code:"APPROVAL",label:"승인",enabled:1,systemControlled:true},
    {id:"workflow-action-reference",groupCode:"WORKFLOW_ACTION_TYPE",code:"REFERENCE",label:"참조",enabled:1,systemControlled:true},
  ],
};
const metaFor=(groupCode:string)=>GROUP_META[groupCode]||{label:groupCode.replaceAll("_"," "),description:"시스템 공통 기준정보로 사용합니다."};

export function CommonCodeSettings(){
  const [codes,setCodes]=useState<CommonCode[]>([]);
  const [projectTypes,setProjectTypes]=useState<ProjectType[]>([]);
  const [projectRoles,setProjectRoles]=useState<ProjectRole[]>([]);
  const [costCategories,setCostCategories]=useState<CostCategory[]>([]);
  const [selectedGroup,setSelectedGroup]=useState("PROJECT_TYPE");
  const [selectedLevel2,setSelectedLevel2]=useState("");
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [editing,setEditing]=useState<ManagedRow|null>(null);
  const [creating,setCreating]=useState(false);
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(false);

  const load=async()=>{setLoading(true);try{
    await fetch("/api/system/drawing-types",{cache:"no-store"});
    const [masterResponse,costResponse]=await Promise.all([fetch("/api/system/master-data",{cache:"no-store"}),fetch("/api/project-cost-categories",{cache:"no-store"})]);
    const master=await masterResponse.json();const cost=await costResponse.json();
    if(!masterResponse.ok)throw new Error(master.error||"기준정보를 불러오지 못했습니다.");
    if(!costResponse.ok)throw new Error(cost.error||"프로젝트 비용 항목을 불러오지 못했습니다.");
    setCodes((master.codes??[]).filter((item:CommonCode)=>item.groupCode!=="DELIVERABLE_STANDARD"));
    setProjectTypes(master.projectTypes??[]);setProjectRoles(master.projectRoles??[]);setCostCategories(cost.categories??[]);setNotice("");
  }catch(reason){setNotice(reason instanceof Error?reason.message:"기준정보를 불러오지 못했습니다.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);

  const groups=useMemo(()=>{
    const result:GroupRow[]=[];const map=new Map<string,{total:number;active:number}>();
    for(const item of codes){const row=map.get(item.groupCode)||{total:0,active:0};row.total++;if(item.enabled!==0&&item.enabled!==false)row.active++;map.set(item.groupCode,row)}
    result.push({groupCode:"PROJECT_TYPE",label:"프로젝트 유형",description:"프로젝트 생성 시 개발·생산·설치 등 프로젝트 성격을 선택합니다.",total:projectTypes.length,active:projectTypes.filter(row=>row.status!=="inactive").length,kind:"projectType"});
    result.push({groupCode:"PROJECT_ROLE",label:"프로젝트 Role",description:"프로젝트 참여자의 Role 그룹과 세부 Role을 관리합니다.",total:projectRoles.length,active:projectRoles.filter(row=>row.enabled!==0&&row.enabled!==false).length,kind:"projectRole"});
    result.push({groupCode:"PROJECT_COST",label:"프로젝트 비용",description:"재료비·경비·외주비·기타의 2레벨과 세부 비용 항목을 관리합니다.",total:costCategories.length,active:costCategories.filter(row=>row.enabled!==0&&row.enabled!==false).length,kind:"projectCost"});
    for(const [groupCode,count] of map.entries()){const meta=metaFor(groupCode);result.push({groupCode,label:meta.label,description:meta.description,total:count.total,active:count.active,kind:"code"})}
    for(const [groupCode,items] of Object.entries(SYSTEM_CODES)){const meta=metaFor(groupCode);result.push({groupCode,label:meta.label,description:meta.description,total:items.length,active:items.length,kind:"system",systemControlled:true})}
    const priority=(row:GroupRow)=>row.groupCode==="PROJECT_TYPE"?0:row.groupCode==="PROJECT_ROLE"?1:row.groupCode==="PROJECT_COST"?2:row.kind==="system"?9:5;
    return result.sort((a,b)=>priority(a)-priority(b)||a.label.localeCompare(b.label,"ko"));
  },[codes,projectTypes,projectRoles,costCategories]);
  const selected=groups.find(group=>group.groupCode===selectedGroup)||groups[0];
  useEffect(()=>{if(groups.length&&!groups.some(group=>group.groupCode===selectedGroup))setSelectedGroup(groups[0].groupCode)},[groups,selectedGroup]);

  const roleGroups=useMemo(()=>Array.from(new Set(projectRoles.map(row=>String(row.groupName||"업무 수행").trim()).filter(Boolean))),[projectRoles]);
  useEffect(()=>{
    if(selected?.kind==="projectCost"&&!COST_GROUPS.includes(selectedLevel2 as CostGroup))setSelectedLevel2("MATERIAL");
    else if(selected?.kind==="projectRole"&&selectedLevel2&&!roleGroups.includes(selectedLevel2))setSelectedLevel2("");
    else if(selected?.kind!=="projectCost"&&selected?.kind!=="projectRole"&&selectedLevel2)setSelectedLevel2("");
  },[selected?.kind,selectedLevel2,roleGroups]);

  const sourceRows:ManagedRow[]=useMemo(()=>{
    if(!selected)return[];
    if(selected.kind==="projectType")return projectTypes.map(row=>({id:row.id,code:row.code,label:row.name,enabled:row.status!=="inactive",note:row.description||"설명 없음",raw:row}));
    if(selected.kind==="projectRole")return projectRoles.filter(row=>!selectedLevel2||String(row.groupName||"업무 수행")===selectedLevel2).map(row=>({id:row.id,code:row.code,label:row.name,enabled:row.enabled!==0&&row.enabled!==false,sortOrder:row.sortOrder,note:`${row.groupName||"업무 수행"} · ${row.required?"필수":"선택"}`,raw:row}));
    if(selected.kind==="projectCost"){const costGroup=(selectedLevel2||"MATERIAL") as CostGroup;return costCategories.filter(row=>row.groupCode===costGroup).map(row=>({id:row.id,code:row.code,label:row.name,enabled:row.enabled!==0&&row.enabled!==false,sortOrder:row.sortOrder,note:row.sourceType==="BOM"?"BOM 자동 연계":"일반 비용 항목",raw:row,locked:row.sourceType==="BOM"}))}
    if(selected.kind==="system")return (SYSTEM_CODES[selected.groupCode]??[]).map(row=>({id:row.id,code:row.code,label:row.label,enabled:true,raw:row,locked:true}));
    return codes.filter(row=>row.groupCode===selected.groupCode).map(row=>({id:row.id,code:row.code,label:row.label,enabled:row.enabled!==0&&row.enabled!==false,sortOrder:row.sortOrder,raw:row}));
  },[selected,selectedLevel2,projectTypes,projectRoles,costCategories,codes]);
  const rows=useMemo(()=>sourceRows.filter(item=>{if(statusFilter==="active"&&!item.enabled)return false;if(statusFilter==="inactive"&&item.enabled)return false;const key=query.trim().toLowerCase();return !key||`${item.label} ${item.code} ${item.note||""}`.toLowerCase().includes(key)}).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)||a.label.localeCompare(b.label,"ko")||a.code.localeCompare(b.code)),[sourceRows,query,statusFilter]);

  const activeCostGroup=(selectedLevel2||"MATERIAL") as CostGroup;
  const currentLevel2Label=selected?.kind==="projectCost"?COST_NAMES[activeCostGroup]:selected?.kind==="projectRole"?(selectedLevel2||"전체 Role"):"";
  const openCreate=()=>{if(!selected||selected.systemControlled)return;const raw=selected.kind==="projectType"?{entity:"projectType",code:"",name:"",description:"",status:"active"}:selected.kind==="projectRole"?{entity:"projectRole",code:"",name:"",groupName:selectedLevel2||roleGroups[0]||"업무 수행",required:false,enabled:true,sortOrder:projectRoles.length*10}:selected.kind==="projectCost"?{code:"",name:"",groupCode:activeCostGroup,enabled:true,sortOrder:costCategories.filter(row=>row.groupCode===activeCostGroup).length*10}:{entity:"code",groupCode:selected.groupCode,code:"",label:"",version:1,sortOrder:codes.filter(row=>row.groupCode===selected.groupCode).length*10,enabled:true};setEditing({id:"",code:"",label:"",enabled:true,raw});setCreating(true)};
  const openEdit=(row:ManagedRow)=>{if(selected?.systemControlled||row.locked)return;setEditing({...row,raw:{...row.raw}});setCreating(false)};
  const closePanel=()=>{setEditing(null);setCreating(false)};
  const patchRaw=(key:string,value:any)=>editing&&setEditing({...editing,raw:{...editing.raw,[key]:value},code:key==="code"?value:editing.code,label:key==="name"||key==="label"?value:editing.label,enabled:key==="enabled"?Boolean(value):key==="status"?value!=="inactive":editing.enabled});
  const save=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!editing||!selected||selected.systemControlled)return;setNotice("");let response:Response;
    if(selected.kind==="projectCost")response=await fetch("/api/project-cost-categories",{method:creating?"POST":"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(creating?editing.raw:{id:editing.id,...editing.raw})});
    else response=await fetch("/api/system/master-data",{method:creating?"POST":"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(creating?editing.raw:{...editing.raw,id:editing.id})});
    const result=await response.json();if(!response.ok){setNotice(result.error||"저장하지 못했습니다.");return}closePanel();await load()};
  const remove=async(row:ManagedRow)=>{if(!selected||selected.systemControlled||row.locked)return;if(!window.confirm(`'${row.label}' 항목을 삭제할까요?`))return;let response:Response;
    if(selected.kind==="projectCost")response=await fetch("/api/project-cost-categories",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:row.id})});
    else{const entity=selected.kind==="projectType"?"projectType":selected.kind==="projectRole"?"projectRole":"code";response=await fetch("/api/system/master-data",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({entity,id:row.id})})}
    const result=await response.json();if(!response.ok){setNotice(result.error||"삭제하지 못했습니다.");return}await load()};

  const isSystem=Boolean(selected?.systemControlled);
  const addLabel=selected?.kind==="projectType"?"프로젝트 유형 추가":selected?.kind==="projectRole"?"프로젝트 Role 추가":selected?.kind==="projectCost"?`${COST_NAMES[activeCostGroup]} 항목 추가`:"코드 추가";
  return <section className="cch-shell">
    <header className="cch-head"><div><small>MASTER DATA · COMMON CODE</small><h2>공통코드 관리</h2><p>좌측은 기준정보 1레벨만 표시하고, 세부 계층은 우측에서 관리합니다.</p></div></header>
    {notice&&!editing&&<p className="wv2-module-notice">{notice}</p>}
    <div className="cch-layout">
      <aside className="cch-groups"><header><b>기준정보 분류</b><span>{groups.length}개</span></header><div>{groups.map(group=><button key={group.groupCode} className={selectedGroup===group.groupCode?"active":""} onClick={()=>{setSelectedGroup(group.groupCode);setSelectedLevel2("");setQuery("");setStatusFilter("all");closePanel()}}><span><b>{group.label}</b><small>{group.groupCode}</small></span><em>{group.systemControlled?"조회":`${group.active}/${group.total}`}</em><ChevronRight size={18}/></button>)}</div></aside>
      <section className="cch-detail">
        <header className="cch-detail-head"><div><small>{selected?.groupCode||"COMMON CODE"}{currentLevel2Label?` · ${currentLevel2Label}`:""}</small><h3>{selected?.label||"공통코드"}{currentLevel2Label?` · ${currentLevel2Label}`:""}</h3><p>{selected?.description||"왼쪽에서 관리할 분류를 선택하세요."}</p></div>{isSystem?<span className="cch-system-badge"><ShieldCheck size={18}/>시스템 제어 코드</span>:<button className="primary" onClick={openCreate} disabled={!selected}><Plus size={18}/>{addLabel}</button>}</header>
        {selected?.kind==="projectCost"&&<div className="cch-level2"><span>2레벨</span>{COST_GROUPS.map(group=><button key={group} className={activeCostGroup===group?"active":""} onClick={()=>{setSelectedLevel2(group);setQuery("");closePanel()}}>{COST_NAMES[group]} · {costCategories.filter(row=>row.groupCode===group).length}</button>)}</div>}
        {selected?.kind==="projectRole"&&roleGroups.length>0&&<div className="cch-level2"><span>2레벨</span><button className={!selectedLevel2?"active":""} onClick={()=>{setSelectedLevel2("");setQuery("");closePanel()}}>전체 · {projectRoles.length}</button>{roleGroups.map(group=><button key={group} className={selectedLevel2===group?"active":""} onClick={()=>{setSelectedLevel2(group);setQuery("");closePanel()}}>{group} · {projectRoles.filter(row=>String(row.groupName||"업무 수행")===group).length}</button>)}</div>}
        <div className="cch-filter"><label><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="표시명 · 코드 · 분류 검색"/></label><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)} disabled={isSystem}><option value="all">전체 상태</option><option value="active">사용</option><option value="inactive">사용 안 함</option></select><span>{rows.length}개 항목</span></div>
        <div className="cch-table"><header><span>표시명</span><span>코드 · 3레벨 정보</span><span>상태</span><span/></header>{rows.map(row=><article key={row.id}>{isSystem||row.locked?<span className="cch-name"><b>{row.label}</b>{row.note&&<small>{row.note}</small>}</span>:<button className="cch-name" onClick={()=>openEdit(row)}><b>{row.label}</b>{row.note&&<small>{row.note}</small>}</button>}<span>{row.code}</span>{isSystem?<i className="active">시스템 제어</i>:row.locked?<i className="active">자동 연계</i>:<i className={row.enabled?"active":"inactive"}>{row.enabled?"사용":"사용 안 함"}</i>}<div>{!isSystem&&!row.locked&&<><button onClick={()=>openEdit(row)}>수정</button><button className="danger" title="삭제" onClick={()=>void remove(row)}><Trash2 size={18}/></button></>}</div></article>)}{!loading&&!rows.length&&<div className="cch-empty"><Settings2 size={28}/><b>등록된 항목이 없습니다.</b><span>{isSystem?"현재 시스템에 정의된 값이 없습니다.":"추가 버튼으로 첫 항목을 등록하세요."}</span></div>}{loading&&<div className="cch-empty"><b>기준정보를 불러오는 중…</b></div>}</div>
      </section>
    </div>
    {editing&&selected&&!isSystem&&<SystemSettingsPanel title={creating?`${selected.label}${currentLevel2Label?` · ${currentLevel2Label}`:""} 추가`:`${selected.label} 수정`} description={selected.description} onClose={closePanel} onSubmit={save} submitLabel={creating?"등록":"변경 저장"}>
      {selected.kind==="projectType"?<><div className="two"><label><span>프로젝트 유형 코드 *</span><input required value={editing.raw.code||""} onChange={e=>patchRaw("code",e.target.value.toUpperCase().replace(/\s+/g,"_"))}/></label><label><span>사용 여부</span><select value={editing.raw.status||"active"} onChange={e=>patchRaw("status",e.target.value)}><option value="active">사용</option><option value="inactive">사용 안 함</option></select></label></div><label><span>프로젝트 유형명 *</span><input required value={editing.raw.name||""} onChange={e=>patchRaw("name",e.target.value)}/></label><label><span>설명</span><textarea rows={4} value={editing.raw.description||""} onChange={e=>patchRaw("description",e.target.value)}/></label></>:selected.kind==="projectRole"?<><div className="two"><label><span>Role 코드 *</span><input required value={editing.raw.code||""} onChange={e=>patchRaw("code",e.target.value.toUpperCase().replace(/\s+/g,"_"))}/></label><label><span>사용 여부</span><select value={editing.raw.enabled===0||editing.raw.enabled===false?"inactive":"active"} onChange={e=>patchRaw("enabled",e.target.value==="active")}><option value="active">사용</option><option value="inactive">사용 안 함</option></select></label></div><label><span>Role 표시명 *</span><input required value={editing.raw.name||""} onChange={e=>patchRaw("name",e.target.value)}/></label><div className="two"><label><span>2레벨 Role 그룹</span><input value={editing.raw.groupName||"업무 수행"} onChange={e=>patchRaw("groupName",e.target.value)}/></label><label><span>정렬 순서</span><input type="number" value={editing.raw.sortOrder??0} onChange={e=>patchRaw("sortOrder",Number(e.target.value))}/></label></div><label className="check"><input type="checkbox" checked={Boolean(editing.raw.required)} onChange={e=>patchRaw("required",e.target.checked)}/> 필수 Role</label></>:selected.kind==="projectCost"?<><div className="two"><label><span>비용 코드 *</span><input required disabled={!creating} value={editing.raw.code||""} onChange={e=>patchRaw("code",e.target.value.toUpperCase().replace(/\s+/g,"_"))}/></label><label><span>사용 여부</span><select value={editing.raw.enabled===0||editing.raw.enabled===false?"inactive":"active"} onChange={e=>patchRaw("enabled",e.target.value==="active")}><option value="active">사용</option><option value="inactive">사용 안 함</option></select></label></div><label><span>3레벨 비용 항목 *</span><input required value={editing.raw.name||""} onChange={e=>patchRaw("name",e.target.value)}/></label><label><span>정렬 순서</span><input type="number" value={editing.raw.sortOrder??0} onChange={e=>patchRaw("sortOrder",Number(e.target.value))}/></label><label><span>2레벨 비용 분류</span><input value={COST_NAMES[activeCostGroup]} readOnly/></label></>:<><div className="two"><label><span>코드 *</span><input required value={editing.raw.code||""} onChange={e=>patchRaw("code",e.target.value.toUpperCase().replace(/\s+/g,"_"))}/></label><label><span>사용 여부</span><select value={editing.raw.enabled===0||editing.raw.enabled===false?"inactive":"active"} onChange={e=>patchRaw("enabled",e.target.value==="active")}><option value="active">사용</option><option value="inactive">사용 안 함</option></select></label></div><label><span>표시명 *</span><input required value={editing.raw.label||""} onChange={e=>patchRaw("label",e.target.value)}/></label><label><span>정렬 순서</span><input type="number" value={editing.raw.sortOrder??0} onChange={e=>patchRaw("sortOrder",Number(e.target.value))}/></label><label><span>내부 그룹 코드</span><input value={selected.groupCode} readOnly/></label></>}
      {notice&&<p className="wv2-module-notice">{notice}</p>}
    </SystemSettingsPanel>}
  </section>;
}
