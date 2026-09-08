"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, PauseCircle, Trash2 } from "lucide-react";

type Project={id:string;code:string;name:string;status:string};
type ValidationItem={message:string;count?:number;wbsCode?:string;taskName?:string};

function projectCodeFromScreen(){
  const text=document.querySelector(".unified-project-info small")?.textContent||document.querySelector(".wbs-project-context")?.textContent||"";
  return text.match(/[A-Z]+-\d{4}-\d+/i)?.[0]||"";
}

export default function ProjectSuperuserActions(){
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [project,setProject]=useState<Project|null>(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const syncStatus=(event:Event)=>{
      const detail=(event as CustomEvent<{id:string;status:string}>).detail;
      if(!detail?.id)return;
      setProject(current=>current&&current.id===detail.id?{...current,status:detail.status}:current);
    };
    window.addEventListener("jsolution-project-status-changed",syncStatus);
    return()=>window.removeEventListener("jsolution-project-status-changed",syncStatus);
  },[]);

  useEffect(()=>{
    const attach=()=>setHost(document.querySelector(".unified-wbs-tabs") as HTMLElement|null);
    attach();
    const observer=new MutationObserver(attach);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    if(!host)return;
    let cancelled=false;
    const load=async()=>{
      const code=projectCodeFromScreen();
      if(!code)return;
      const response=await fetch("/api/projects",{cache:"no-store"});
      if(!response.ok)return;
      const data=await response.json() as {projects?:Project[]};
      const found=(data.projects??[]).find(item=>item.code.toLowerCase()===code.toLowerCase())||null;
      if(!cancelled)setProject(found);
    };
    void load();
    return()=>{cancelled=true};
  },[host]);

  const state=useMemo(()=>project?.status||"",[project]);
  if(!host||!project)return null;

  const formatWarnings=(items:ValidationItem[])=>(items||[]).map(item=>`${item.wbsCode?`${item.wbsCode} `:""}${item.taskName?`${item.taskName} · `:""}${item.message}${item.count?` (${item.count})`:""}`).join("\n");

  const statusAction=async(action:"stop"|"complete",force=false)=>{
    if(busy)return;
    let reason:string|undefined;
    if(action==="stop"){
      const input=window.prompt("프로젝트 중단 사유를 입력해 주세요.");
      if(input===null)return;
      if(!input.trim()){window.alert("중단 사유가 필요합니다.");return;}
      reason=input.trim();
    }
    setBusy(true);
    try{
      const response=await fetch(`/api/projects/${project.id}/status`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,force,reason})});
      const result=await response.json() as {error?:string;requiresConfirmation?:boolean;warnings?:ValidationItem[];status?:string};
      if(result.requiresConfirmation&&!force){
        const ok=window.confirm(`확인 필요 항목이 있습니다.\n\n${formatWarnings(result.warnings??[])}\n\n그래도 완료 처리할까요?`);
        if(ok){setBusy(false);await statusAction(action,true);}
        return;
      }
      if(!response.ok)throw new Error(result.error||"프로젝트 상태 변경 실패");
      const nextStatus=result.status||project.status;
      setProject(current=>current?{...current,status:nextStatus}:current);
      window.dispatchEvent(new CustomEvent("jsolution-project-status-changed",{detail:{id:project.id,status:nextStatus}}));
    }catch(error){window.alert(error instanceof Error?error.message:"프로젝트 상태 변경 실패");}
    finally{setBusy(false);}
  };

  const deleteProject=async()=>{
    if(busy||state!=="preparing")return;
    const ok=window.confirm(`'${project.name}' 프로젝트를 삭제하시겠습니까?\n\n준비 단계의 WBS, 산출물 연결정보, 이슈 및 프로젝트 설정 데이터가 함께 삭제됩니다.`);
    if(!ok)return;
    setBusy(true);
    try{
      const response=await fetch(`/api/projects/${project.id}`,{method:"DELETE"});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||"프로젝트 삭제 실패");
      window.alert("프로젝트를 삭제했습니다.");
      window.location.reload();
    }catch(error){window.alert(error instanceof Error?error.message:"프로젝트 삭제 실패");}
    finally{setBusy(false);}
  };

  return createPortal(
    <div className="superuser-project-actions" aria-label="전체 권한 프로젝트 기능">
      <span>전체 권한</span>
      <button disabled={busy||state!=="active"} title={state!=="active"?"진행중 프로젝트에서 사용":"프로젝트 중단"} onClick={()=>void statusAction("stop")}><PauseCircle size={14}/> 중단</button>
      <button disabled={busy||state!=="active"} title={state!=="active"?"진행중 프로젝트에서 사용":"프로젝트 완료"} onClick={()=>void statusAction("complete")}><CheckCircle2 size={14}/> 완료</button>
      <button className="danger" disabled={busy||state!=="preparing"} title={state!=="preparing"?"준비중 프로젝트만 삭제 가능":"프로젝트 삭제"} onClick={()=>void deleteProject()}><Trash2 size={14}/> 삭제</button>
    </div>,host
  );
}
