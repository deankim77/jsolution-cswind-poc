/* eslint-disable @typescript-eslint/no-explicit-any */
import { getChatGPTUser } from "../../../../chatgpt-auth";
import {contextErrorResponse,resolveRequestContext} from "../../../../../db/request-context";
import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:()=>Promise<{results?:any[]}>;first:<T=any>()=>Promise<T|null>;run:()=>Promise<unknown>};
type D1={prepare:(sql:string)=>D1Statement;batch:(statements:D1Statement[])=>Promise<unknown>};
async function runtime():Promise<{DB:D1}>{return {DB:getLegacyDbCompat() as unknown as D1};}

export async function POST(request:Request){
  const authenticated=await getChatGPTUser();
  const input=await request.json() as {id?:string};
  const id=input.id?.trim();
  if(!id)return Response.json({error:"대화 ID가 필요합니다."},{status:400});
  const {DB:db}=await runtime();
  let context;try{context=await resolveRequestContext(request,db,{email:authenticated?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const conversation=await db.prepare("SELECT id FROM ai_conversations WHERE id=? AND company_id=? AND user_id=?").bind(id,context.companyId,context.userId).first();
  if(!conversation)return Response.json({ok:true,deleted:false,id});
  await db.batch([
    db.prepare("DELETE FROM ai_messages WHERE conversation_id=?").bind(id),
    db.prepare("DELETE FROM ai_conversations WHERE id=? AND company_id=? AND user_id=?").bind(id,context.companyId,context.userId),
  ]);
  return Response.json({ok:true,deleted:true,id});
}
