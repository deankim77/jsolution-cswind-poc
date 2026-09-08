"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {Trash2} from "lucide-react";

const ADMIN_ROLES=new Set(["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"]);

type ProjectRow={id:string;code:string;name:string};

export function AdminProjectDeleteControl(){
  const [isAdmin,setIsAdmin]=useState(false);
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [projectCode,setProjectCode]=useState("");
  const [deleting,setDeleting]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/session",{cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(data=>{
      const roles=Array.isArray(data?.user?.systemRoles)?data.user.systemRoles:[];
      setIsAdmin(roles.some((role:string)=>ADMIN_ROLES.has(role)));
    }).catch(()=>{if(!controller.signal.aborted)setIsAdmin(false)});
    return()=>controller.abort();
  },[]);

  useEffect(()=>{
    const resolveHost=()=>{
      const workspaces=Array.from(document.querySelectorAll<HTMLElement>(".wv2-project-workspace.create"));
      const editWorkspace=workspaces.find(item=>item.querySelector("h1")?.textContent?.trim()==="프로젝트 정보 수정")??null;
      const nextHost=editWorkspace?.querySelector<HTMLElement>(".wv2-create-method.wv2-edit-guide")??null;
      const codeInput=editWorkspace?.querySelector<HTMLInputElement>(".wv2-create-form input[readonly]")??null;
      setHost(nextHost);
      setProjectCode(codeInput?.value?.trim()||"");
      if(!nextHost)setNotice("");
    };
    resolveHost();
    const observer=new MutationObserver(resolveHost);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  const remove=async()=>{
    if(!projectCode||deleting)return;
    setDeleting(true);setNotice("");
    try{
      const listResponse=await fetch("/api/projects",{cache:"no-store"});
      const listData=await listResponse.json() as {projects?:ProjectRow[];error?:string};
      if(!listResponse.ok)throw new Error(listData.error||"프로젝트 정보를 확인하지 못했습니다.");
      const project=(listData.projects??[]).find(item=>item.code===projectCode);
      if(!project)throw new Error("삭제할 프로젝트를 찾을 수 없습니다.");
      const confirmed=window.confirm(`프로젝트를 완전히 삭제할까요?\n\n${project.code} · ${project.name}\n\nWBS·실적·산출물·Revision·이슈·워크플로우·설계변경·품질 등 연결 데이터와 업로드 파일도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`);
      if(!confirmed)return;
      const verification=window.prompt(`삭제 확인을 위해 프로젝트 코드 ${project.code} 를 정확히 입력해 주세요.`)?.trim();
      if(verification!==project.code){setNotice("프로젝트 코드가 일치하지 않아 삭제를 취소했습니다.");return}
      const response=await fetch(`/api/projects/${encodeURIComponent(project.id)}`,{method:"DELETE"});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||"프로젝트를 삭제하지 못했습니다.");
      setNotice("프로젝트를 삭제했습니다. 화면을 갱신합니다…");
      window.setTimeout(()=>window.location.reload(),900);
    }catch(reason){setNotice(reason instanceof Error?reason.message:"프로젝트를 삭제하지 못했습니다.")}
    finally{setDeleting(false)}
  };

  if(!isAdmin||!host||!projectCode)return null;
  return createPortal(<article><b>고급 관리</b><p>시스템 관리자만 프로젝트를 영구 삭제할 수 있습니다.</p><button type="button" disabled={deleting} onClick={remove}><Trash2 size={16}/>{deleting?"삭제 중…":"프로젝트 삭제"}</button>{notice&&<small>{notice}</small>}</article>,host);
}
