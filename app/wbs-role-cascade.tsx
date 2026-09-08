"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

type RoleDef={group:string;code:string;name:string};

const SYSTEM_ROLES:RoleDef[]=[
  {group:"프로젝트 관리",code:"PM",name:"프로젝트 관리자"},{group:"프로젝트 관리",code:"PL",name:"프로젝트 리더"},{group:"프로젝트 관리",code:"PO",name:"프로젝트 책임자"},{group:"프로젝트 관리",code:"PMO",name:"프로젝트 관리 지원"},
  {group:"사업·영업",code:"BP",name:"사업기획 담당"},{group:"사업·영업",code:"SALES",name:"영업 담당"},{group:"사업·영업",code:"PROPOSAL",name:"제안 담당"},{group:"사업·영업",code:"AM",name:"고객 담당"},
  {group:"기획·분석",code:"PP",name:"제품기획 담당"},{group:"기획·분석",code:"BA",name:"업무기획 담당"},{group:"기획·분석",code:"RA",name:"요구사항 담당"},{group:"기획·분석",code:"PA",name:"프로세스 담당"},
  {group:"연구·개발",code:"R&D",name:"연구개발 담당"},{group:"연구·개발",code:"DL",name:"개발 리더"},{group:"연구·개발",code:"DEV",name:"개발 담당"},{group:"연구·개발",code:"SW",name:"소프트웨어 담당"},{group:"연구·개발",code:"FW",name:"펌웨어 담당"},{group:"연구·개발",code:"HW",name:"하드웨어 담당"},
  {group:"설계·기술",code:"EL",name:"설계 리더"},{group:"설계·기술",code:"ME",name:"기구설계 담당"},{group:"설계·기술",code:"EE",name:"전장설계 담당"},{group:"설계·기술",code:"CE",name:"회로설계 담당"},{group:"설계·기술",code:"PD",name:"제품설계 담당"},{group:"설계·기술",code:"MD",name:"금형설계 담당"},{group:"설계·기술",code:"PE",name:"공정설계 담당"},
  {group:"구매·자재",code:"PUR",name:"구매 담당"},{group:"구매·자재",code:"SUB",name:"외주구매 담당"},{group:"구매·자재",code:"MAT",name:"자재 담당"},{group:"구매·자재",code:"SCM",name:"협력사 담당"},{group:"구매·자재",code:"COST",name:"원가 담당"},
  {group:"생산·제조",code:"PROD",name:"생산관리 담당"},{group:"생산·제조",code:"MFG",name:"제조기술 담당"},{group:"생산·제조",code:"PROC",name:"공정 담당"},{group:"생산·제조",code:"PPC",name:"생산계획 담당"},{group:"생산·제조",code:"EQ",name:"설비 담당"},
  {group:"품질·검증",code:"QC",name:"품질관리 담당"},{group:"품질·검증",code:"QA",name:"품질보증 담당"},{group:"품질·검증",code:"TEST",name:"시험 담당"},{group:"품질·검증",code:"V&V",name:"검증 담당"},{group:"품질·검증",code:"CERT",name:"인증 담당"},
  {group:"구축·운영",code:"SI",name:"시스템 구축 담당"},{group:"구축·운영",code:"DATA",name:"데이터 담당"},{group:"구축·운영",code:"IF",name:"시스템 연계 담당"},{group:"구축·운영",code:"INFRA",name:"인프라 담당"},{group:"구축·운영",code:"OPS",name:"시스템 운영 담당"},
  {group:"서비스·지원",code:"SERVICE",name:"서비스 담당"},{group:"서비스·지원",code:"SUPPORT",name:"기술지원 담당"},{group:"서비스·지원",code:"MA",name:"유지보수 담당"},{group:"서비스·지원",code:"TRAINER",name:"교육 담당"},
  {group:"고객·협력사",code:"C-PM",name:"고객 프로젝트 관리자"},{group:"고객·협력사",code:"C-USER",name:"고객 업무 담당"},{group:"고객·협력사",code:"PARTNER",name:"협력사 담당"},{group:"고객·협력사",code:"EXPERT",name:"외부 전문가"},
];

const LEGACY:Record<string,RoleDef>={
  PROJECT_PM:{group:"기존 프로젝트 Role",code:"PROJECT_PM",name:"프로젝트 PM"},
  CONSULTANT:{group:"기존 프로젝트 Role",code:"CONSULTANT",name:"업무 컨설턴트"},
  DEV_LEAD:{group:"기존 프로젝트 Role",code:"DEV_LEAD",name:"개발 리드"},
};
const SYSTEM_GROUPS=Array.from(new Set(SYSTEM_ROLES.map(role=>role.group)));
const ALL_GROUPS=["기존 프로젝트 Role",...SYSTEM_GROUPS];

function choicesFor(group:string){return group==="기존 프로젝트 Role"?Object.values(LEGACY):SYSTEM_ROLES.filter(role=>role.group===group);}
function roleFor(code:string){return SYSTEM_ROLES.find(role=>role.code===code)||LEGACY[code]||null;}
function currentCode(select:HTMLSelectElement,row?:HTMLElement|null){return row?.dataset.roleCascadeCode||select.value||"";}
function nativeSet(select:HTMLSelectElement,code:string){
  if(code&&!Array.from(select.options).some(option=>option.value===code))select.add(new Option(code,code));
  const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;
  setter?.call(select,code);
  select.dispatchEvent(new Event("change",{bubbles:true}));
}
function applyGroup(native:HTMLSelectElement,row:HTMLElement|null,group:string){
  const first=choicesFor(group)[0]?.code||"";
  if(row)row.dataset.roleCascadeCode=first;
  nativeSet(native,first);
  return first;
}

type GridTarget={key:string;mount:HTMLElement;native:HTMLSelectElement;row:HTMLElement};
type PanelTarget={mount:HTMLElement;native:HTMLSelectElement;row:HTMLElement|null};

function GridPicker({target,open,onToggle,onClose}:{target:GridTarget;open:boolean;onToggle:()=>void;onClose:()=>void}){
  const {mount,native,row}=target;
  const initial=currentCode(native,row);
  const initialRole=roleFor(initial);
  const [group,setGroup]=useState(initialRole?.group||SYSTEM_GROUPS[0]);
  const [code,setCode]=useState(initial);
  const choices=useMemo(()=>choicesFor(group),[group]);

  useEffect(()=>{
    const sync=()=>{
      const next=currentCode(native,row);
      setCode(next);
      const found=roleFor(next);
      if(found)setGroup(found.group);
    };
    sync();
    native.addEventListener("change",sync);
    return()=>native.removeEventListener("change",sync);
  },[native,row]);

  const selected=roleFor(code);
  return createPortal(<div className="wbs-role-grid-picker">
    <button type="button" className="wbs-role-grid-trigger" disabled={native.disabled} onClick={event=>{event.stopPropagation();onToggle();}} title={selected?`${selected.group} > ${selected.name} (${selected.code})`:"담당 Role 선택"}>
      <span>{selected?selected.name:"미지정"}</span><ChevronDown size={12}/>
    </button>
    {open&&<div className="wbs-role-grid-popover" onClick={event=>event.stopPropagation()}>
      <label><span>1레벨</span><select value={group} onChange={event=>{const nextGroup=event.target.value;setGroup(nextGroup);const nextCode=applyGroup(native,row,nextGroup);setCode(nextCode);}}>{ALL_GROUPS.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>2레벨</span><select value={code} onChange={event=>{const next=event.target.value;setCode(next);row.dataset.roleCascadeCode=next;nativeSet(native,next);onClose();}}>{choices.map(role=><option key={role.code} value={role.code}>{role.name} ({role.code})</option>)}</select></label>
    </div>}
  </div>,mount);
}

function PanelPicker({target}:{target:PanelTarget}){
  const {mount,native,row}=target;
  const initial=currentCode(native,row);
  const initialRole=roleFor(initial);
  const [group,setGroup]=useState(initialRole?.group||SYSTEM_GROUPS[0]);
  const [code,setCode]=useState(initial);
  const choices=useMemo(()=>choicesFor(group),[group]);

  useEffect(()=>{
    const sync=()=>{
      const next=currentCode(native,row);
      setCode(next);
      const found=roleFor(next);
      if(found)setGroup(found.group);
    };
    sync();
    native.addEventListener("change",sync);
    return()=>native.removeEventListener("change",sync);
  },[native,row]);

  return createPortal(<div className="wbs-role-panel-cascade">
    <label><span>Role 그룹</span><select disabled={native.disabled} value={group} onChange={event=>{const nextGroup=event.target.value;setGroup(nextGroup);const nextCode=applyGroup(native,row,nextGroup);setCode(nextCode);}}>{ALL_GROUPS.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
    <label><span>담당 Role</span><select disabled={native.disabled} value={code} onChange={event=>{const next=event.target.value;setCode(next);if(row)row.dataset.roleCascadeCode=next;nativeSet(native,next)}}>{choices.map(role=><option key={role.code} value={role.code}>{role.name} ({role.code})</option>)}</select></label>
  </div>,mount);
}

export default function WbsRoleCascade(){
  const [gridTargets,setGridTargets]=useState<GridTarget[]>([]);
  const [panel,setPanel]=useState<PanelTarget|null>(null);
  const [openKey,setOpenKey]=useState<string|null>(null);

  useEffect(()=>{
    const scan=()=>{
      const next:GridTarget[]=[];
      for(const row of Array.from(document.querySelectorAll(".project-editor-row")) as HTMLElement[]){
        const direct=Array.from(row.querySelectorAll(":scope > select")) as HTMLSelectElement[];
        const native=direct[2];
        if(!native)continue;
        if(!row.dataset.roleCascadeKey)row.dataset.roleCascadeKey=crypto.randomUUID();
        native.classList.add("wbs-role-native");
        native.style.display="none";
        let mount=row.querySelector(":scope > .wbs-role-grid-mount") as HTMLElement|null;
        if(!mount){mount=document.createElement("div");mount.className="wbs-role-grid-mount";native.before(mount);}
        next.push({key:row.dataset.roleCascadeKey,mount,native,row});
      }
      setGridTargets(next);

      const nativePanel=document.querySelector(".project-responsibility-fields > label:first-of-type select") as HTMLSelectElement|null;
      if(!nativePanel){setPanel(null);return;}
      nativePanel.classList.add("wbs-role-native-panel");
      nativePanel.style.display="none";
      const host=nativePanel.closest(".project-responsibility-fields") as HTMLElement;
      let mount=host.querySelector(":scope > .wbs-role-panel-mount") as HTMLElement|null;
      if(!mount){mount=document.createElement("div");mount.className="wbs-role-panel-mount";host.insertBefore(mount,host.firstChild);}
      const row=document.querySelector(".project-editor-row.active") as HTMLElement|null;
      setPanel({mount,native:nativePanel,row});
    };

    scan();
    const observer=new MutationObserver(()=>window.requestAnimationFrame(scan));
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","disabled"]});
    const close=(event:MouseEvent)=>{
      const target=event.target as Element|null;
      if(!target?.closest(".wbs-role-grid-picker"))setOpenKey(null);
    };
    document.addEventListener("mousedown",close);
    return()=>{observer.disconnect();document.removeEventListener("mousedown",close);};
  },[]);

  useEffect(()=>{
    if(openKey&&!gridTargets.some(target=>target.key===openKey))setOpenKey(null);
  },[gridTargets,openKey]);

  return <>
    {gridTargets.map(target=><GridPicker key={target.key} target={target} open={openKey===target.key} onToggle={()=>setOpenKey(current=>current===target.key?null:target.key)} onClose={()=>setOpenKey(null)}/>)}
    {panel&&<PanelPicker key={`${panel.row?.dataset.roleCascadeKey||"panel"}-${panel.native.value}`} target={panel}/>} 
  </>;
}
