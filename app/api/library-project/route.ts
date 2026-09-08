import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
import {ensureProjectDataFoundation,type RuntimeD1} from "../../../db/project-data-foundation";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type D1=RuntimeD1;
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}

const LIBRARY_CODE="SYS-DOCUMENT-LIBRARY";
const LIBRARY_NAME="공통 문서 라이브러리";

export async function GET(request:Request){
  const db=await runtimeDb();
  await ensureProjectDataFoundation(db);
  let context;
  try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}

  let project=await db.prepare("SELECT id,code,name FROM projects WHERE company_id=? AND code=? LIMIT 1").bind(context.companyId,LIBRARY_CODE).first() as {id:string;code:string;name:string}|null;
  const now=Math.floor(Date.now()/1000);
  if(!project){
    const template=await db.prepare("SELECT tv.id,tv.definition FROM template_versions tv JOIN templates t ON t.id=tv.template_id WHERE t.company_id=? ORDER BY COALESCE(tv.published_at,0) DESC,tv.created_at DESC LIMIT 1").bind(context.companyId).first() as {id:string;definition?:string}|null;
    if(!template)return Response.json({error:"공통 문서 라이브러리를 초기화할 프로젝트 템플릿이 없습니다."},{status:409});
    const today=new Date().toISOString().slice(0,10),id=crypto.randomUUID();
    await db.prepare("INSERT INTO projects (id,company_id,template_version_id,code,name,start_date,end_date,status,template_snapshot,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id,context.companyId,template.id,LIBRARY_CODE,LIBRARY_NAME,today,"2099-12-31","system",template.definition||"{}",now,now).run();
    project={id,code:LIBRARY_CODE,name:LIBRARY_NAME};
  }else{
    await db.prepare("UPDATE projects SET status='system',updated_at=? WHERE id=? AND company_id=?").bind(now,project.id,context.companyId).run();
  }

  await db.prepare("INSERT OR IGNORE INTO project_members (project_id,user_id,project_role,created_at,updated_at) VALUES (?,?,?,?,?)").bind(project.id,context.userId,"PM",now,now).run();
  return Response.json({projectId:project.id,code:project.code,name:project.name,systemLibrary:true});
}
