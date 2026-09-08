import {appSessionCookie,createAppSession} from "../../../../lib/app-auth";
import {getLegacyDbCompat} from "../../../../db/postgres-d1-compat";

const redirectToLogin=(request:Request,reason:string)=>{
  const url=new URL("/login",request.url);
  url.searchParams.set("error",reason);
  return Response.redirect(url,303);
};

function ensureLocalRuntimeEnv(){
  if(process.env.APP_LOGIN_PASSWORD&&process.env.APP_SESSION_SECRET)return;
  if(typeof process.loadEnvFile!=="function")return;
  for(const file of [".dev.vars",".env"]){
    try{process.loadEnvFile(file)}catch{}
    if(process.env.APP_LOGIN_PASSWORD&&process.env.APP_SESSION_SECRET)return;
  }
}

export async function POST(request:Request){
  ensureLocalRuntimeEnv();
  const db=getLegacyDbCompat();
  const password=String(process.env.APP_LOGIN_PASSWORD||""),secret=String(process.env.APP_SESSION_SECRET||"");
  const contentType=request.headers.get("content-type")||"";
  const formMode=contentType.includes("application/x-www-form-urlencoded")||contentType.includes("multipart/form-data");

  if(!password||!secret){
    if(formMode)return redirectToLogin(request,"config");
    return Response.json({error:"로그인 환경설정이 아직 완료되지 않았습니다."},{status:503});
  }

  let email="",submittedPassword="";
  if(formMode){
    const form=await request.formData();
    email=String(form.get("email")||"").trim().toLowerCase();
    submittedPassword=String(form.get("password")||"");
  }else{
    const body=await request.json().catch(()=>({})) as {email?:string;password?:string};
    email=String(body.email||"").trim().toLowerCase();
    submittedPassword=String(body.password||"");
  }

  if(!email||!submittedPassword){
    if(formMode)return redirectToLogin(request,"required");
    return Response.json({error:"이메일과 비밀번호를 입력해 주세요."},{status:400});
  }
  if(submittedPassword!==password){
    if(formMode)return redirectToLogin(request,"invalid");
    return Response.json({error:"이메일 또는 비밀번호가 올바르지 않습니다."},{status:401});
  }

  const user=await db.prepare("SELECT id,email,name,status FROM users WHERE lower(email)=? LIMIT 1").bind(email).first() as {id:string;email:string;name:string;status:string}|null;
  if(!user||user.status!=="active"){
    if(formMode)return redirectToLogin(request,"invalid");
    return Response.json({error:"사용 가능한 사용자 계정을 확인할 수 없습니다."},{status:401});
  }

  const cleanTabs={tabs:[{key:"portfolio",view:"portfolio",title:"전사 대시보드"}],active:"portfolio",templateEditorId:""};
  await db.prepare(`INSERT INTO user_work_state (user_id,state_key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,state_key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(user.id,"v2-workspace-tabs",JSON.stringify(cleanTabs),Math.floor(Date.now()/1000)).run();

  const token=await createAppSession(user.email,secret);
  if(formMode){
    return new Response(null,{status:303,headers:{"location":new URL("/",request.url).toString(),"set-cookie":appSessionCookie(token),"cache-control":"no-store"}});
  }
  return new Response(JSON.stringify({ok:true,user:{id:user.id,email:user.email,name:user.name}}),{status:200,headers:{"content-type":"application/json; charset=utf-8","set-cookie":appSessionCookie(token),"cache-control":"no-store"}});
}
