import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getChatGPTUser } from "../../chatgpt-auth";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type D1={prepare:(sql:string)=>any};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
async function contextFor(request:Request,db:D1){const chatUser=await getChatGPTUser();return resolveRequestContext(request,db,{email:chatUser?.email});}
async function ensure(_db:D1){return;}

export async function GET(request:Request){
  const db=await runtimeDb();await ensure(db);
  let context;try{context=await contextFor(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const key=new URL(request.url).searchParams.get("key");if(!key)return Response.json({error:"key required"},{status:400});
  const row=await db.prepare("SELECT value FROM user_work_state WHERE user_id=? AND state_key=?").bind(context.userId,key).first<{value:string}>();
  return Response.json({value:row?JSON.parse(row.value):null});
}

export async function PUT(request:Request){
  const db=await runtimeDb();await ensure(db);
  let context;try{context=await contextFor(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as {key?:string;value?:unknown};if(!input.key)return Response.json({error:"key required"},{status:400});
  await db.prepare(`INSERT INTO user_work_state (user_id,state_key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,state_key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(context.userId,input.key,JSON.stringify(input.value??null),Math.floor(Date.now()/1000)).run();
  return Response.json({ok:true});
}
