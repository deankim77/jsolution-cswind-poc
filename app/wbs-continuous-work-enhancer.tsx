"use client";

import { useEffect } from "react";

type RetainedMode="actual"|"deliverables"|"issues"|null;

const MODE_LABEL:Record<Exclude<RetainedMode,null>,string>={actual:"실적",deliverables:"산출물",issues:"이슈"};

function tabMode(button:Element|null):RetainedMode{
  const text=button?.textContent?.trim()||"";
  if(text.includes("실적"))return "actual";
  if(text.includes("산출물"))return "deliverables";
  if(text.includes("이슈"))return "issues";
  return null;
}

function rowCode(row:HTMLElement){
  return row.querySelector(".unified-task-cell > b, :scope > span:nth-child(2) > b")?.textContent?.trim()||"";
}

function isExecutionRow(row:HTMLElement){
  const text=row.textContent||"";
  return text.includes("실행 Task")||text.includes("Gate Task")||text.includes("일반 Task");
}

function clickModeTab(mode:Exclude<RetainedMode,null>){
  const panel=document.querySelector(".direct-wbs-context");
  if(!panel)return;
  const tabs=Array.from(panel.querySelectorAll(".wbs-context-tabs button")) as HTMLButtonElement[];
  const tab=tabs.find(button=>(button.textContent||"").includes(MODE_LABEL[mode]));
  if(tab&&!tab.classList.contains("active"))tab.click();
}

function suppressLegacyWbsPanel(){
  const onWbs=Boolean(document.querySelector(".unified-wbs-host"));
  const direct=Boolean(document.querySelector(".direct-wbs-context"));
  const legacyPanels=Array.from(document.querySelectorAll(".context-panel:not(.direct-wbs-context)")) as HTMLElement[];
  legacyPanels.forEach(panel=>{
    if(onWbs&&direct){
      if(panel.dataset.wbsLegacyHidden!=="1"){
        panel.dataset.wbsLegacyHidden="1";
        panel.dataset.wbsLegacyDisplay=panel.style.display||"";
        panel.style.display="none";
      }
    }else if(panel.dataset.wbsLegacyHidden==="1"){
      panel.style.display=panel.dataset.wbsLegacyDisplay||"";
      delete panel.dataset.wbsLegacyHidden;
      delete panel.dataset.wbsLegacyDisplay;
    }
  });
}

function setControlledInput(input:HTMLInputElement,value:number){
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
  setter?.call(input,String(value));
  input.dispatchEvent(new Event("input",{bubbles:true}));
  input.dispatchEvent(new Event("change",{bubbles:true}));
}

function ensureQuickProgress(){
  const body=document.querySelector(".direct-wbs-context .direct-actual-body");
  if(!body||body.querySelector(".wbs-quick-progress"))return;
  const range=body.querySelector(".direct-progress-range") as HTMLInputElement|null;
  const number=body.querySelector(".direct-progress-number input[type='number']") as HTMLInputElement|null;
  if(!range||!number)return;
  const wrap=document.createElement("div");
  wrap.className="wbs-quick-progress";
  wrap.setAttribute("aria-label","빠른 진행률 입력");
  [25,50,75,100].forEach(value=>{
    const button=document.createElement("button");
    button.type="button";
    button.textContent=value===100?"100% 완료":`${value}%`;
    button.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();
      setControlledInput(number,value);
      setControlledInput(range,value);
    });
    wrap.appendChild(button);
  });
  range.insertAdjacentElement("afterend",wrap);
}

function ensureSaveNext(){
  const body=document.querySelector(".direct-wbs-context .direct-actual-body");
  if(!body)return;
  const actions=body.querySelector(".direct-panel-actions");
  if(!actions||actions.querySelector(".wbs-save-next"))return;
  const save=Array.from(actions.querySelectorAll("button")).find(button=>(button.textContent||"").includes("실적 저장")) as HTMLButtonElement|undefined;
  if(!save)return;
  const button=document.createElement("button");
  button.type="button";
  button.className="wbs-save-next";
  button.textContent="저장 후 다음 Task";
  actions.insertBefore(button,save);
}

function markDirectActions(){
  const rows=Array.from(document.querySelectorAll(".unified-grid-row")) as HTMLElement[];
  rows.forEach(row=>{
    const buttons=Array.from(row.querySelectorAll("button")) as HTMLButtonElement[];
    buttons.forEach(button=>{
      const text=(button.textContent||"").trim();
      if(text==="입력"||text.endsWith("입력")){
        button.dataset.wbsAction="actual";
        button.setAttribute("aria-label",`${rowCode(row)||"Task"} 실적 입력`);
      }
    });
  });
}

function nextExecutionRow(currentCode:string){
  const rows=Array.from(document.querySelectorAll(".unified-grid-row")) as HTMLElement[];
  const index=rows.findIndex(row=>rowCode(row)===currentCode);
  if(index<0)return null;
  for(let cursor=index+1;cursor<rows.length;cursor++)if(isExecutionRow(rows[cursor]))return rows[cursor];
  return null;
}

export default function WbsContinuousWorkEnhancer(){
  useEffect(()=>{
    let retainedMode:RetainedMode=null;
    let pendingNextCode="";

    const refresh=()=>{markDirectActions();ensureQuickProgress();ensureSaveNext();suppressLegacyWbsPanel();};
    const observer=new MutationObserver(()=>{
      refresh();
      if(pendingNextCode&&document.querySelector(".unified-toast")?.textContent?.includes("실적을 저장했습니다")){
        const next=nextExecutionRow(pendingNextCode);pendingNextCode="";
        if(next){retainedMode="actual";next.click();window.setTimeout(()=>clickModeTab("actual"),70);}
      }
    });
    observer.observe(document.body,{subtree:true,childList:true});
    refresh();

    const onClick=(event:MouseEvent)=>{
      const target=event.target as HTMLElement;
      const context=target.closest(".direct-wbs-context");
      if(context){
        const tab=target.closest(".wbs-context-tabs button");
        if(tab){
          const next=tabMode(tab);
          if(next)retainedMode=next;
          else if((tab.textContent||"").includes("상세정보"))retainedMode=null;
        }
        if(target.closest(".context-head > button")){retainedMode=null;pendingNextCode="";}
        const saveNext=target.closest(".wbs-save-next") as HTMLButtonElement|null;
        if(saveNext){
          event.preventDefault();event.stopPropagation();
          const head=document.querySelector(".direct-wbs-context .context-head p")?.textContent||"";
          pendingNextCode=head.match(/WBS\s+([^\s·]+)/)?.[1]||"";
          retainedMode="actual";
          const body=document.querySelector(".direct-wbs-context .direct-actual-body");
          const save=Array.from(body?.querySelectorAll("button")||[]).find(button=>(button.textContent||"").includes("실적 저장")) as HTMLButtonElement|undefined;
          if(save&&!save.disabled)save.click();
          else pendingNextCode="";
          return;
        }
        return;
      }

      const row=target.closest(".unified-grid-row,.unified-gantt-row") as HTMLElement|null;
      if(!row)return;
      const direct=target.closest("[data-wbs-action='actual']") as HTMLElement|null;
      const desired:RetainedMode=direct?"actual":retainedMode;
      if(!desired||!isExecutionRow(row))return;

      if(direct){
        // 기존 POC의 row-action onClick을 실행하지 않고, 같은 행을 다시 선택해
        // 실제 DB 기반 WbsDirectContext를 연 뒤 실적 탭으로 전환한다.
        event.preventDefault();
        event.stopPropagation();
        retainedMode="actual";
        window.setTimeout(()=>{
          row.click();
          window.setTimeout(()=>{clickModeTab("actual");suppressLegacyWbsPanel();},0);
          window.setTimeout(()=>{clickModeTab("actual");suppressLegacyWbsPanel();},80);
        },0);
        return;
      }

      window.setTimeout(()=>{clickModeTab(desired);suppressLegacyWbsPanel();},0);
      window.setTimeout(()=>{clickModeTab(desired);suppressLegacyWbsPanel();},80);
    };

    const onKeyDown=(event:KeyboardEvent)=>{
      if(!(event.ctrlKey||event.metaKey)||event.key!=="Enter")return;
      const body=document.querySelector(".direct-wbs-context .direct-actual-body");
      if(!body)return;
      const buttons=Array.from(body.querySelectorAll("button")) as HTMLButtonElement[];
      const save=buttons.find(button=>(button.textContent||"").includes("실적 저장"));
      if(!save||save.disabled)return;
      event.preventDefault();save.click();
    };

    document.addEventListener("click",onClick,true);
    document.addEventListener("keydown",onKeyDown,true);
    return()=>{
      observer.disconnect();
      document.removeEventListener("click",onClick,true);
      document.removeEventListener("keydown",onKeyDown,true);
      Array.from(document.querySelectorAll("[data-wbs-legacy-hidden='1']")).forEach(node=>{
        const panel=node as HTMLElement;panel.style.display=panel.dataset.wbsLegacyDisplay||"";
      });
    };
  },[]);
  return null;
}
