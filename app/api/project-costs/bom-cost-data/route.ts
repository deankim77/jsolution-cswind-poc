import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const ADMIN_ROLES=new Set(["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"]);

async function ensureTables(db:D1){
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_part_costs (
    company_id TEXT NOT NULL,project_id TEXT NOT NULL,part_id TEXT NOT NULL,target_cost REAL NOT NULL DEFAULT 0,actual_cost REAL NOT NULL DEFAULT 0,
    cost_mode TEXT NOT NULL DEFAULT 'AUTO',updated_by TEXT,updated_at INTEGER NOT NULL,PRIMARY KEY(project_id,part_id)
  )`).run();
  try{await db.prepare("ALTER TABLE project_part_costs ADD COLUMN cost_mode TEXT NOT NULL DEFAULT 'AUTO'").run()}catch{}
  await db.prepare(`CREATE TABLE IF NOT EXISTS part_cost_history (
    id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,project_id TEXT NOT NULL,part_id TEXT NOT NULL,target_cost REAL NOT NULL DEFAULT 0,actual_cost REAL NOT NULL DEFAULT 0,
    created_by TEXT,created_at INTEGER NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS part_cost_history_part_idx ON part_cost_history(company_id,part_id,created_at)").run();
}
async function requireAccess(db:D1,context:any,projectId:string){
  const project=await db.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();if(!project)throw new Error("NOT_FOUND");
  if(context.systemRoles.some((role:string)=>ADMIN_ROLES.has(role)))return;
  const member=await db.prepare("SELECT user_id FROM project_members WHERE project_id=? AND user_id=?").bind(projectId,context.userId).first();if(!member)throw new Error("FORBIDDEN");
}

type Part={id:string;partNumber:string;name:string;partType:string;spec?:string;unit:string};
type Link={id:string;parentPartId:string;childPartId:string;quantity:number;unit:string;sortOrder:number};
type Cost={partId:string;targetCost:number;actualCost:number;costMode?:"AUTO"|"DIRECT"};

export async function GET(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const url=new URL(request.url),projectId=String(url.searchParams.get("projectId")||""),rootId=String(url.searchParams.get("rootId")||"");
  if(!projectId)return Response.json({error:"프로젝트를 선택해 주세요."},{status:400});
  try{await requireAccess(db,context,projectId)}catch(reason){return Response.json({error:reason instanceof Error&&reason.message==="FORBIDDEN"?"프로젝트 접근 권한이 없습니다.":"프로젝트를 찾을 수 없습니다."},{status:reason instanceof Error&&reason.message==="FORBIDDEN"?403:404})}
  if(!rootId)return Response.json({rows:[],targetMaterial:0,actualMaterial:0,coverage:0});
  const [partsResult,linksResult,costResult,historyResult]=await Promise.all([
    db.prepare("SELECT id,part_number AS partNumber,name,part_type AS partType,spec,unit FROM product_parts WHERE company_id=? AND status='active'").bind(context.companyId).all(),
    db.prepare("SELECT id,parent_part_id AS parentPartId,child_part_id AS childPartId,quantity,unit,sort_order AS sortOrder FROM product_bom_items WHERE company_id=? ORDER BY parent_part_id,sort_order").bind(context.companyId).all(),
    db.prepare("SELECT part_id AS partId,target_cost AS targetCost,actual_cost AS actualCost,cost_mode AS costMode FROM project_part_costs WHERE company_id=? AND project_id=?").bind(context.companyId,projectId).all(),
    db.prepare(`SELECT h.part_id AS partId,h.target_cost AS targetCost,h.actual_cost AS actualCost,h.project_id AS projectId,p.code AS projectCode,p.name AS projectName,h.created_at AS createdAt
      FROM part_cost_history h LEFT JOIN projects p ON p.id=h.project_id
      WHERE h.company_id=? AND h.project_id<>? ORDER BY h.part_id,h.created_at DESC`).bind(context.companyId,projectId).all(),
  ]);
  const parts=(partsResult.results??[]) as Part[],links=(linksResult.results??[]) as Link[],costs=(costResult.results??[]) as Cost[];
  const partMap=new Map(parts.map(p=>[p.id,p])),costMap=new Map(costs.map(c=>[c.partId,c])),byParent=new Map<string,Link[]>();
  for(const link of links){const rows=byParent.get(link.parentPartId)||[];rows.push(link);byParent.set(link.parentPartId,rows)}for(const rows of byParent.values())rows.sort((a,b)=>a.sortOrder-b.sortOrder);
  const latestRef=new Map<string,any>();for(const row of historyResult.results??[])if(!latestRef.has((row as any).partId))latestRef.set((row as any).partId,row);
  const rows:any[]=[];let leafCount=0,actualLeafCount=0;
  const calc=(partId:string,qty:number,depth:number,path:Set<string>,includeRow:boolean,link?:Link):{target:number;actual:number;covered:number;count:number}=>{
    const part=partMap.get(partId);if(!part||path.has(partId))return {target:0,actual:0,covered:0,count:0};
    const nextPath=new Set(path);nextPath.add(partId);const children=byParent.get(partId)||[],cost=costMap.get(partId)||{partId,targetCost:0,actualCost:0,costMode:"AUTO"},mode=String(cost.costMode||"AUTO")==="DIRECT"?"DIRECT":"AUTO";
    const direct=mode==="DIRECT"||children.length===0;
    const ref=latestRef.get(partId);
    const rowIndex=includeRow?rows.length:-1;
    if(includeRow)rows.push({id:link?.id||`root-${partId}`,partId:part.id,partNumber:part.partNumber,name:part.name,partType:part.partType,spec:part.spec||"",unit:link?.unit||part.unit||"EA",quantity:link?Number(link.quantity||0):1,totalQuantity:qty,depth,targetCost:Number(cost.targetCost||0),actualCost:Number(cost.actualCost||0),targetAmount:0,actualAmount:0,hasChildren:children.length>0,costMode:mode,excludedByDirect:false,reference:ref?{targetCost:Number(ref.targetCost||0),actualCost:Number(ref.actualCost||0),projectCode:ref.projectCode||"",projectName:ref.projectName||""}:null});
    let target=0,actual=0,count=0,covered=0;
    if(direct){target=Number(cost.targetCost||0)*qty;actual=Number(cost.actualCost||0)*qty;count=1;covered=Number(cost.actualCost||0)>0?1:0}
    else for(const childLink of children){const result=calc(childLink.childPartId,qty*Number(childLink.quantity||0),depth+1,nextPath,true,childLink);target+=result.target;actual+=result.actual;count+=result.count;covered+=result.covered}
    if(includeRow&&rowIndex>=0){rows[rowIndex].targetAmount=target;rows[rowIndex].actualAmount=actual}
    return {target,actual,covered,count};
  };
  const root=partMap.get(rootId);if(!root)return Response.json({rows:[],targetMaterial:0,actualMaterial:0,coverage:0,error:"Root PART를 찾을 수 없습니다."},{status:404});
  const result=calc(rootId,1,0,new Set(),true);leafCount=result.count;actualLeafCount=result.covered;
  return Response.json({rows,targetMaterial:result.target,actualMaterial:result.actual,coverage:leafCount?Math.round(actualLeafCount/leafCount*100):0});
}

export async function POST(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as {projectId?:string;partId?:string;targetCost?:number;actualCost?:number;costMode?:string};const projectId=String(input.projectId||""),partId=String(input.partId||"");
  if(!projectId||!partId)return Response.json({error:"프로젝트와 PART를 확인해 주세요."},{status:400});
  try{await requireAccess(db,context,projectId)}catch(reason){return Response.json({error:"프로젝트 접근 권한이 없습니다."},{status:403})}
  const part=await db.prepare("SELECT id FROM product_parts WHERE id=? AND company_id=?").bind(partId,context.companyId).first();if(!part)return Response.json({error:"PART를 찾을 수 없습니다."},{status:404});
  const targetCost=Math.max(0,Number(input.targetCost||0)),actualCost=Math.max(0,Number(input.actualCost||0)),costMode=String(input.costMode||"AUTO")==="DIRECT"?"DIRECT":"AUTO",t=Math.floor(Date.now()/1000);
  await db.prepare("INSERT INTO project_part_costs (company_id,project_id,part_id,target_cost,actual_cost,cost_mode,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(project_id,part_id) DO UPDATE SET target_cost=excluded.target_cost,actual_cost=excluded.actual_cost,cost_mode=excluded.cost_mode,updated_by=excluded.updated_by,updated_at=excluded.updated_at")
    .bind(context.companyId,projectId,partId,targetCost,actualCost,costMode,context.userId,t).run();
  await db.prepare("INSERT INTO part_cost_history (id,company_id,project_id,part_id,target_cost,actual_cost,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),context.companyId,projectId,partId,targetCost,actualCost,context.userId,t).run();
  return Response.json({ok:true,targetCost,actualCost,costMode});
}
