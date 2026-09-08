"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowDown, ArrowUp, Check, CircleCheck, IndentDecrease, IndentIncrease, Plus, Save, Trash2 } from "lucide-react";

const textOf=(element:Element|null)=>element?.textContent?.replace(/\s+/g," ").trim()||"";

function findButton(root:Element|null,needle:string){
  if(!root)return null;
  return (Array.from(root.querySelectorAll("button")) as HTMLButtonElement[]).find(button=>textOf(button).includes(needle))||null;
}

function selectedRow(){return document.querySelector(".project-editor-row.active") as HTMLElement|null;}
function selectedLevel(){
  const row=selectedRow();
  if(!row)return 0;
  const name=row.querySelector(".project-task-name") as HTMLElement|null;
  if(!name)return 0;
  const padding=parseInt(window.getComputedStyle(name).paddingLeft||"10",10);
  return Math.max(1,Math.round((padding-10)/20)+1);
}

function currentProjectCode(host:HTMLElement){
  return textOf(host.querySelector(".project-editor-header")).match(/[A-Z]+-\d{4}-\d+/i)?.[0]||"";
}

function usedRoleCodes(host:HTMLElement){
  const roles=new Set<string>();
  for(const row of Array.from(host.querySelectorAll(".project-editor-row")) as HTMLElement[]){
    const role=(row.querySelector(":scope > .wbs-role-native") as HTMLSelectElement|null)?.value?.trim()
      ||row.dataset.roleCascadeCode?.trim()
      ||(Array.from(row.querySelectorAll(":scope > select")) as HTMLSelectElement[])[2]?.value?.trim();
    if(role)roles.add(role);
  }
  return [...roles];
}

type Notice={kind:"success"|"error";text:string}|null;

export default function WbsEditorToolbarEnhancer(){
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [mount,setMount]=useState<HTMLElement|null>(null);
  const [tick,setTick]=useState(0);
  const [notice,setNotice]=useState<Notice>(null);
  const [preparingSave,setPreparingSave]=useState(false);

  useEffect(()=>{
    const sync=()=>{
      const shell=document.querySelector(".project-editor-shell") as HTMLElement|null;
      setHost(shell);
      if(!shell){setMount(null);return;}
      const table=shell.querySelector(".project-editor-table") as HTMLElement|null;
      if(!table){setMount(null);return;}
      let target=table.querySelector(":scope > .wbs-editor-command-mount") as HTMLElement|null;
      if(!target){
        target=document.createElement("div");
        target.className="wbs-editor-command-mount";
        const head=table.querySelector(":scope > .project-editor-head");
        table.insertBefore(target,head||table.firstChild);
      }
      setMount(target);
      setTick(value=>value+1);
    };
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    if(!host)return;
    const footer=host.querySelector(".project-editor-footer") as HTMLElement|null;
    if(!footer)return;
    let timer:number|undefined;
    const report=()=>{
      const text=textOf(footer);
      if(text.includes("저장 완료")){
        setNotice({kind:"success",text:"WBS 및 산출물 저장 완료"});
        if(timer)window.clearTimeout(timer);
        timer=window.setTimeout(()=>setNotice(null),2600);
      }else if(footer.querySelector(".error")||text.includes("저장하지 못")||text.includes("실패")){
        setNotice({kind:"error",text:text||"저장 중 오류가 발생했습니다."});
        if(timer)window.clearTimeout(timer);
        timer=window.setTimeout(()=>setNotice(null),4200);
      }
    };
    const observer=new MutationObserver(report);
    observer.observe(footer,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class"]});
    report();
    return()=>{observer.disconnect();if(timer)window.clearTimeout(timer);};
  },[host]);

  const state=useMemo(()=>{
    if(!host)return {selected:false,level:0,first:false,last:false,dirty:false};
    const rows=Array.from(host.querySelectorAll(".project-editor-row"));
    const active=selectedRow();
    const index=active?rows.indexOf(active):-1;
    return {
      selected:Boolean(active),
      level:selectedLevel(),
      first:index===0,
      last:index>=0&&index===rows.length-1,
      dirty:textOf(host.querySelector(".draft-state"))?.includes("변경사항 있음")||textOf(host.querySelector(".project-editor-footer"))?.includes("저장하지 않은 변경사항"),
    };
  },[host,tick]);

  if(!host||!mount)return null;

  const nativeToolbar=host.querySelector(".project-editor-toolbar");
  const nativeFooter=host.querySelector(".project-editor-footer");
  const clickNative=(label:string)=>findButton(nativeToolbar,label)?.click();
  const clickDelete=()=>{
    const active=selectedRow();
    (active?.querySelector(".grid-delete") as HTMLButtonElement|null)?.click();
  };
  const clickSave=async()=>{
    if(preparingSave)return;
    const save=(Array.from(nativeFooter?.querySelectorAll("button")||[]) as HTMLButtonElement[]).find(button=>textOf(button).includes("변경사항 저장")||textOf(button).includes("저장 중"));
    if(!save){setNotice({kind:"error",text:"저장 기능을 찾지 못했습니다."});return;}
    setNotice(null);
    setPreparingSave(true);
    try{
      const projectCode=currentProjectCode(host);
      const roleCodes=usedRoleCodes(host);
      if(projectCode&&roleCodes.length){
        const response=await fetch("/api/projects/roles/sync",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectCode,roleCodes})});
        const result=await response.json() as {error?:string};
        if(!response.ok)throw new Error(result.error||"프로젝트 Role 정보를 동기화하지 못했습니다.");
      }
      save.click();
    }catch(error){
      setNotice({kind:"error",text:error instanceof Error?error.message:"프로젝트 Role 정보를 동기화하지 못했습니다."});
    }finally{
      setPreparingSave(false);
    }
  };

  const commandbar=createPortal(<div className="wbs-editor-commandbar" data-editor-toolbar="enhanced">
    <div className="wbs-editor-command-group">
      <strong>WBS 편집</strong>
      <button type="button" onClick={()=>clickNative("같은 레벨")}><Plus size={14}/> 같은 레벨 추가</button>
      <button type="button" disabled={!state.selected} onClick={()=>clickNative("하위 Task")}><Plus size={14}/> 하위 Task</button>
      <span className="wbs-editor-command-separator"/>
      <button type="button" disabled={!state.selected||state.level<=1} onClick={()=>clickNative("내어쓰기")} title="상위 레벨로 이동"><IndentDecrease size={14}/> 내어쓰기</button>
      <button type="button" disabled={!state.selected||state.level>=5} onClick={()=>clickNative("들여쓰기")} title="하위 레벨로 이동"><IndentIncrease size={14}/> 들여쓰기</button>
      <span className="wbs-editor-command-separator"/>
      <button type="button" className="icon-only" disabled={!state.selected||state.first} onClick={()=>clickNative("위로 이동")} aria-label="위로 이동" title="위로 이동"><ArrowUp size={15}/></button>
      <button type="button" className="icon-only" disabled={!state.selected||state.last} onClick={()=>clickNative("아래로 이동")} aria-label="아래로 이동" title="아래로 이동"><ArrowDown size={15}/></button>
      <button type="button" className="danger" disabled={!state.selected} onClick={clickDelete}><Trash2 size={14}/> 삭제</button>
    </div>
    <div className="wbs-editor-command-right">
      <span className="wbs-editor-level-chip">선택 Level {state.level||"-"}</span>
      <button type="button" className={`save ${state.dirty?"dirty":""}`} disabled={!state.dirty||preparingSave} onClick={()=>void clickSave()}>{state.dirty?<Save size={15}/>:<Check size={15}/>} {preparingSave?"Role 확인 중":state.dirty?"변경사항 저장":"저장됨"}</button>
    </div>
  </div>,mount);

  const toast=notice&&typeof document!=="undefined"?createPortal(<div className={`wbs-global-action-toast ${notice.kind}`} role={notice.kind==="error"?"alert":"status"} aria-live="polite">
    {notice.kind==="success"?<CircleCheck size={19}/>:<AlertTriangle size={19}/>}<span><strong>{notice.kind==="success"?"저장 완료":"저장 실패"}</strong><small>{notice.text}</small></span>
  </div>,document.body):null;

  return <>{commandbar}{toast}</>;
}
