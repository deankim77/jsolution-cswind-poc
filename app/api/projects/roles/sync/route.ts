import { getLegacyDbCompat } from "../../../../../db/postgres-d1-compat";
import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
/* eslint-disable @typescript-eslint/no-explicit-any */
type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};

async function runtimeDb():Promise<D1>{
  return getLegacyDbCompat() as D1;
}

const normalize=(value:string)=>value.trim().toLowerCase();

export async function POST(request:Request){
  const db=await runtimeDb();
  const input=await request.json() as {projectCode?:string;roleCodes?:string[];replaceUnused?:boolean};
  const projectCode=input.projectCode?.trim();
  if(!projectCode)return Response.json({error:"프로젝트 코드를 확인할 수 없습니다."},{status:400});

  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  const project=await db.prepare("SELECT id FROM projects WHERE lower(code)=lower(?) AND company_id=?").bind(projectCode,context.companyId).first() as {id:string}|null;
  if(!project)return Response.json({error:"프로젝트를 찾을 수 없습니다."},{status:404});
  let access;try{access=await requireProjectAccess(db,context,project.id,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"프로젝트 권한을 확인하지 못했습니다."},{status:500})}
  if(!canManageProject(context,access.projectRole))return Response.json({error:"PM 또는 PL만 프로젝트 Role을 동기화할 수 있습니다."},{status:403});

  // 화면에서 전달된 Role뿐 아니라 현재 DB WBS가 실제 사용 중인 Role도 함께 보정한다.
  // 기존/복사 프로젝트에서 template roles와 task.role_code가 어긋난 경우에도 저장 전에 자동 복구된다.
  const stored=await db.prepare("SELECT DISTINCT role_code AS roleCode FROM wbs_tasks WHERE project_id=? AND role_code IS NOT NULL AND trim(role_code)<>''")
    .bind(project.id).all();
  const storedRoleCodes=(stored.results as Array<{roleCode?:string|null}>)
    .map(item=>item.roleCode?.trim())
    .filter((code):code is string=>Boolean(code));

  const requested=Array.from(new Map([
    ...storedRoleCodes,
    ...(input.roleCodes??[]).map(code=>code?.trim()).filter((code):code is string=>Boolean(code)),
  ].map(code=>[normalize(code),code])).values());

  if(!requested.length)return Response.json({ok:true,added:0});

  const result=await db.prepare("SELECT code FROM project_roles WHERE project_id=?").bind(project.id).all();
  const existing=new Set((result.results as Array<{code:string}>).map(item=>normalize(item.code)));
  const missing=requested.filter(code=>!existing.has(normalize(code)));
  const now=Math.floor(Date.now()/1000);
  const count=await db.prepare("SELECT COUNT(*) AS count FROM project_roles WHERE project_id=?").bind(project.id).first() as {count:number}|null;
  const start=Number(count?.count)||0;
  if(missing.length)await db.batch(missing.map((code,index)=>db.prepare("INSERT OR IGNORE INTO project_roles (id,project_id,code,name,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),project.id,code,code,start+index,now,now)));

  let removed=0;
  if(input.replaceUnused){
    const [memberRoles,currentRoles]=await Promise.all([
      db.prepare("SELECT DISTINCT project_role AS code FROM project_members WHERE project_id=?").bind(project.id).all(),
      db.prepare("SELECT id,code FROM project_roles WHERE project_id=?").bind(project.id).all(),
    ]);
    const keep=new Set([...requested,...(memberRoles.results as Array<{code:string}>).map(item=>item.code)].map(normalize));
    const obsolete=(currentRoles.results as Array<{id:string;code:string}>).filter(item=>!keep.has(normalize(item.code)));
    if(obsolete.length)await db.batch(obsolete.map(item=>db.prepare("DELETE FROM project_roles WHERE id=? AND project_id=?").bind(item.id,project.id)));
    removed=obsolete.length;
  }

  return Response.json({ok:true,added:missing.length,removed,roles:missing});
}
