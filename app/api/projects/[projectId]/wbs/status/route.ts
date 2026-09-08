import { getLegacyDbCompat } from "../../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../../db/request-context";

type D1Statement={bind:(...values:unknown[])=>D1Statement;first:<T=any>()=>Promise<T|null>;run:()=>Promise<unknown>};
type D1={prepare:(sql:string)=>D1Statement};

async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as unknown as D1;}

const allowed=new Set(["planned","active","review","completed"]);

export async function PATCH(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;
  const input=await request.json() as {taskId?:string;status?:string};
  const taskId=input.taskId?.trim(),requestedStatus=input.status?.trim(),status=requestedStatus==="in_progress"?"active":requestedStatus;
  if(!taskId||!status||!allowed.has(status))return Response.json({error:"Task와 상태가 올바르지 않습니다."},{status:400});
  const db=await runtimeDb();
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  const project=await db.prepare("SELECT id,status FROM projects WHERE id=?").bind(projectId).first<{id:string;status:string}>();
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  if(project.status==="completed")return Response.json({error:"완료된 프로젝트의 Task 상태는 변경할 수 없습니다."},{status:409});
  const task=await db.prepare("SELECT id,kind,progress,assignee_user_id AS assigneeUserId FROM wbs_tasks WHERE id=? AND project_id=?").bind(taskId,projectId).first<{id:string;kind:string;progress:number;assigneeUserId?:string}>();
  if(!task)return Response.json({error:"Task를 찾을 수 없습니다."},{status:404});
  if(task.kind==="summary")return Response.json({error:"그룹 WBS는 칸반 상태를 직접 변경할 수 없습니다."},{status:409});
  if(!canManageProject(context,access.projectRole)&&task.assigneeUserId!==context.userId)return Response.json({error:"PM·PL 또는 Task 담당자만 상태를 변경할 수 있습니다."},{status:403});
  const current=Math.max(0,Math.min(100,Number(task.progress||0)));
  const progress=status==="completed"?100:status==="planned"?0:current>=100?99:current;
  const now=Math.floor(Date.now()/1000);
  await db.prepare("UPDATE wbs_tasks SET status=?,progress=?,updated_at=? WHERE id=? AND project_id=?").bind(status,progress,now,taskId,projectId).run();
  return Response.json({taskId,status,progress,updatedAt:now});
}
