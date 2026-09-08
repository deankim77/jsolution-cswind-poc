"use client";
import {ChevronRight} from "lucide-react";
import {masterCodeLabel,useMasterData} from "./master-data-store";
import {useAiContextSelection} from "./ai-context-selection";
import "./source-stage-list.css";

type SourceRow={
  id:string;workflowId?:string|null;projectCode?:string|null;projectName?:string|null;title:string;
  workflowStatus?:string;status:string;currentStepOrder?:number;currentStepName?:string;currentAssigneeName?:string;
  stepCount?:number;stepFlow?:string;dueDate?:string;
  ecrNumber?:string;qualityNumber?:string;changeType?:string;changeTarget?:string;priority?:string;
  issueType?:string;severity?:string;drawingCode?:string;drawingName?:string;drawingProjectCode?:string;drawingProjectName?:string;
  partId?:string;partNumber?:string;partName?:string;partRevision?:string;partType?:string;partSpec?:string;
};

const statusLabels:Record<string,string>={draft:"임시저장",in_progress:"결재 진행 중",supplement:"보완",approved:"승인 완료",rejected:"반려",recalled:"회수"};
const severityLabels:Record<string,string>={low:"낮음",medium:"보통",high:"높음",critical:"심각"};
const priorityLabels:Record<string,string>={normal:"보통",high:"높음",urgent:"긴급"};
const checkboxStyle={width:15,height:15,margin:0,accentColor:"var(--teal)",cursor:"pointer",flex:"0 0 auto"} as const;

export function SourceStageList({kind,rows,onOpen,onEditSource}:{kind:"ECR"|"QUALITY";rows:SourceRow[];onOpen:(workflowId:string)=>void;onEditSource?:(sourceId:string)=>void}){
  const ecr=kind==="ECR";
  const selection=useAiContextSelection(ecr?"설계변경":"품질관리");
  const {data,loading}=useMasterData();
  const codeLabel=(groupCode:string,code?:string)=>masterCodeLabel(data,groupCode,code);
  const partText=(row:SourceRow)=>row.partNumber?`${row.partNumber} · ${row.partName||"품명 미지정"}${row.partRevision?` · Rev.${row.partRevision}`:""}`:"PART 미지정";
  const drawingText=(row:SourceRow)=>row.drawingCode?`${row.drawingCode}${row.drawingName?` · ${row.drawingName}`:""}${row.drawingProjectCode?` · ${row.drawingProjectCode}${row.drawingProjectName?` ${row.drawingProjectName}`:""}`:""}`:"도면 미지정";
  const projectText=(row:SourceRow)=>row.projectName||"프로젝트 미연결";
  const contextFor=(row:SourceRow)=>{const status=row.workflowStatus||row.status,number=ecr?row.ecrNumber:row.qualityNumber,type=ecr?(codeLabel("DESIGN_CHANGE_TYPE",row.changeType)||row.changeType||"유형 미지정"):(codeLabel("QUALITY_ISSUE_TYPE",row.issueType)||row.issueType||"유형 미지정"),severity=ecr?(row.priority?`우선순위 ${priorityLabels[row.priority]||row.priority}`:"우선순위 미지정"):(severityLabels[row.severity||""]||"심각도 미지정");return {id:row.id,kind:ecr?"설계변경":"품질관리",title:`${number?`[${number}] `:""}${row.title}`,meta:`${projectText(row)} · 관련 PART ${partText(row)} · 관련 도면 ${drawingText(row)} · ${row.workflowId?`현재 단계 ${row.currentStepName||"작성"} · 처리자 ${row.currentAssigneeName||"미배정"}`:"Workflow 미연결"} · ${type} · ${severity} · 기한 ${row.dueDate||"미정"} · ${statusLabels[status]||status}`}};
  const allSelected=Boolean(rows.length)&&rows.every(row=>selection.has(contextFor(row)));
  const toggleAll=()=>rows.forEach(row=>{const item=contextFor(row);if(allSelected?selection.has(item):!selection.has(item))selection.toggle(item)});
  return <div className="wv2-workflow-table stage-table source-stage-table">
    <header><span style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" aria-label={`${ecr?"설계변경":"품질문제"} 전체 선택`} checked={allSelected} onChange={toggleAll} style={checkboxStyle}/>{ecr?"설계변경":"품질문제"}</span><span>대상 프로젝트</span><span>전체 단계</span><span>현재 단계·처리자</span><span>유형·관련 대상</span><span>기한</span><span>상태</span><span/></header>
    {rows.map(row=>{const flow=String(row.stepFlow||"").split("~").filter(Boolean).map(value=>{const [name,status]=value.split("|");return {name,status}});const status=row.workflowStatus||row.status,item=contextFor(row),checked=selection.has(item);return <button key={row.id} onClick={()=>row.workflowId?onOpen(row.workflowId):onEditSource?.(row.id)}>
      <span className="workflow-primary" style={{display:"flex",alignItems:"flex-start",gap:8}}><input type="checkbox" aria-label={`${ecr?"설계변경":"품질문제"} AI 선택`} checked={checked} onClick={event=>event.stopPropagation()} onChange={event=>{event.stopPropagation();selection.toggle(item)}} style={{...checkboxStyle,marginTop:2}}/><span style={{display:"grid",minWidth:0}}><b>{ecr?row.ecrNumber:row.qualityNumber}</b><small>{row.title}</small></span></span>
      <span><b>{projectText(row)}</b><small>{row.projectCode||"회사 공통 Draft"}</small></span>
      <span className="wv2-stage-flow">{row.workflowId?(flow.length?flow.map((step,index)=><i key={`${index}-${step.name}`} className={step.status} title={`${index+1}. ${step.name}`}><b>{index+1}</b><small>{step.name}</small></i>):<small>{Number(row.currentStepOrder||0)+1}/{Number(row.stepCount||0)}단계</small>):<small>프로젝트 연결 후 생성</small>}</span>
      <span><b>{row.workflowId?row.currentStepName||"작성":"Workflow 미연결"}</b><small>{row.workflowId?row.currentAssigneeName||"미배정":"프로젝트 선택 시 설정"}</small></span>
      <span>{ecr?<><b>{codeLabel("DESIGN_CHANGE_TYPE",row.changeType)||(loading?"유형 확인 중":"유형 미지정")}</b><small>{partText(row)} · {drawingText(row)}{row.priority?` · ${priorityLabels[row.priority]||row.priority}`:""}</small></>:<><b>{codeLabel("QUALITY_ISSUE_TYPE",row.issueType)||(loading?"유형 확인 중":"유형 미지정")}</b><small>{partText(row)} · {drawingText(row)} · {severityLabels[row.severity||""]||"심각도 미지정"}</small></>}</span>
      <span><b>{row.dueDate||"미정"}</b><small>{row.dueDate&&row.dueDate<new Date().toISOString().slice(0,10)&&status==="in_progress"?"지연":""}</small></span>
      <em className={`status ${status}`}>{statusLabels[status]||status}</em><ChevronRight size={18}/>
    </button>})}
  </div>;
}