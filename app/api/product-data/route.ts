import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}

async function ensureTables(_db:D1){return;}

const now=()=>Math.floor(Date.now()/1000);
const codeForType=(value:string)=>({PRODUCT:"PRD",TOP_ITEM:"PRD",ASSEMBLY:"ASM",SUB_ASSEMBLY:"ASM",FABRIC:"FAB",FOAM:"FRM",FRAME:"MET",TRIM:"TRM",PART:"PRT"} as Record<string,string>)[value]||"PRT";
async function nextPartNumber(db:D1,companyId:string,partType:string){
  const prefix=`${codeForType(partType)}-${new Date().getUTCFullYear()}-`;
  const latest=await db.prepare("SELECT part_number AS partNumber FROM product_parts WHERE company_id=? AND part_number LIKE ? ORDER BY part_number DESC LIMIT 1").bind(companyId,`${prefix}%`).first<{partNumber?:string}>();
  const seq=Math.max(0,Number(latest?.partNumber?.match(/(\d+)$/)?.[1]||0))+1;
  return `${prefix}${String(seq).padStart(4,"0")}`;
}

async function seedDemo(db:D1,companyId:string,userId:string){
  const existing=await db.prepare("SELECT COUNT(*) AS count FROM product_parts WHERE company_id=?").bind(companyId).first<{count:number}>();
  if(Number(existing?.count||0)>0)return;
  const t=now();
  const parts=[
    {id:crypto.randomUUID(),number:"ASM-2026-0001",name:"자동차 시트 원단 ASSY",type:"ASSEMBLY",spec:"CIM Demo Seat Trim Assembly",unit:"EA",cost:0},
    {id:crypto.randomUUID(),number:"FAB-2026-0001",name:"친환경 스웨이드 원단",type:"FABRIC",spec:"폭 1,420mm / 450g",unit:"M",cost:18500},
    {id:crypto.randomUUID(),number:"FRM-2026-0001",name:"시트 폼 패드",type:"FOAM",spec:"PU Foam 45D",unit:"EA",cost:12800},
    {id:crypto.randomUUID(),number:"MET-2026-0001",name:"시트 프레임",type:"FRAME",spec:"SPHC Press Frame",unit:"EA",cost:32700},
    {id:crypto.randomUUID(),number:"TRM-2026-0001",name:"봉제사 및 부자재",type:"TRIM",spec:"Thread / Label / Clip",unit:"SET",cost:6300},
  ];
  const root=parts[0];
  const statements:any[]=[];
  for(const p of parts){statements.push(db.prepare("INSERT INTO product_parts (id,company_id,part_number,name,part_type,spec,unit,revision,status,standard_cost,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'A','active',?,?,?,?)").bind(p.id,companyId,p.number,p.name,p.type,p.spec,p.unit,p.cost,userId,t,t));statements.push(db.prepare("INSERT INTO part_number_history (id,company_id,part_id,part_number,rule_code,created_by,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),companyId,p.id,p.number,"TYPE-YYYY-SEQ4",userId,t));}
  [[parts[1],1.8],[parts[2],1],[parts[3],1],[parts[4],1]].forEach(([child,qty],index)=>statements.push(db.prepare("INSERT INTO product_bom_items (id,company_id,parent_part_id,child_part_id,quantity,unit,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),companyId,root.id,(child as any).id,qty,(child as any).unit,index,t,t)));
  await db.batch(statements);
}

function rollup(parts:any[],bom:any[]){
  const byId=new Map(parts.map(p=>[p.id,p]));const children=new Map<string,any[]>();
  for(const row of bom)children.set(row.parentPartId,[...(children.get(row.parentPartId)||[]),row]);
  const memo=new Map<string,number>();const calc=(id:string,seen=new Set<string>()):number=>{if(memo.has(id))return memo.get(id)!;if(seen.has(id))return 0;seen.add(id);const childRows=children.get(id)||[];const value=childRows.length?childRows.reduce((sum,row)=>sum+calc(row.childPartId,new Set(seen))*Number(row.quantity||0),0):Number(byId.get(id)?.standardCost||0);memo.set(id,value);return value};
  return Object.fromEntries(parts.map(p=>[p.id,Math.round(calc(p.id)*100)/100]));
}

async function createsCycle(db:D1,companyId:string,parentId:string,childId:string){
  const rows=await db.prepare("SELECT parent_part_id AS parentPartId,child_part_id AS childPartId FROM product_bom_items WHERE company_id=?").bind(companyId).all();
  const children=new Map<string,string[]>();
  for(const row of rows.results??[]){const item=row as any;children.set(item.parentPartId,[...(children.get(item.parentPartId)||[]),item.childPartId]);}
  const stack=[childId],seen=new Set<string>();
  while(stack.length){const id=stack.pop()!;if(id===parentId)return true;if(seen.has(id))continue;seen.add(id);stack.push(...(children.get(id)||[]));}
  return false;
}

export async function GET(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  await seedDemo(db,context.companyId,context.userId);
  const [partRows,bomRows,costRows,historyRows,lockRows]=await Promise.all([
    db.prepare("SELECT id,part_number AS partNumber,name,part_type AS partType,spec,unit,revision,status,standard_cost AS standardCost,updated_at AS updatedAt FROM product_parts WHERE company_id=? ORDER BY CASE part_type WHEN 'TOP_ITEM' THEN 0 WHEN 'PRODUCT' THEN 0 WHEN 'ASSEMBLY' THEN 1 WHEN 'SUB_ASSEMBLY' THEN 1 ELSE 3 END,part_number").bind(context.companyId).all(),
    db.prepare(`SELECT b.id,b.parent_part_id AS parentPartId,p.part_number AS parentNumber,p.name AS parentName,b.child_part_id AS childPartId,c.part_number AS childNumber,c.name AS childName,b.quantity,b.unit,b.sort_order AS sortOrder,b.note FROM product_bom_items b JOIN product_parts p ON p.id=b.parent_part_id JOIN product_parts c ON c.id=b.child_part_id WHERE b.company_id=? ORDER BY p.part_number,b.sort_order,c.part_number`).bind(context.companyId).all(),
    db.prepare(`SELECT s.id,s.part_id AS partId,p.part_number AS partNumber,p.name AS partName,s.version,s.material_cost AS materialCost,s.labor_cost AS laborCost,s.overhead_cost AS overheadCost,s.total_cost AS totalCost,s.note,s.status,s.created_at AS createdAt,u.name AS createdBy FROM cost_sheets s JOIN product_parts p ON p.id=s.part_id LEFT JOIN users u ON u.id=s.created_by WHERE s.company_id=? ORDER BY s.updated_at DESC`).bind(context.companyId).all(),
    db.prepare("SELECT h.id,h.part_id AS partId,h.part_number AS partNumber,h.rule_code AS ruleCode,h.created_at AS createdAt,u.name AS createdBy FROM part_number_history h LEFT JOIN users u ON u.id=h.created_by WHERE h.company_id=? ORDER BY h.created_at DESC LIMIT 30").bind(context.companyId).all(),
    db.prepare("SELECT l.root_part_id AS rootPartId,l.locked_by AS lockedBy,l.locked_at AS lockedAt,u.name AS lockedByName FROM bom_edit_locks l LEFT JOIN users u ON u.id=l.locked_by WHERE l.company_id=?").bind(context.companyId).all(),
  ]);
  const parts=partRows.results??[],bom=bomRows.results??[],rollupCost=rollup(parts,bom);
  return Response.json({parts:parts.map((p:any)=>({...p,rollupCost:rollupCost[p.id]??Number(p.standardCost||0)})),bom,costSheets:costRows.results??[],numberHistory:historyRows.results??[],bomLocks:lockRows.results??[],currentUserId:context.userId,numberRule:"{TYPE}-{YYYY}-{SEQ4}"});
}

export async function POST(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as any,action=String(input.action||"");const t=now();
  if(action==="checkout-bom"){
    const rootPartId=String(input.rootPartId||"");if(!rootPartId)return Response.json({error:"편집할 BOM을 선택해 주세요."},{status:400});
    const part=await db.prepare("SELECT id FROM product_parts WHERE id=? AND company_id=?").bind(rootPartId,context.companyId).first();if(!part)return Response.json({error:"BOM을 찾지 못했습니다."},{status:404});
    const existing=await db.prepare("SELECT locked_by AS lockedBy,locked_at AS lockedAt FROM bom_edit_locks WHERE company_id=? AND root_part_id=?").bind(context.companyId,rootPartId).first<{lockedBy:string;lockedAt:number}>();
    if(existing?.lockedBy&&existing.lockedBy!==context.userId){const owner=await db.prepare("SELECT name FROM users WHERE id=?").bind(existing.lockedBy).first<{name?:string}>();return Response.json({error:`${owner?.name||"다른 사용자"}님이 현재 이 BOM을 편집 중입니다.`,lockedBy:existing.lockedBy,lockedByName:owner?.name||"다른 사용자",lockedAt:existing.lockedAt},{status:409})}
    if(existing?.lockedBy===context.userId)return Response.json({ok:true,rootPartId,lockedBy:context.userId,lockedAt:existing.lockedAt,alreadyCheckedOut:true});
    await db.prepare("INSERT INTO bom_edit_locks (id,company_id,root_part_id,locked_by,locked_at,updated_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,rootPartId,context.userId,t,t).run();
    return Response.json({ok:true,rootPartId,lockedBy:context.userId,lockedAt:t},{status:201});
  }
  if(action==="checkin-bom"){
    const rootPartId=String(input.rootPartId||"");if(!rootPartId)return Response.json({error:"Check-in할 BOM을 선택해 주세요."},{status:400});
    const existing=await db.prepare("SELECT locked_by AS lockedBy FROM bom_edit_locks WHERE company_id=? AND root_part_id=?").bind(context.companyId,rootPartId).first<{lockedBy:string}>();
    if(!existing)return Response.json({ok:true,rootPartId,alreadyCheckedIn:true});
    if(existing.lockedBy!==context.userId)return Response.json({error:"다른 사용자가 편집 중인 BOM은 Check-in할 수 없습니다."},{status:403});
    await db.prepare("DELETE FROM bom_edit_locks WHERE company_id=? AND root_part_id=? AND locked_by=?").bind(context.companyId,rootPartId,context.userId).run();
    return Response.json({ok:true,rootPartId});
  }
  if(action==="create-part"){
    const name=String(input.name||"").trim(),partType=String(input.partType||"PART").toUpperCase(),unit=String(input.unit||"EA").trim()||"EA";if(!name)return Response.json({error:"품명을 입력해 주세요."},{status:400});
    const partNumber=await nextPartNumber(db,context.companyId,partType),id=crypto.randomUUID();
    await db.batch([db.prepare("INSERT INTO product_parts (id,company_id,part_number,name,part_type,spec,unit,revision,status,standard_cost,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'A','active',?,?,?,?)").bind(id,context.companyId,partNumber,name,partType,String(input.spec||"").trim()||null,unit,Math.max(0,Number(input.standardCost)||0),context.userId,t,t),db.prepare("INSERT INTO part_number_history (id,company_id,part_id,part_number,rule_code,created_by,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,id,partNumber,"TYPE-YYYY-SEQ4",context.userId,t)]);
    return Response.json({ok:true,id,partNumber},{status:201});
  }
  if(action==="add-bom"){
    const rootPartId=String(input.rootPartId||""),parentPartId=String(input.parentPartId||""),childPartId=String(input.childPartId||"");
    if(!rootPartId||!parentPartId||!childPartId||parentPartId===childPartId)return Response.json({error:"BOM Root와 상위/하위 Part를 확인해 주세요."},{status:400});
    const lock=await db.prepare("SELECT locked_by AS lockedBy FROM bom_edit_locks WHERE company_id=? AND root_part_id=?").bind(context.companyId,rootPartId).first<{lockedBy:string}>();
    if(!lock||lock.lockedBy!==context.userId)return Response.json({error:"BOM 편집 시작 후 PART를 추가할 수 있습니다."},{status:403});
    const partRows=await db.prepare("SELECT id,part_type AS partType,unit FROM product_parts WHERE company_id=? AND id IN (?,?,?)").bind(context.companyId,rootPartId,parentPartId,childPartId).all();
    if((partRows.results??[]).length<2)return Response.json({error:"등록 가능한 Part를 찾지 못했습니다."},{status:404});
    if(await createsCycle(db,context.companyId,parentPartId,childPartId))return Response.json({error:"순환 BOM 구조는 생성할 수 없습니다."},{status:409});
    const parent=(partRows.results??[]).find((row:any)=>row.id===parentPartId) as any,child=(partRows.results??[]).find((row:any)=>row.id===childPartId) as any;
    if(!parent||!child)return Response.json({error:"상위/하위 Part를 찾지 못했습니다."},{status:404});
    const parentRole=String(parent.partType||"PART").toUpperCase();
    if(parentRole==="PART"&&!input.promoteParent)return Response.json({error:"ROLE_PROMOTION_REQUIRED",message:"현재 Part 역할입니다. Assembly 역할로 변경한 뒤 하위 구조를 추가할 수 있습니다.",parentPartId},{status:409});
    const nextSort=await db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS sortOrder FROM product_bom_items WHERE company_id=? AND parent_part_id=?").bind(context.companyId,parentPartId).first<{sortOrder:number}>();
    try{
      const statements:any[]=[];
      if(parentRole==="PART"&&input.promoteParent)statements.push(db.prepare("UPDATE product_parts SET part_type='ASSEMBLY',updated_at=? WHERE company_id=? AND id=?").bind(t,context.companyId,parentPartId));
      statements.push(db.prepare("INSERT INTO product_bom_items (id,company_id,parent_part_id,child_part_id,quantity,unit,sort_order,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,parentPartId,childPartId,Math.max(.001,Number(input.quantity)||1),String(input.unit||child.unit||"EA"),Math.max(0,Number(input.sortOrder??nextSort?.sortOrder??0)),String(input.note||"").trim()||null,t,t));
      await db.batch(statements);
    }catch{return Response.json({error:"이미 BOM에 등록된 하위 Part입니다."},{status:409})}
    return Response.json({ok:true,parentRole:parentRole==="PART"&&input.promoteParent?"ASSEMBLY":parentRole},{status:201});
  }
  if(action==="save-cost"){
    const partId=String(input.partId||"");const part=await db.prepare("SELECT id FROM product_parts WHERE id=? AND company_id=?").bind(partId,context.companyId).first();if(!part)return Response.json({error:"원가 대상 Part를 찾지 못했습니다."},{status:404});
    const latest=await db.prepare("SELECT COALESCE(MAX(version),0) AS version FROM cost_sheets WHERE company_id=? AND part_id=?").bind(context.companyId,partId).first<{version:number}>();const version=Number(latest?.version||0)+1;
    const material=Math.max(0,Number(input.materialCost)||0),labor=Math.max(0,Number(input.laborCost)||0),overhead=Math.max(0,Number(input.overheadCost)||0),total=material+labor+overhead;
    await db.prepare("INSERT INTO cost_sheets (id,company_id,part_id,version,material_cost,labor_cost,overhead_cost,total_cost,note,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'approved',?,?,?)").bind(crypto.randomUUID(),context.companyId,partId,version,material,labor,overhead,total,String(input.note||"").trim()||null,context.userId,t,t).run();
    return Response.json({ok:true,version,totalCost:total},{status:201});
  }
  return Response.json({error:"지원하지 않는 작업입니다."},{status:400});
}