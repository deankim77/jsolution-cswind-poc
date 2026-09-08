import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const now=()=>Math.floor(Date.now()/1000);

async function requireLock(db:D1,companyId:string,userId:string,rootPartId:string){
  const lock=await db.prepare("SELECT locked_by AS lockedBy FROM bom_edit_locks WHERE company_id=? AND root_part_id=?").bind(companyId,rootPartId).first<{lockedBy:string}>();
  return Boolean(lock&&lock.lockedBy===userId);
}
async function createsCycle(db:D1,companyId:string,movingChildId:string,newParentId:string){
  if(movingChildId===newParentId)return true;
  const rows=await db.prepare("SELECT parent_part_id AS parentPartId,child_part_id AS childPartId FROM product_bom_items WHERE company_id=?").bind(companyId).all();
  const children=new Map<string,string[]>();
  for(const row of rows.results??[]){const item=row as any;children.set(item.parentPartId,[...(children.get(item.parentPartId)||[]),item.childPartId]);}
  const stack=[movingChildId],seen=new Set<string>();
  while(stack.length){const id=stack.pop()!;if(id===newParentId)return true;if(seen.has(id))continue;seen.add(id);stack.push(...(children.get(id)||[]));}
  return false;
}
async function normalizeSort(db:D1,companyId:string,parentId:string){
  const rows=await db.prepare("SELECT id FROM product_bom_items WHERE company_id=? AND parent_part_id=? ORDER BY sort_order,id").bind(companyId,parentId).all();
  const statements=(rows.results??[]).map((row:any,index:number)=>db.prepare("UPDATE product_bom_items SET sort_order=?,updated_at=? WHERE company_id=? AND id=?").bind(index,now(),companyId,row.id));
  if(statements.length)await db.batch(statements);
}

export async function POST(request:Request){
  const db=await runtimeDb();let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as any,action=String(input.action||""),rootPartId=String(input.rootPartId||"");
  if(!rootPartId)return Response.json({error:"BOM Root가 필요합니다."},{status:400});
  if(!(await requireLock(db,context.companyId,context.userId,rootPartId)))return Response.json({error:"BOM 편집 시작 후 구조를 변경할 수 있습니다."},{status:403});

  if(action==="disconnect"){
    const bomItemId=String(input.bomItemId||"");
    const row=await db.prepare("SELECT id,parent_part_id AS parentPartId FROM product_bom_items WHERE company_id=? AND id=?").bind(context.companyId,bomItemId).first<{id:string;parentPartId:string}>();
    if(!row)return Response.json({error:"BOM 연결을 찾지 못했습니다."},{status:404});
    await db.prepare("DELETE FROM product_bom_items WHERE company_id=? AND id=?").bind(context.companyId,bomItemId).run();
    await normalizeSort(db,context.companyId,row.parentPartId);
    return Response.json({ok:true});
  }

  if(action==="move"){
    const bomItemId=String(input.bomItemId||""),newParentId=String(input.newParentId||""),targetBomItemId=String(input.targetBomItemId||""),position=String(input.position||"inside");
    const moving=await db.prepare("SELECT id,parent_part_id AS parentPartId,child_part_id AS childPartId,quantity,unit FROM product_bom_items WHERE company_id=? AND id=?").bind(context.companyId,bomItemId).first<any>();
    if(!moving||!newParentId)return Response.json({error:"이동할 BOM 항목을 확인해 주세요."},{status:400});
    if(await createsCycle(db,context.companyId,moving.childPartId,newParentId))return Response.json({error:"순환 BOM 구조는 생성할 수 없습니다."},{status:409});
    const parent=await db.prepare("SELECT id,part_type AS partType FROM product_parts WHERE company_id=? AND id=?").bind(context.companyId,newParentId).first<any>();
    if(!parent)return Response.json({error:"이동 대상 Parent를 찾지 못했습니다."},{status:404});
    const parentRole=String(parent.partType||"PART").toUpperCase();
    if(parentRole==="PART"&&!input.promoteParent)return Response.json({error:"ROLE_PROMOTION_REQUIRED",parentPartId:newParentId},{status:409});
    const duplicate=await db.prepare("SELECT id FROM product_bom_items WHERE company_id=? AND parent_part_id=? AND child_part_id=? AND id<>? LIMIT 1").bind(context.companyId,newParentId,moving.childPartId,bomItemId).first();
    if(duplicate)return Response.json({error:"해당 Parent 아래에 이미 등록된 PART입니다."},{status:409});
    const t=now();
    if(parentRole==="PART"&&input.promoteParent)await db.prepare("UPDATE product_parts SET part_type='ASSEMBLY',updated_at=? WHERE company_id=? AND id=?").bind(t,context.companyId,newParentId).run();
    await db.prepare("UPDATE product_bom_items SET parent_part_id=?,updated_at=? WHERE company_id=? AND id=?").bind(newParentId,t,context.companyId,bomItemId).run();
    await normalizeSort(db,context.companyId,moving.parentPartId);
    await normalizeSort(db,context.companyId,newParentId);
    if(targetBomItemId&&position!=="inside"){
      const siblings=await db.prepare("SELECT id FROM product_bom_items WHERE company_id=? AND parent_part_id=? ORDER BY sort_order,id").bind(context.companyId,newParentId).all();
      const ids=(siblings.results??[]).map((row:any)=>row.id).filter((id:string)=>id!==bomItemId);const targetIndex=ids.indexOf(targetBomItemId);const insertAt=targetIndex<0?ids.length:targetIndex+(position==="after"?1:0);ids.splice(insertAt,0,bomItemId);
      const statements=ids.map((id:string,index:number)=>db.prepare("UPDATE product_bom_items SET sort_order=?,updated_at=? WHERE company_id=? AND id=?").bind(index,t,context.companyId,id));if(statements.length)await db.batch(statements);
    }
    return Response.json({ok:true,parentRole:parentRole==="PART"&&input.promoteParent?"ASSEMBLY":parentRole});
  }
  return Response.json({error:"지원하지 않는 작업입니다."},{status:400});
}
