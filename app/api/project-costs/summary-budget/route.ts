import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const ADMIN_ROLES=new Set(["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"]);
const KEYS=new Set(["MATERIAL_OTHER","EXPENSE","OUTSOURCE","OTHER"]);

async function requireAccess(db:D1,context:any,projectId:string){
  const project=await db.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();
  if(!project)throw new Error("NOT_FOUND");
  if(context.systemRoles.some((role:string)=>ADMIN_ROLES.has(role)))return;
  const member=await db.prepare("SELECT user_id FROM project_members WHERE project_id=? AND user_id=?").bind(projectId,context.userId).first();
  if(!member)throw new Error("FORBIDDEN");
}

export async function POST(request:Request){
  const db=await runtimeDb();let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as {projectId?:string;budgetKey?:string;amount?:number};
  const projectId=String(input.projectId||""),budgetKey=String(input.budgetKey||"").toUpperCase();
  if(!projectId||!KEYS.has(budgetKey))return Response.json({error:"예산 구분을 확인해 주세요."},{status:400});
  try{await requireAccess(db,context,projectId)}catch(reason){return Response.json({error:reason instanceof Error&&reason.message==="FORBIDDEN"?"프로젝트 접근 권한이 없습니다.":"프로젝트를 찾을 수 없습니다."},{status:reason instanceof Error&&reason.message==="FORBIDDEN"?403:404})}
  const amount=Math.max(0,Number(input.amount||0)),t=Math.floor(Date.now()/1000);
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_cost_budgets (company_id TEXT NOT NULL,project_id TEXT NOT NULL,category_code TEXT NOT NULL,amount REAL NOT NULL DEFAULT 0,updated_by TEXT,updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,category_code))`).run();
  await db.prepare("INSERT INTO project_cost_budgets (company_id,project_id,category_code,amount,updated_by,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(project_id,category_code) DO UPDATE SET amount=excluded.amount,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
    .bind(context.companyId,projectId,`SUMMARY_${budgetKey}`,amount,context.userId,t).run();
  return Response.json({ok:true,budgetKey,amount});
}
