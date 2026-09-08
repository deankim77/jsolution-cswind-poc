"use client";

import { useCallback,useEffect,useState } from "react";
import { normalizeWorkTaskStatus,isTaskDelayed,type WorkTaskStatus,type WorkTaskViewModel } from "./work-task-view-model";

type ApiTask={id:string;projectId:string;projectCode?:string;projectName:string;wbsCode:string;level:number;kind:"summary"|"task";name:string;taskType?:string;plannedStart?:string;plannedEnd?:string;predecessorCode?:string;roleCode?:string;assigneeUserId?:string;assigneeName?:string;progress?:number;status?:string;deliverableCount?:number;issueCount?:number};
type User={id?:string;email:string;name:string};
type State={tasks:WorkTaskViewModel[];user:User|null;loading:boolean;error:string};

function mapTask(task:ApiTask):WorkTaskViewModel{
  const progress=Math.max(0,Math.min(100,Number(task.progress||0)));
  const delayed=isTaskDelayed(task);
  return {id:task.id,projectId:task.projectId,projectCode:task.projectCode,projectName:task.projectName,wbsCode:task.wbsCode,name:task.name,level:Number(task.level)||1,kind:task.kind,taskType:task.taskType,plannedStart:task.plannedStart,plannedEnd:task.plannedEnd,predecessorCode:task.predecessorCode,roleCode:task.roleCode,assigneeUserId:task.assigneeUserId,assigneeName:task.assigneeName,progress,rawStatus:task.status,status:normalizeWorkTaskStatus(task.status,progress,delayed),deliverableCount:Number(task.deliverableCount||0),issueCount:Number(task.issueCount||0),isDelayed:delayed};
}

export default function useMyWorkTasks(){
  const [state,setState]=useState<State>({tasks:[],user:null,loading:true,error:""});
  const reload=useCallback(async()=>{
    setState(current=>({...current,loading:true,error:""}));
    try{
      const response=await fetch("/api/my-work",{cache:"no-store"});
      const data=await response.json() as {user?:User;tasks?:ApiTask[];error?:string};
      if(!response.ok)throw new Error(data.error||"MY WORK를 불러오지 못했습니다.");
      setState({tasks:(data.tasks||[]).map(mapTask),user:data.user||null,loading:false,error:""});
    }catch(error){setState(current=>({...current,tasks:[],loading:false,error:error instanceof Error?error.message:"MY WORK를 불러오지 못했습니다."}));}
  },[]);
  const updateStatus=useCallback(async(task:WorkTaskViewModel,status:WorkTaskStatus)=>{
    if(!task.projectId)return;
    const response=await fetch(`/api/projects/${task.projectId}/wbs/status`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({taskId:task.id,status})});
    const data=await response.json() as {error?:string};
    if(!response.ok)throw new Error(data.error||"업무 상태를 변경하지 못했습니다.");
    await reload();
  },[reload]);
  useEffect(()=>{void reload()},[reload]);
  return {...state,reload,updateStatus};
}
