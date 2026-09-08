import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
import {ensureProjectDataFoundation,type RuntimeD1} from "../../../../../db/project-data-foundation";
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";

type Update={id:string;plannedStart:string;plannedEnd:string;durationDays?:number};
async function runtimeDb():Promise<RuntimeD1>{return getLegacyDbCompat() as RuntimeD1;}

export async function PATCH(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;const db=await runtimeDb();await ensureProjectDataFoundation(db);
  let context,access;try{context=await resolveRequestContext(request,db);access=await requireProjectAccess(db,context,projectId,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole))return Response.json({error:"PM 또는 PL만 프로젝트 일정을 변경할 수 있습니다."},{status:403});
  const input=await request.json() as {updates?:Update[];autoShift?:boolean};const updates=(input.updates??[]).filter(item=>item.id&&item.plannedStart&&item.plannedEnd).map(item=>({...item,durationDays:Math.max(1,Number(item.durationDays)||Math.round((Date.parse(`${item.plannedEnd}T00:00:00Z`)-Date.parse(`${item.plannedStart}T00:00:00Z`))/86_400_000)+1)}));
  if(!updates.length)return Response.json({error:"변경할 일정을 선택해 주세요."},{status:400});
  if(updates.some(item=>item.plannedStart>item.plannedEnd))return Response.json({error:"종료일은 시작일보다 빠를 수 없습니다."},{status:400});
  const rows=await db.prepare("SELECT id FROM wbs_tasks WHERE project_id=?").bind(projectId).all();const allowed=new Set((rows.results??[]).map((row:{id:unknown})=>String(row.id)));
  if(updates.some(item=>!allowed.has(item.id)))return Response.json({error:"다른 프로젝트의 Task가 포함되어 있습니다."},{status:400});
  const now=Math.floor(Date.now()/1000);await db.batch([
    ...updates.map(item=>db.prepare("UPDATE wbs_tasks SET planned_start=?,planned_end=?,duration_days=?,updated_at=? WHERE id=? AND project_id=?").bind(item.plannedStart,item.plannedEnd,item.durationDays,now,item.id,projectId)),
    db.prepare("UPDATE projects SET updated_at=? WHERE id=?").bind(now,projectId),
    db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'SCHEDULE_UPDATED','PROJECT',?,?,?)").bind(crypto.randomUUID(),context.companyId,context.userId,projectId,JSON.stringify({taskIds:updates.map(item=>item.id),autoShift:Boolean(input.autoShift)}),now),
  ]);
  return Response.json({ok:true,updates});
}
