import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const now=()=>Math.floor(Date.now()/1000);

export async function POST(request:Request){
  const db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db as any)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as any;
  const rootPartId=String(input.rootPartId||""),bomItemId=String(input.bomItemId||"");
  const quantity=Number(input.quantity);
  if(!rootPartId||!bomItemId)return Response.json({error:"BOM Root와 항목을 확인해 주세요."},{status:400});
  if(!Number.isFinite(quantity)||quantity<=0)return Response.json({error:"수량은 0보다 큰 값이어야 합니다."},{status:400});

  const lock=await db.prepare("SELECT locked_by AS lockedBy FROM bom_edit_locks WHERE company_id=? AND root_part_id=?").bind(context.companyId,rootPartId).first<{lockedBy:string}>();
  if(!lock||lock.lockedBy!==context.userId)return Response.json({error:"BOM 편집 시작 후 수량을 수정할 수 있습니다."},{status:403});
  const item=await db.prepare("SELECT id,quantity FROM product_bom_items WHERE company_id=? AND id=?").bind(context.companyId,bomItemId).first<{id:string;quantity:number}>();
  if(!item)return Response.json({error:"수정할 BOM 항목을 찾지 못했습니다."},{status:404});
  if(Number(item.quantity)===quantity)return Response.json({ok:true,quantity,unchanged:true});
  await db.prepare("UPDATE product_bom_items SET quantity=?,updated_at=? WHERE company_id=? AND id=?").bind(quantity,now(),context.companyId,bomItemId).run();
  return Response.json({ok:true,quantity});
}
