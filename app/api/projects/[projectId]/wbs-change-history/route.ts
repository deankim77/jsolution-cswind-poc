import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1}

async function ensureTables(db:D1){await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS project_wbs_change_sets (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,checked_in_at integer NOT NULL,checked_in_by text,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
  db.prepare("CREATE INDEX IF NOT EXISTS project_wbs_change_sets_project_time_idx ON project_wbs_change_sets(project_id,checked_in_at DESC)"),
  db.prepare("CREATE TABLE IF NOT EXISTS project_wbs_change_items (id text PRIMARY KEY NOT NULL,change_set_id text NOT NULL,project_id text NOT NULL,task_id text,wbs_code text,task_name text,change_type text NOT NULL,before_value text,after_value text,sort_order integer NOT NULL DEFAULT 0,FOREIGN KEY(change_set_id) REFERENCES project_wbs_change_sets(id) ON DELETE CASCADE,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
  db.prepare("CREATE INDEX IF NOT EXISTS project_wbs_change_items_task_idx ON project_wbs_change_items(project_id,task_id)"),
])}

const parseValue=(value:unknown)=>{if(value===null||value===undefined||value==="")return null;try{return JSON.parse(String(value))}catch{return String(value)}};

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"프로젝트 접근 권한을 확인하지 못했습니다."},{status:403})}
  await ensureTables(db);
  const url=new URL(request.url),requested=Math.max(1,Math.min(50,Number(url.searchParams.get("limit")||20)));
  const setsRows=await db.prepare("SELECT s.id,s.checked_in_at AS checkedInAt,s.checked_in_by AS checkedInBy,u.name AS changedBy FROM project_wbs_change_sets s LEFT JOIN users u ON u.id=s.checked_in_by WHERE s.project_id=? ORDER BY s.checked_in_at DESC LIMIT ?").bind(projectId,requested).all();
  const sets=(setsRows.results??[]) as any[];
  if(!sets.length)return Response.json({sets:[],latest:null,hasMore:false});
  const ids=sets.map(set=>String(set.id));
  const placeholders=ids.map(()=>"?").join(",");
  const itemsRows=await db.prepare(`SELECT id,change_set_id AS changeSetId,task_id AS taskId,wbs_code AS wbsCode,task_name AS taskName,change_type AS changeType,before_value AS beforeValue,after_value AS afterValue,sort_order AS sortOrder FROM project_wbs_change_items WHERE project_id=? AND change_set_id IN (${placeholders}) ORDER BY sort_order,id`).bind(projectId,...ids).all();
  const bySet=new Map<string,any[]>();
  for(const row of (itemsRows.results??[]) as any[]){const item={...row,beforeValue:parseValue(row.beforeValue),afterValue:parseValue(row.afterValue)};const list=bySet.get(String(row.changeSetId))??[];list.push(item);bySet.set(String(row.changeSetId),list)}
  const output=sets.map(set=>{const items=bySet.get(String(set.id))??[];const taskIds=new Set(items.map(item=>item.taskId).filter(Boolean));const counts=items.reduce((acc:any,item:any)=>{acc[item.changeType]=(acc[item.changeType]||0)+1;return acc},{});return {...set,items,changeCount:items.length,taskCount:taskIds.size,counts}});
  return Response.json({sets:output,latest:output[0]??null,hasMore:sets.length===requested});
}
