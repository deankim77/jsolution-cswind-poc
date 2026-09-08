import { getLegacyDbCompat } from "../../../../../../db/postgres-d1-compat";
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../../db/request-context";
/* eslint-disable @typescript-eslint/no-explicit-any */
type D1Statement={bind:(...values:unknown[])=>D1Statement;first:<T=any>()=>Promise<T|null>;all:<T=any>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1={prepare:(sql:string)=>D1Statement;batch:(statements:D1Statement[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as unknown as D1;}

const DAY=86400000;
function date(value:string){const parsed=new Date(`${value}T00:00:00Z`);return Number.isFinite(parsed.getTime())?parsed:null;}
function format(value:Date){return value.toISOString().slice(0,10);}
function shift(value:string,days:number){const parsed=date(value);if(!parsed)return value;parsed.setUTCDate(parsed.getUTCDate()+days);return format(parsed);}

export async function PATCH(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;
  const input=await request.json() as {taskId?:string;plannedStart?:string;plannedEnd?:string;autoShiftSuccessors?:boolean};
  const taskId=input.taskId?.trim(),plannedStart=input.plannedStart?.trim(),plannedEnd=input.plannedEnd?.trim();
  if(!taskId||!plannedStart||!plannedEnd)return Response.json({error:"Task와 계획 시작·종료일이 필요합니다."},{status:400});
  const start=date(plannedStart),end=date(plannedEnd);
  if(!start||!end||end.getTime()<start.getTime())return Response.json({error:"계획 기간이 올바르지 않습니다."},{status:400});
  const db=await runtimeDb();
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole))return Response.json({error:"PM 또는 PL만 프로젝트 일정을 변경할 수 있습니다."},{status:403});
  const project=await db.prepare("SELECT id,status FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first<{id:string;status:string}>();
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  if(project.status==="completed")return Response.json({error:"완료된 프로젝트의 일정은 변경할 수 없습니다."},{status:409});
  const task=await db.prepare("SELECT id,kind,planned_start AS plannedStart,planned_end AS plannedEnd FROM wbs_tasks WHERE id=? AND project_id=?").bind(taskId,projectId).first<{id:string;kind:string;plannedStart:string;plannedEnd:string}>();
  if(!task)return Response.json({error:"Task를 찾을 수 없습니다."},{status:404});
  if(task.kind==="summary")return Response.json({error:"그룹 WBS 일정은 하위 Task에서 조정해 주세요."},{status:409});

  const oldEnd=date(task.plannedEnd||plannedEnd);
  const successorShift=oldEnd?Math.round((end.getTime()-oldEnd.getTime())/DAY):0;
  const now=Math.floor(Date.now()/1000);
  const statements:D1Statement[]=[db.prepare("UPDATE wbs_tasks SET planned_start=?,planned_end=?,duration_days=?,updated_at=? WHERE id=? AND project_id=?").bind(plannedStart,plannedEnd,Math.max(1,Math.round((end.getTime()-start.getTime())/DAY)+1),now,taskId,projectId)];
  const shifted:string[]=[];

  if(input.autoShiftSuccessors&&successorShift!==0){
    const rows=(await db.prepare("SELECT id,predecessor_id AS predecessorId,planned_start AS plannedStart,planned_end AS plannedEnd FROM wbs_tasks WHERE project_id=? AND kind='task'").bind(projectId).all<{id:string;predecessorId?:string;plannedStart?:string;plannedEnd?:string}>()).results;
    const children=new Map<string,string[]>();
    rows.forEach(row=>{if(!row.predecessorId)return;const list=children.get(row.predecessorId)||[];list.push(row.id);children.set(row.predecessorId,list)});
    const byId=new Map(rows.map(row=>[row.id,row]));
    const queue=[...(children.get(taskId)||[])],seen=new Set<string>();
    while(queue.length){
      const id=queue.shift()!;if(seen.has(id))continue;seen.add(id);
      const row=byId.get(id);if(row?.plannedStart&&row?.plannedEnd){
        statements.push(db.prepare("UPDATE wbs_tasks SET planned_start=?,planned_end=?,updated_at=? WHERE id=? AND project_id=?").bind(shift(row.plannedStart,successorShift),shift(row.plannedEnd,successorShift),now,id,projectId));
        shifted.push(id);
      }
      queue.push(...(children.get(id)||[]));
    }
  }

  statements.push(db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,"WBS_SCHEDULE_UPDATED","WBS_TASK",taskId,JSON.stringify({projectId,plannedStart,plannedEnd,shiftedSuccessorIds:shifted,autoShiftSuccessors:Boolean(input.autoShiftSuccessors)}),now));
  await db.batch(statements);
  return Response.json({taskId,plannedStart,plannedEnd,shiftedSuccessorIds:shifted,autoShiftSuccessors:Boolean(input.autoShiftSuccessors)});
}
