"use client";

import { useEffect } from "react";

type Project={id:string;code:string};
type WbsTask={id:string;wbsCode:string;kind?:"summary"|"task";progress:number;status:string};

const rowCode=(row:HTMLElement)=>row.querySelector(".unified-task-cell > b, :scope > span:nth-child(2) > b")?.textContent?.trim()||"";
const screenProjectCode=()=>document.querySelector(".unified-project-info small")?.textContent?.match(/[A-Z]+-\d{4}-\d+/i)?.[0]||"";
const statusText=(task:WbsTask,progress:number)=>task.status==="completed"||progress>=100?"완료":task.status==="active"||progress>0?"진행 중":task.kind==="summary"?"미시작":"예정";

function applyRowProgress(task:WbsTask){
  const progress=Math.max(0,Math.min(100,Number(task.progress)||0));
  const labelText=statusText(task,progress);
  const rows=Array.from(document.querySelectorAll(".unified-grid-row,.unified-gantt-row")) as HTMLElement[];
  for(const row of rows.filter(item=>rowCode(item)===task.wbsCode)){
    const bar=row.querySelector(".mini-progress i") as HTMLElement|null;
    const label=row.querySelector(".progress-link b") as HTMLElement|null;
    if(bar&&bar.style.width!==`${progress}%`)bar.style.width=`${progress}%`;
    if(label&&label.textContent!==`${progress}%`)label.textContent=`${progress}%`;

    const cells=Array.from(row.children) as HTMLElement[];
    const progressCell=cells.find(cell=>cell.querySelector(".mini-progress,.progress-link"));
    if(progressCell){
      const loosePercent=Array.from(progressCell.querySelectorAll("span,b")).find(el=>/^\d+%$/.test(el.textContent?.trim()||""));
      if(loosePercent&&loosePercent.textContent!==`${progress}%`)loosePercent.textContent=`${progress}%`;
    }

    const stateBadge=row.querySelector(".state-badge") as HTMLElement|null;
    if(stateBadge){
      if(stateBadge.textContent!==labelText)stateBadge.textContent=labelText;
      stateBadge.classList.toggle("done",labelText==="완료");
      stateBadge.classList.toggle("active",labelText==="진행 중");
      stateBadge.classList.toggle("planned",labelText==="미시작"||labelText==="예정");
    }else{
      const statusCandidates=Array.from(row.querySelectorAll("span,em,b")).filter(el=>["완료","진행 중","진행중","예정","미시작"].includes(el.textContent?.trim()||""));
      statusCandidates.forEach(el=>{if(el.textContent!==labelText)el.textContent=labelText});
    }
  }
}

export default function WbsLiveProgressSync(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let syncTimer=0;
    let currentCode="";
    let cachedTasks:WbsTask[]=[];

    const applyTasks=(tasks:WbsTask[])=>{cachedTasks=tasks;for(const task of tasks)applyRowProgress(task);};
    const applyProjectWbs=async(projectId:string,recalculate=false)=>{
      try{
        if(recalculate)await originalFetch(`/api/projects/${projectId}/actuals`,{cache:"no-store"});
        const wbsResponse=await originalFetch(`/api/projects/${projectId}/wbs`,{cache:"no-store"});
        if(!wbsResponse.ok)return;
        const data=await wbsResponse.json() as {tasks?:WbsTask[]};
        applyTasks(data.tasks??[]);
        window.dispatchEvent(new CustomEvent("jsolution:wbs-progress-synced",{detail:{projectId,tasks:data.tasks??[]}}));
      }catch{}
    };

    const resolveAndSync=async(code:string)=>{
      try{
        const projectsResponse=await originalFetch("/api/projects",{cache:"no-store"});if(!projectsResponse.ok)return;
        const data=await projectsResponse.json() as {projects?:Project[]};
        const project=(data.projects??[]).find(item=>item.code.toLowerCase()===code.toLowerCase());if(!project)return;
        await applyProjectWbs(project.id,true);
      }catch{}
    };

    const scheduleSync=()=>{
      window.clearTimeout(syncTimer);
      syncTimer=window.setTimeout(()=>{
        const code=screenProjectCode();if(!code)return;
        if(code!==currentCode){currentCode=code;cachedTasks=[];void resolveAndSync(code);return;}
        if(cachedTasks.length)applyTasks(cachedTasks);
      },60);
    };

    const patched:typeof window.fetch=async(input,init)=>{
      const requestUrl=typeof input==="string"?input:input instanceof URL?input.toString():input.url;
      const method=(init?.method||(typeof Request!=="undefined"&&input instanceof Request?input.method:"GET")).toUpperCase();
      let actualBody:{taskId?:string;progress?:number;completed?:boolean}|null=null;
      if(method==="POST"&&/\/api\/projects\/[^/]+\/actuals(?:\?|$)/.test(requestUrl)){
        try{
          const raw=typeof init?.body==="string"?init.body:null;
          if(raw)actualBody=JSON.parse(raw) as {taskId?:string;progress?:number;completed?:boolean};
        }catch{}
      }
      const response=await originalFetch(input as RequestInfo|URL,init);
      if(response.ok&&actualBody?.taskId){
        const projectId=requestUrl.match(/\/api\/projects\/([^/]+)\/actuals/)?.[1];
        if(projectId)await applyProjectWbs(projectId,false);
      }
      return response;
    };

    window.fetch=patched;
    const observer=new MutationObserver(()=>scheduleSync());
    observer.observe(document.body,{subtree:true,childList:true});
    scheduleSync();

    return()=>{
      window.clearTimeout(syncTimer);
      observer.disconnect();
      window.fetch=originalFetch;
    };
  },[]);
  return null;
}
