import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
import {getChatGPTUser} from "../../chatgpt-auth";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";
import {listUnreadNotifications,markAllNotificationsRead,markNotificationRead,type NotificationD1} from "./notification-service";

async function runtimeDb():Promise<NotificationD1>{return getLegacyDbCompat() as NotificationD1;}

export async function GET(request:Request){
  const auth=await getChatGPTUser(),db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db,{email:auth?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const data=await listUnreadNotifications(db,context.companyId,context.userId,50);
  return Response.json(data);
}

export async function PATCH(request:Request){
  const auth=await getChatGPTUser(),db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db,{email:auth?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json().catch(()=>({})) as {id?:string;all?:boolean};
  if(input.all)await markAllNotificationsRead(db,context.companyId,context.userId);
  else if(input.id)await markNotificationRead(db,context.companyId,context.userId,input.id);
  else return Response.json({error:"읽음 처리할 알림을 확인할 수 없습니다."},{status:400});
  const data=await listUnreadNotifications(db,context.companyId,context.userId,50);
  return Response.json(data);
}
