import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const now=()=>Math.floor(Date.now()/1000);
const ADMIN_ROLES=new Set(["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"]);
const GROUPS=[
  {code:"MATERIAL",name:"재료비",sortOrder:10},
  {code:"EXPENSE",name:"경비",sortOrder:20},
  {code:"OUTSOURCE",name:"외주비",sortOrder:30},
  {code:"OTHER",name:"기타",sortOrder:40},
] as const;
const DEFAULT_CATEGORIES=[
  ["MATERIAL_BOM","MATERIAL","BOM 재료비","BOM",10],
  ["MATERIAL_PROTOTYPE","MATERIAL","시제품 재료비","MANUAL",20],
  ["MATERIAL_EXTRA","MATERIAL","기타 재료비","MANUAL",30],
  ["EXPENSE_TRAVEL","EXPENSE","출장비","MANUAL",10],
  ["EXPENSE_TRANSPORT","EXPENSE","운송비","MANUAL",20],
  ["EXPENSE_TEST_CERT","EXPENSE","시험·인증비","MANUAL",30],
  ["EXPENSE_EQUIPMENT","EXPENSE","장비사용료","MANUAL",40],
  ["EXPENSE_CONSUMABLE","EXPENSE","소모품비","MANUAL",50],
  ["OUTSOURCE_DESIGN","OUTSOURCE","외주설계비","MANUAL",10],
  ["OUTSOURCE_MACHINING","OUTSOURCE","외주가공비","MANUAL",20],
  ["OUTSOURCE_DEVELOPMENT","OUTSOURCE","외주개발비","MANUAL",30],
  ["OUTSOURCE_INSTALL","OUTSOURCE","설치·시공비","MANUAL",40],
  ["OUTSOURCE_SERVICE","OUTSOURCE","기술용역비","MANUAL",50],
  ["OTHER_RESERVE","OTHER","예비비","MANUAL",10],
  ["OTHER_ETC","OTHER","기타 비용","MANUAL",20],
] as const;

async function ensureTables(db:D1){
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS project_cost_categories (
      id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,code TEXT NOT NULL,group_code TEXT NOT NULL,name TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'MANUAL',enabled INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS project_cost_categories_company_code_uq ON project_cost_categories(company_id,code)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_cost_profiles (
      company_id TEXT NOT NULL,project_id TEXT PRIMARY KEY NOT NULL,bom_root_part_id TEXT,updated_by TEXT,updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_cost_budgets (
      company_id TEXT NOT NULL,project_id TEXT NOT NULL,category_code TEXT NOT NULL,amount REAL NOT NULL DEFAULT 0,updated_by TEXT,updated_at INTEGER NOT NULL,
      PRIMARY KEY(project_id,category_code)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_cost_entries (
      id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,project_id TEXT NOT NULL,task_id TEXT,category_code TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,occurred_on TEXT NOT NULL,vendor TEXT,note TEXT,created_by TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS project_cost_entries_project_idx ON project_cost_entries(project_id,occurred_on,created_at)"),
  ]);
  try{await db.prepare("ALTER TABLE product_parts ADD COLUMN actual_cost REAL NOT NULL DEFAULT 0").run()}catch{}
}
async function ensureDefaults(db:D1,companyId:string){
  const t=now();
  for(const [code,group,name,source,sort] of DEFAULT_CATEGORIES){
    await db.prepare("INSERT OR IGNORE INTO project_cost_categories (id,company_id,code,group_code,name,source_type,enabled,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?)")
      .bind(`cost-${companyId}-${code.toLowerCase()}`,companyId,code,group,name,source,sort,t,t).run();
  }
}
async function accessibleProjects(db:D1,context:any){
  const admin=context.systemRoles.some((role:string)=>ADMIN_ROLES.has(role));
  const sql=admin
    ?"SELECT id,code,name,status FROM projects WHERE company_id=? AND code NOT LIKE 'SYS-%' ORDER BY updated_at DESC,name"
    :"SELECT p.id,p.code,p.name,p.status FROM projects p WHERE p.company_id=? AND p.code NOT LIKE 'SYS-%' AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?) ORDER BY p.updated_at DESC,p.name";
  const rows=admin?await db.prepare(sql).bind(context.companyId).all():await db.prepare(sql).bind(context.companyId,context.userId).all();
  return rows.results??[];
}
async function requireAccess(db:D1,context:any,projectId:string){
  const project=await db.prepare("SELECT id,code,name,status FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();
  if(!project)throw new Error("PROJECT_NOT_FOUND");
  if(context.systemRoles.some((role:string)=>ADMIN_ROLES.has(role)))return project;
  const member=await db.prepare("SELECT user_id FROM project_members WHERE project_id=? AND user_id=?").bind(projectId,context.userId).first();
  if(!member)throw new Error("PROJECT_FORBIDDEN");
  return project;
}

type PartRow={id:string;partNumber:string;name:string;partType:string;spec?:string;unit:string;targetCost:number;actualCost:number};
type BomRow={id:string;parentPartId:string;childPartId:string;quantity:number;unit:string;sortOrder:number};
function buildBom(rootId:string,parts:PartRow[],bom:BomRow[]){
  const partMap=new Map(parts.map(p=>[p.id,p]));const byParent=new Map<string,BomRow[]>();
  for(const row of bom){const arr=byParent.get(row.parentPartId)||[];arr.push(row);byParent.set(row.parentPartId,arr)}
  for(const arr of byParent.values())arr.sort((a,b)=>a.sortOrder-b.sortOrder);
  const rows:any[]=[];const seen=new Set<string>();
  const calc=(partId:string,qty=1,depth=0,path=new Set<string>()):{target:number;actual:number;leafCount:number;actualLeafCount:number}=>{
    const part=partMap.get(partId);if(!part||path.has(partId))return {target:0,actual:0,leafCount:0,actualLeafCount:0};
    const children=byParent.get(partId)||[];const nextPath=new Set(path);nextPath.add(partId);
    if(!children.length){return {target:Number(part.targetCost||0)*qty,actual:Number(part.actualCost||0)*qty,leafCount:1,actualLeafCount:Number(part.actualCost||0)>0?1:0}}
    let target=0,actual=0,leafCount=0,actualLeafCount=0;
    for(const link of children){const child=partMap.get(link.childPartId);if(!child)continue;const result=calc(link.childPartId,qty*Number(link.quantity||0),depth+1,nextPath);target+=result.target;actual+=result.actual;leafCount+=result.leafCount;actualLeafCount+=result.actualLeafCount;if(!seen.has(link.id)){rows.push({id:link.id,partId:child.id,partNumber:child.partNumber,name:child.name,partType:child.partType,spec:child.spec,unit:link.unit,quantity:link.quantity,depth:depth+1,targetCost:result.target/(qty||1),actualCost:result.actual/(qty||1),hasChildren:(byParent.get(child.id)||[]).length>0});seen.add(link.id)}}
    return {target,actual,leafCount,actualLeafCount};
  };
  const summary=calc(rootId);return {rows,summary};
}

export async function GET(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  await ensureDefaults(db,context.companyId);const url=new URL(request.url);const projectId=String(url.searchParams.get("projectId")||"");
  const projects=await accessibleProjects(db,context);const categories=(await db.prepare("SELECT id,code,group_code AS groupCode,name,source_type AS sourceType,enabled,sort_order AS sortOrder FROM project_cost_categories WHERE company_id=? ORDER BY group_code,sort_order,name").bind(context.companyId).all()).results??[];
  if(!projectId)return Response.json({projects,categories,groups:GROUPS});
  let project:any;try{project=await requireAccess(db,context,projectId)}catch(reason){return Response.json({error:reason instanceof Error&&reason.message==="PROJECT_FORBIDDEN"?"프로젝트 접근 권한이 없습니다.":"프로젝트를 찾을 수 없습니다."},{status:reason instanceof Error&&reason.message==="PROJECT_FORBIDDEN"?403:404})}
  const [profile,budgets,entries,tasks,partsRows,bomRows]=await Promise.all([
    db.prepare("SELECT bom_root_part_id AS bomRootPartId FROM project_cost_profiles WHERE project_id=? AND company_id=?").bind(projectId,context.companyId).first(),
    db.prepare("SELECT category_code AS categoryCode,amount FROM project_cost_budgets WHERE project_id=? AND company_id=?").bind(projectId,context.companyId).all(),
    db.prepare(`SELECT e.id,e.task_id AS taskId,e.category_code AS categoryCode,e.amount,e.occurred_on AS occurredOn,e.vendor,e.note,e.created_at AS createdAt,u.name AS createdBy FROM project_cost_entries e LEFT JOIN users u ON u.id=e.created_by WHERE e.project_id=? AND e.company_id=? ORDER BY e.occurred_on DESC,e.created_at DESC`).bind(projectId,context.companyId).all(),
    db.prepare("SELECT id,wbs_code AS wbsCode,name,kind FROM wbs_tasks WHERE project_id=? ORDER BY sort_order,wbs_code").bind(projectId).all(),
    db.prepare("SELECT id,part_number AS partNumber,name,part_type AS partType,spec,unit,standard_cost AS targetCost,COALESCE(actual_cost,0) AS actualCost FROM product_parts WHERE company_id=? AND status='active' ORDER BY part_number").bind(context.companyId).all().catch(()=>({results:[]})),
    db.prepare("SELECT id,parent_part_id AS parentPartId,child_part_id AS childPartId,quantity,unit,sort_order AS sortOrder FROM product_bom_items WHERE company_id=? ORDER BY parent_part_id,sort_order").bind(context.companyId).all().catch(()=>({results:[]})),
  ]);
  const parts=(partsRows.results??[]) as PartRow[],bom=(bomRows.results??[]) as BomRow[];const roots=parts.filter(p=>bom.some(row=>row.parentPartId===p.id)).map(p=>({id:p.id,partNumber:p.partNumber,name:p.name,partType:p.partType}));
  const rootId=String((profile as any)?.bomRootPartId||"");const built=rootId?buildBom(rootId,parts,bom):{rows:[],summary:{target:0,actual:0,leafCount:0,actualLeafCount:0}};
  return Response.json({projects,project,categories,groups:GROUPS,profile:{bomRootPartId:rootId},budgets:budgets.results??[],entries:entries.results??[],tasks:(tasks.results??[]).filter((row:any)=>row.kind!=="summary"),bom:{roots,rootId,rows:built.rows,targetMaterial:built.summary.target,actualMaterial:built.summary.actual,coverage:built.summary.leafCount?Math.round(built.summary.actualLeafCount/built.summary.leafCount*100):0}});
}

export async function POST(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  await ensureDefaults(db,context.companyId);const input=await request.json() as any;const action=String(input.action||"");const projectId=String(input.projectId||"");
  if(["save-profile","save-budget","add-entry","delete-entry"].includes(action)){try{await requireAccess(db,context,projectId)}catch(reason){return Response.json({error:"프로젝트 접근 권한이 없습니다."},{status:403})}}
  const t=now();
  if(action==="save-profile"){
    const rootId=String(input.bomRootPartId||"");if(rootId){const root=await db.prepare("SELECT id FROM product_parts WHERE id=? AND company_id=?").bind(rootId,context.companyId).first();if(!root)return Response.json({error:"BOM Root를 찾을 수 없습니다."},{status:404})}
    await db.prepare("INSERT INTO project_cost_profiles (company_id,project_id,bom_root_part_id,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET bom_root_part_id=excluded.bom_root_part_id,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(context.companyId,projectId,rootId||null,context.userId,t).run();return Response.json({ok:true});
  }
  if(action==="save-budget"){
    const categoryCode=String(input.categoryCode||"");const amount=Math.max(0,Number(input.amount||0));const category=await db.prepare("SELECT code,source_type AS sourceType FROM project_cost_categories WHERE company_id=? AND code=? AND enabled=1").bind(context.companyId,categoryCode).first() as any;if(!category)return Response.json({error:"비용 카테고리를 찾을 수 없습니다."},{status:404});if(category.sourceType==="BOM")return Response.json({error:"BOM 재료비 예산은 BOM 목표원가에서 자동 계산됩니다."},{status:409});await db.prepare("INSERT INTO project_cost_budgets (company_id,project_id,category_code,amount,updated_by,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(project_id,category_code) DO UPDATE SET amount=excluded.amount,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(context.companyId,projectId,categoryCode,amount,context.userId,t).run();return Response.json({ok:true});
  }
  if(action==="add-entry"){
    const categoryCode=String(input.categoryCode||"");const category=await db.prepare("SELECT source_type AS sourceType FROM project_cost_categories WHERE company_id=? AND code=? AND enabled=1").bind(context.companyId,categoryCode).first() as any;if(!category)return Response.json({error:"비용 카테고리를 찾을 수 없습니다."},{status:404});if(category.sourceType==="BOM")return Response.json({error:"BOM 재료비는 수동 비용 실적으로 등록하지 않습니다."},{status:409});const amount=Number(input.amount||0);if(!(amount>0))return Response.json({error:"금액을 입력해 주세요."},{status:400});const taskId=String(input.taskId||"");if(taskId){const task=await db.prepare("SELECT id,kind FROM wbs_tasks WHERE id=? AND project_id=?").bind(taskId,projectId).first() as any;if(!task||task.kind==="summary")return Response.json({error:"연결할 실행 Task를 확인해 주세요."},{status:400})}const id=crypto.randomUUID();await db.prepare("INSERT INTO project_cost_entries (id,company_id,project_id,task_id,category_code,amount,occurred_on,vendor,note,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,context.companyId,projectId,taskId||null,categoryCode,amount,String(input.occurredOn||new Date().toISOString().slice(0,10)),String(input.vendor||"").trim()||null,String(input.note||"").trim()||null,context.userId,t,t).run();return Response.json({ok:true,id},{status:201});
  }
  if(action==="delete-entry"){
    const id=String(input.id||"");const entry=await db.prepare("SELECT id,created_by AS createdBy FROM project_cost_entries WHERE id=? AND project_id=? AND company_id=?").bind(id,projectId,context.companyId).first() as any;if(!entry)return Response.json({error:"비용 실적을 찾을 수 없습니다."},{status:404});const admin=context.systemRoles.some((role:string)=>ADMIN_ROLES.has(role));if(!admin&&entry.createdBy!==context.userId)return Response.json({error:"본인이 등록한 비용 실적만 삭제할 수 있습니다."},{status:403});await db.prepare("DELETE FROM project_cost_entries WHERE id=? AND project_id=? AND company_id=?").bind(id,projectId,context.companyId).run();return Response.json({ok:true});
  }
  if(action==="update-part-cost"){
    const partId=String(input.partId||"");const target=Math.max(0,Number(input.targetCost||0)),actual=Math.max(0,Number(input.actualCost||0));const part=await db.prepare("SELECT id FROM product_parts WHERE id=? AND company_id=?").bind(partId,context.companyId).first();if(!part)return Response.json({error:"PART를 찾을 수 없습니다."},{status:404});await db.prepare("UPDATE product_parts SET standard_cost=?,actual_cost=?,updated_at=? WHERE id=? AND company_id=?").bind(target,actual,t,partId,context.companyId).run();return Response.json({ok:true});
  }
  if(action==="save-category"){
    if(!context.systemRoles.some((role:string)=>ADMIN_ROLES.has(role)))return Response.json({error:"시스템 관리자만 비용 카테고리를 수정할 수 있습니다."},{status:403});const code=String(input.code||"").trim().toUpperCase().replace(/\s+/g,"_");const group=String(input.groupCode||"").trim().toUpperCase();const name=String(input.name||"").trim();if(!code||!name||!GROUPS.some(g=>g.code===group))return Response.json({error:"카테고리 정보를 확인해 주세요."},{status:400});if(code==="MATERIAL_BOM")return Response.json({error:"BOM 재료비 시스템 항목은 수정할 수 없습니다."},{status:409});const id=String(input.id||"")||crypto.randomUUID();await db.prepare("INSERT INTO project_cost_categories (id,company_id,code,group_code,name,source_type,enabled,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,'MANUAL',?,?,?,?) ON CONFLICT(company_id,code) DO UPDATE SET group_code=excluded.group_code,name=excluded.name,enabled=excluded.enabled,sort_order=excluded.sort_order,updated_at=excluded.updated_at").bind(id,context.companyId,code,group,name,input.enabled===false?0:1,Number(input.sortOrder||0),t,t).run();return Response.json({ok:true,id});
  }
  return Response.json({error:"지원하지 않는 요청입니다."},{status:400});
}
