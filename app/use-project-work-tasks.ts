"use client";

import { useCallback,useEffect,useState } from "react";
import { toWorkTaskViewModel,type WbsApiTask,type WorkTaskStatus,type WorkTaskViewModel } from "./work-task-view-model";

type ProjectInfo={id:string;code?:string;name:string};
type ActualSummary={taskId:string;issueCount?:number};
type State={tasks:WorkTaskViewModel[];loading:boolean;error:string};

export default function useProjectWorkTasks(project:ProjectInfo|null|undefined){
  const [state,setState]=useState<State>({tasks:[],loading:false,error:""});

  const reload=useCallback(async()=>{
    if(!project?.id){setState({tasks:[],loading:false,error:""});return;}
    setState(current=>({...current,loading:true,error:""}));
    try{
      const [wbsResponse,actualResponse]=await Promise.all([
        fetch(`/api/projects/${project.id}/wbs`,{cache:"no-store"}),
        fetch(`/api/projects/${project.id}/actuals`,{cache:"no-store"}),
      ]);
      if(!wbsResponse.ok)throw new Error("WBS 데이터를 불러오지 못했습니다.");
      const wbsData=await wbsResponse.json() as {tasks?:WbsApiTask[]};
      const actualData=actualResponse.ok?await actualResponse.json() as {summaries?:ActualSummary[]}:{summaries:[]};
      const issueCountByTask=new Map((actualData.summaries||[]).map(item=>[item.taskId,Number(item.issueCount||0)]));
      const tasks=(wbsData.tasks||[]).map(task=>toWorkTaskViewModel(task,{projectId:project.id,projectCode:project.code,projectName:project.name,issueCount:issueCountByTask.get(task.id)||0}));
      setState({tasks,loading:false,error:""});
    }catch(error){
      setState({tasks:[],loading:false,error:error instanceof Error?error.message:"업무 데이터를 불러오지 못했습니다."});
    }
  },[project?.id,project?.code,project?.name]);

  const updateStatus=useCallback(async(task:WorkTaskViewModel,status:WorkTaskStatus)=>{
    if(!project?.id||task.kind!=="task")return;
    const previous=state.tasks;
    setState(current=>({...current,tasks:current.tasks.map(item=>item.id===task.id?{...item,status,rawStatus:status,progress:status==="completed"?100:item.progress,isDelayed:status==="completed"?false:item.isDelayed}:item),error:""}));
    try{
      const response=await fetch(`/api/projects/${project.id}/wbs/status`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({taskId:task.id,status})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||"Task 상태를 변경하지 못했습니다.");
      await reload();
    }catch(error){
      setState(current=>({...current,tasks:previous,error:error instanceof Error?error.message:"Task 상태를 변경하지 못했습니다."}));
      throw error;
    }
  },[project?.id,reload,state.tasks]);

  const updateSchedule=useCallback(async(task:WorkTaskViewModel,plannedStart:string,plannedEnd:string,autoShiftSuccessors=false)=>{
    if(!project?.id||task.kind!=="task")return;
    const previous=state.tasks;
    setState(current=>({...current,tasks:current.tasks.map(item=>item.id===task.id?{...item,plannedStart,plannedEnd}:item),error:""}));
    try{
      const response=await fetch(`/api/projects/${project.id}/wbs/schedule`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({taskId:task.id,plannedStart,plannedEnd,autoShiftSuccessors})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||"Task 일정을 변경하지 못했습니다.");
      await reload();
    }catch(error){
      setState(current=>({...current,tasks:previous,error:error instanceof Error?error.message:"Task 일정을 변경하지 못했습니다."}));
      throw error;
    }
  },[project?.id,reload,state.tasks]);

  useEffect(()=>{void reload()},[reload]);
  return {...state,reload,updateStatus,updateSchedule};
}
