import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const isAdmin=(roles:string[])=>roles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));

async function getPart(db:D1,companyId:string,partId:string){return db.prepare("SELECT id,part_number AS partNumber,name,created_by AS createdBy FROM product_parts WHERE company_id=? AND id=?").bind(companyId,partId).first<any>();}
async function relationCounts(db:D1,companyId:string,partId:string){
  const [asParent,asChild]=await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM product_bom_items WHERE company_id=? AND parent_part_id=?").bind(companyId,partId).first<{count:number}>(),
    db.prepare("SELECT COUNT(*) AS count FROM product_bom_items WHERE company_id=? AND child_part_id=?").bind(companyId,partId).first<{count:number}>(),
  ]);
  return {asParent:Number(asParent?.count||0),asChild:Number(asChild?.count||0)};
}

export async function POST(request:Request){
  const db=await runtimeDb();let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as any,action=String(input.action||""),partId=String(input.partId||"").trim();
  if(!partId)return Response.json({error:"PART를 확인해 주세요."},{status:400});
  const part=await getPart(db,context.companyId,partId);if(!part)return Response.json({error:"PART를 찾지 못했습니다."},{status:404});
  const admin=isAdmin(context.systemRoles),owner=String(part.createdBy||"")===context.userId;

  if(action==="check-part"||action==="delete-part"){
    const usage=await relationCounts(db,context.companyId,partId);
    if(!owner&&!admin)return Response.json({ok:false,canDelete:false,reason:"이 PART는 다른 사용자가 생성했습니다. 시스템 관리자만 삭제할 수 있습니다.",part,usage},{status:403});
    if(usage.asParent>0||usage.asChild>0)return Response.json({ok:false,canDelete:false,reason:`현재 BOM 구조에서 사용 중이라 삭제할 수 없습니다. 상위 사용 ${usage.asChild}건 · 하위 구조 ${usage.asParent}건`,part,usage},{status:409});
    if(action==="check-part")return Response.json({ok:true,canDelete:true,part,usage,admin,owner});
    await db.batch([
      db.prepare("DELETE FROM part_category_links WHERE company_id=? AND part_id=?").bind(context.companyId,partId),
      db.prepare("DELETE FROM part_number_history WHERE company_id=? AND part_id=?").bind(context.companyId,partId),
      db.prepare("DELETE FROM bom_edit_locks WHERE company_id=? AND root_part_id=?").bind(context.companyId,partId),
      db.prepare("DELETE FROM bom_revisions WHERE company_id=? AND root_part_id=?").bind(context.companyId,partId),
      db.prepare("DELETE FROM product_parts WHERE company_id=? AND id=?").bind(context.companyId,partId),
    ]);
    return Response.json({ok:true,deleted:"part",part});
  }

  if(action==="check-bom"||action==="delete-bom"){
    const usage=await relationCounts(db,context.companyId,partId);
    if(usage.asParent===0)return Response.json({ok:false,canDelete:false,reason:"삭제할 BOM 구조가 없습니다.",part,usage},{status:409});
    if(!owner&&!admin)return Response.json({ok:false,canDelete:false,reason:"이 BOM은 다른 사용자가 생성했습니다. 시스템 관리자만 삭제할 수 있습니다.",part,usage},{status:403});
    if(usage.asChild>0&&!admin)return Response.json({ok:false,canDelete:false,reason:`이 BOM Root는 다른 BOM ${usage.asChild}건에서 사용 중입니다. 시스템 관리자 검토가 필요합니다.`,part,usage},{status:409});
    if(action==="check-bom")return Response.json({ok:true,canDelete:true,part,usage,admin,owner});
    await db.batch([
      db.prepare("DELETE FROM product_bom_items WHERE company_id=? AND parent_part_id=?").bind(context.companyId,partId),
      db.prepare("DELETE FROM bom_edit_locks WHERE company_id=? AND root_part_id=?").bind(context.companyId,partId),
    ]);
    return Response.json({ok:true,deleted:"bom",part,removedDirectChildren:usage.asParent});
  }

  return Response.json({error:"지원하지 않는 삭제 작업입니다."},{status:400});
}
