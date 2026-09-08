import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
import {getChatGPTUser} from "../../chatgpt-auth";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";
import {listUnreadNotifications,type NotificationD1} from "../notifications/notification-service";

async function runtimeDb():Promise<NotificationD1>{return getLegacyDbCompat() as NotificationD1;}

export async function GET(request:Request){
  const auth=await getChatGPTUser(),db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db,{email:auth?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const data=await listUnreadNotifications(db,context.companyId,context.userId,50);
  return Response.json({notifications:data.items,notificationUnreadCount:data.unreadCount},{headers:{"x-dashboard-mode":"notifications"}});
}
