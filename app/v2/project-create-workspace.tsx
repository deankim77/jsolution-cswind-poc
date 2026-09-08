"use client";

import {useEffect,useState} from "react";
import {Check,Copy,Sparkles,Workflow} from "lucide-react";
import type {V2Project} from "./project-workspaces";

type TemplateWbsItem={id:string;name:string;level?:number};
type TemplateItem={id:string;code:string;name:string;status:string;versionId:string;version:string;definition:{description?:string;roles?:string[];wbs?:TemplateWbsItem[]}};

const statusLabel=(status:string)=>status==="active"?"진행 중":status==="completed"?"완료":status==="hold"?"중단":"준비 중";

export function ProjectCreateWorkspace({onCancel,onCreated}:{onCancel:()=>void;onCreated:(project:V2Project)=>void}){
  const [templates,setTemplates]=useState<TemplateItem[]>([]);
  const [mode,setMode]=useState<"template"|"copy"|"blank">("template");
  const [selectedTemplate,setSelectedTemplate]=useState("");
  const [copyProjects,setCopyProjects]=useState<V2Project[]>([]);
  const [selectedCopy,setSelectedCopy]=useState("");
  const [copyQuery,setCopyQuery]=useState("");
  const [includeAssignees,setIncludeAssignees]=useState(false);
  const [partners,setPartners]=useState<Array<{id:string;name:string;status:string}>>([]);
  const [projectTypes,setProjectTypes]=useState<Array<{id:string;name:string;status:string}>>([]);
  const [organizations,setOrganizations]=useState<Array<{id:string;name:string;status?:string}>>([]);
  const [form,setForm]=useState({name:"",code:"",customerName:"",partnerId:"",projectTypeId:"",description:"",referenceCode:"",visibility:"company" as "company"|"restricted",sharedOrganizationIds:[] as string[],startDate:new Date().toISOString().slice(0,10),endDate:""});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    Promise.all([
      fetch("/api/templates",{cache:"no-store"}).then(response=>response.json()),
      fetch("/api/projects?action=next-code",{cache:"no-store"}).then(response=>response.json()),
      fetch("/api/projects",{cache:"no-store"}).then(response=>response.json()),
      fetch("/api/system/master-data",{cache:"no-store"}).then(response=>response.json()),
    ]).then(([templateData,codeData,projectData,masterData])=>{
      const active=(templateData.templates??[]).filter((item:TemplateItem)=>item.status==="active");
      const sources=projectData.projects??[];
      const activePartners=(masterData.partners??[]).filter((item:{status:string})=>item.status==="active");
      const activeTypes=(masterData.projectTypes??[]).filter((item:{status:string})=>item.status==="active");
      const activeOrganizations=(masterData.organizations??[]).filter((item:{status:string})=>item.status==="active");
      setTemplates(active);
      setSelectedTemplate(active[0]?.versionId??"");
      setCopyProjects(sources);
      setSelectedCopy(sources[0]?.id??"");
      setPartners(activePartners);
      setProjectTypes(activeTypes);
      setOrganizations(activeOrganizations);
      setForm(value=>({...value,code:codeData.code??value.code,partnerId:activePartners[0]?.id||"",projectTypeId:activeTypes[0]?.id||"",customerName:activePartners[0]?.name||value.customerName}));
    }).catch(()=>setError("프로젝트 생성 정보를 불러오지 못했습니다."));
  },[]);

  const template=templates.find(item=>item.versionId===selectedTemplate);
  const submit=async()=>{
    setError("");
    if(!form.name.trim()||!form.code.trim()||!form.startDate||!form.endDate){setError("프로젝트명, 코드, 시작일, 종료일을 입력해 주세요.");return}
    if(mode==="copy"&&!selectedCopy){setError("복사할 기존 프로젝트를 선택해 주세요.");return}
    setSaving(true);
    try{
      const response=await fetch(mode==="copy"?"/api/projects/copy":"/api/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,partnerId:form.partnerId||undefined,projectTypeId:form.projectTypeId||undefined,creationMode:mode,templateVersionId:mode==="template"?selectedTemplate:undefined,sourceProjectId:mode==="copy"?selectedCopy:undefined,includeAssignees:mode==="copy"?includeAssignees:undefined})});
      const result=await response.json() as {id?:string;code?:string;error?:string};
      if(!response.ok||!result.id)throw new Error(result.error||"프로젝트를 생성하지 못했습니다.");
      const copied=copyProjects.find(item=>item.id===selectedCopy),partner=partners.find(item=>item.id===form.partnerId),projectType=projectTypes.find(item=>item.id===form.projectTypeId);
      onCreated({id:result.id,code:result.code||form.code,name:form.name,customerName:form.customerName,partnerId:form.partnerId,partnerName:partner?.name,projectTypeId:form.projectTypeId,projectTypeName:projectType?.name,description:form.description,referenceCode:form.referenceCode,visibility:form.visibility,startDate:form.startDate,endDate:form.endDate,status:"preparing",templateName:mode==="copy"?`복사 · ${copied?.name||"기존 프로젝트"}`:template?.name,templateVersion:mode==="copy"?undefined:template?.version});
    }catch(reason){setError(reason instanceof Error?reason.message:"프로젝트를 생성하지 못했습니다.")}finally{setSaving(false)}
  };

  return <section className="wv2-project-workspace create">
    <header className="wv2-page-title"><div><small>NEW PROJECT</small><h1>새 프로젝트 생성</h1><p>기본 정보와 시작 방식을 한 화면에서 정하고 바로 WBS를 시작합니다.</p></div><div><button onClick={onCancel}>취소</button><button className="primary" disabled={saving} onClick={submit}>{saving?"생성 중…":"프로젝트 생성"}</button></div></header>
    <div className="wv2-create-grid"><section className="wv2-create-form"><h2>기본 정보</h2><div className="two"><label><span>프로젝트명 *</span><input value={form.name} onChange={event=>setForm(value=>({...value,name:event.target.value}))} placeholder="프로젝트명을 입력하세요"/></label><label><span>프로젝트 코드 *</span><input value={form.code} readOnly aria-readonly="true" title="프로젝트 코드는 PJT-YYYY-NNNN 규칙으로 자동 생성되며 수정할 수 없습니다."/><small>프로젝트 코드는 PJT-YYYY-NNNN 규칙으로 자동 생성됩니다.</small></label></div><div className="two"><label><span>거래처</span><select value={form.partnerId} onChange={event=>{const partner=partners.find(item=>item.id===event.target.value);setForm(value=>({...value,partnerId:event.target.value,customerName:partner?.name||value.customerName}))}}><option value="">거래처 미지정</option>{partners.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>프로젝트 유형</span><select value={form.projectTypeId} onChange={event=>setForm(value=>({...value,projectTypeId:event.target.value}))}><option value="">유형 미지정</option>{projectTypes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div className="two"><label><span>고객사 표시명</span><input value={form.customerName} onChange={event=>setForm(value=>({...value,customerName:event.target.value}))} placeholder="프로젝트 화면에 표시할 고객사명"/></label><label><span>고객 참조 코드</span><input value={form.referenceCode} onChange={event=>setForm(value=>({...value,referenceCode:event.target.value}))}/></label></div><label><span>프로젝트 설명</span><textarea rows={3} value={form.description} onChange={event=>setForm(value=>({...value,description:event.target.value}))}/></label><div className="two"><label><span>계획 시작일 *</span><input type="date" value={form.startDate} onChange={event=>setForm(value=>({...value,startDate:event.target.value}))}/></label><label><span>계획 종료일 *</span><input type="date" value={form.endDate} onChange={event=>setForm(value=>({...value,endDate:event.target.value}))}/></label></div><label><span>공개 범위</span><select value={form.visibility} onChange={event=>setForm(value=>({...value,visibility:event.target.value as "company"|"restricted",sharedOrganizationIds:event.target.value==="company"?[]:value.sharedOrganizationIds}))}><option value="company">회사 전체</option><option value="restricted">지정 조직</option></select></label>{form.visibility==="restricted"&&<fieldset><legend>공유 조직</legend>{organizations.map(item=><label className="check" key={item.id}><input type="checkbox" checked={form.sharedOrganizationIds.includes(item.id)} onChange={event=>setForm(value=>({...value,sharedOrganizationIds:event.target.checked?[...value.sharedOrganizationIds,item.id]:value.sharedOrganizationIds.filter(id=>id!==item.id)}))}/>{item.name}</label>)}</fieldset>}</section>
    <aside className="wv2-create-method"><h2>프로젝트 시작 방식</h2>{([['template','템플릿 적용','검증된 역할·WBS·산출물을 복사합니다.'],['copy','기존 프로젝트 복사','완성된 프로젝트 구조를 새 일정으로 재사용합니다.'],['blank','빈 프로젝트','WBS 없이 프로젝트만 생성합니다.']] as const).map(([key,title,desc])=><button key={key} className={mode===key?"active":""} onClick={()=>setMode(key)}><span>{mode===key?<Check size={18}/>:key==="copy"?<Copy size={18}/>:<Workflow size={18}/>}</span><b>{title}</b><small>{desc}</small></button>)}{mode==="template"&&<div className="wv2-method-options"><label><span>적용 템플릿</span><select value={selectedTemplate} onChange={event=>setSelectedTemplate(event.target.value)}>{templates.map(item=><option key={item.versionId} value={item.versionId}>{item.name} · {item.version}</option>)}</select></label>{template&&<article><b>{template.name}</b><p>{template.definition.description}</p><span>WBS {template.definition.wbs?.length??0}개 · Role {template.definition.roles?.length??0}개</span></article>}</div>}{mode==="copy"&&<div className="wv2-method-options copy"><label><span>복사할 프로젝트</span><input value={copyQuery} onChange={event=>setCopyQuery(event.target.value)} placeholder="프로젝트명·코드·거래처 검색"/></label><div className="wv2-copy-projects">{copyProjects.filter(item=>!copyQuery.trim()||`${item.name} ${item.code} ${item.customerName||""}`.toLowerCase().includes(copyQuery.trim().toLowerCase())).map(item=><button type="button" key={item.id} className={selectedCopy===item.id?"active":""} onClick={()=>setSelectedCopy(item.id)}><span><b>{item.name}</b><small>{item.code} · {item.customerName||"거래처 미지정"}</small></span><em>{statusLabel(item.status)}</em></button>)}</div><label className="check"><input type="checkbox" checked={includeAssignees} onChange={event=>setIncludeAssignees(event.target.checked)}/><span>역할별·Task별 담당자 포함</span></label><p>WBS·Role·선후행·산출물 계획만 복사하며 실적·이슈·등록 파일은 제외됩니다.</p></div>}{mode==="blank"&&<div className="wv2-method-options"><article><Sparkles size={18}/><b>빈 프로젝트</b><p>프로젝트 생성 후 WBS 편집 화면에서 업무를 추가할 수 있습니다.</p></article></div>}</aside></div>{error&&<p className="wv2-form-error">{error}</p>}
  </section>;
}

export default ProjectCreateWorkspace;
