import {automotiveDemo,automotiveProjects,buildAutomotiveTemplate,demoRecordPlan} from "./demo-data/automotive-g6-portfolio.mjs";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const DAY_MS=24*60*60*1000;
const dateValue=value=>new Date(`${value}T00:00:00Z`).getTime();
const dateText=value=>new Date(value).toISOString().slice(0,10);
const businessDays=(start,end)=>{
  let cursor=dateValue(start),last=dateValue(end),days=0;
  while(cursor<=last){
    const day=new Date(cursor).getUTCDay();
    if(day!==0&&day!==6)days++;
    cursor+=DAY_MS;
  }
  return Math.max(1,days);
};
const scheduleForProject=(definition,profile)=>{
  const dated=definition.wbs.filter(task=>task.plannedStart&&task.plannedEnd);
  const templateStart=Math.min(...dated.map(task=>dateValue(task.plannedStart)));
  const templateEnd=Math.max(...dated.map(task=>dateValue(task.plannedEnd)));
  const projectStart=dateValue(profile.startDate),projectEnd=dateValue(profile.endDate);
  const scale=(projectEnd-projectStart)/Math.max(DAY_MS,templateEnd-templateStart);
  return new Map(dated.map(task=>{
    const shifted=value=>dateText(projectStart+Math.round(((dateValue(value)-templateStart)/DAY_MS)*scale)*DAY_MS);
    const plannedStart=shifted(task.plannedStart);
    const plannedEnd=task.plannedStart===task.plannedEnd?plannedStart:shifted(task.plannedEnd);
    return [task.id,{plannedStart,plannedEnd,durationDays:businessDays(plannedStart,plannedEnd)}];
  }));
};
const request=async(path,init={})=>{
  const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.body?{"content-type":"application/json"}:{}),...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);
  return data;
};
const post=(path,body)=>request(path,{method:"POST",body:JSON.stringify(body)});
const patch=(path,body)=>request(path,{method:"PATCH",body:JSON.stringify(body)});

console.log(`자동차 G6 포트폴리오를 ${base}에 준비합니다.`);
const session=await request("/api/session");
if(!session.user?.id)throw new Error("활성 로그인 사용자를 찾지 못했습니다. V2 개발 서버와 초기 데이터를 확인해 주세요.");

let master=await request("/api/system/master-data");
for(const customer of automotiveDemo.customers){
  if((master.partners||[]).some(item=>item.code===customer.code))continue;
  await post("/api/system/master-data",{entity:"partner",...customer,category:"CUSTOMER",status:"active",note:"자동차 G6 Stage-Gate 데모 거래처"});
  console.log(`거래처 생성: ${customer.name}`);
}
if(!(master.projectTypes||[]).some(item=>item.code===automotiveDemo.projectType.code)){
  await post("/api/system/master-data",{entity:"projectType",...automotiveDemo.projectType,description:automotiveDemo.description,status:"active"});
  console.log(`프로젝트 유형 생성: ${automotiveDemo.projectType.name}`);
}
master=await request("/api/system/master-data");
const partnerByCode=new Map((master.partners||[]).map(item=>[item.code,item]));
const projectType=(master.projectTypes||[]).find(item=>item.code===automotiveDemo.projectType.code);
if(!projectType)throw new Error("자동차 시트 원단 개발 프로젝트 유형을 준비하지 못했습니다.");

const definition=buildAutomotiveTemplate();
let template=(await request("/api/templates")).templates?.find(item=>item.code===automotiveDemo.templateCode);
if(!template){
  const created=await post("/api/templates",{code:automotiveDemo.templateCode,name:automotiveDemo.templateName,version:automotiveDemo.templateVersion,status:"active",definition});
  template={id:created.id,versionId:created.versionId,version:automotiveDemo.templateVersion};
  console.log(`템플릿 생성: ${automotiveDemo.templateName}`);
}else{
  await patch("/api/templates",{id:template.id,code:automotiveDemo.templateCode,name:automotiveDemo.templateName,version:template.version||automotiveDemo.templateVersion,status:"active",mode:"update",definition});
  console.log(`템플릿 동기화: ${automotiveDemo.templateName}`);
}

let listed=await request("/api/projects");
const byCode=new Map((listed.projects||[]).map(item=>[item.code,item]));
let createdCount=0,syncedCount=0;
for(const profile of automotiveProjects){
  const partner=partnerByCode.get(profile.customerCode);
  if(!partner)throw new Error(`거래처를 찾지 못했습니다: ${profile.customerCode}`);
  let project=byCode.get(profile.code);
  if(!project){
    project=await post("/api/projects",{
      code:profile.code,name:profile.name,customerName:profile.customerName,partnerId:partner.id,projectTypeId:projectType.id,
      startDate:profile.startDate,endDate:profile.endDate,templateVersionId:template.versionId,creationMode:"template",
      description:`${profile.customerName} ${profile.objective} 목표. ${profile.composition}, ${profile.color}, ${profile.weightGsm}g/㎡, ${profile.thicknessMm}mm 기준의 자동차 시트 원단 개발 데모 프로젝트`,
      referenceCode:profile.referenceCode,visibility:"company",members:[{userId:session.user.id,projectRole:"PM"}],
    });
    byCode.set(profile.code,project);createdCount++;
  }
  const roleSyncAllowed=(project.status||"preparing")!=="completed";
  if(roleSyncAllowed)await post("/api/projects/roles/sync",{projectCode:profile.code,roleCodes:definition.roles});
  const current=await request(`/api/projects/${project.id}/wbs`);
  const sourceByCode=new Map(definition.wbs.map(task=>[task.id,task]));
  const scheduleByCode=scheduleForProject(definition,profile);
  const tasks=(current.tasks||[]).map(task=>{
    const source=sourceByCode.get(task.wbsCode);
    if(!source)throw new Error(`${profile.code} 템플릿 WBS를 찾지 못했습니다: ${task.wbsCode}`);
    const schedule=scheduleByCode.get(task.wbsCode);
    return {
      id:task.id,clientKey:task.id,wbsCode:task.wbsCode,level:source.level,name:source.name,taskType:source.taskType,
      durationDays:schedule?.durationDays??source.durationDays,plannedStart:schedule?.plannedStart,plannedEnd:schedule?.plannedEnd,
      predecessorClientKey:source.predecessor?(current.tasks||[]).find(item=>item.wbsCode===source.predecessor)?.id:undefined,
      roleCode:source.kind==="summary"?undefined:source.role,assigneeUserId:source.kind==="summary"?undefined:session.user.id,
      completionActor:source.completionActor||"assignee",completionCriteria:source.completionCriteria,
      deliverables:(source.deliverables||[]).map(output=>({...output,id:(task.deliverables||[]).find(item=>item.name===output.name)?.id})),
    };
  });
  await request(`/api/projects/${project.id}/wbs`,{method:"PUT",headers:{"x-demo-seed":"jsolution-local-demo","x-demo-schedule":"preserve-plan-dates"},body:JSON.stringify({tasks,projectStart:profile.startDate,projectEnd:profile.endDate})});
  if(roleSyncAllowed)await post("/api/projects/roles/sync",{projectCode:profile.code,roleCodes:definition.roles,replaceUnused:true});
  if((project.status||"preparing")==="preparing")await post(`/api/projects/${project.id}/status`,{action:"start",force:true});
  syncedCount++;
  console.log(`프로젝트 일정 동기화: ${profile.customerName} · ${profile.name} · ${profile.startDate}~${profile.endDate} · 현재 G${profile.currentGate}`);
}

listed=await request("/api/projects");
const demoProjects=(listed.projects||[]).filter(item=>automotiveProjects.some(profile=>profile.code===item.code));
if(demoProjects.length!==15)throw new Error(`자동차 데모 프로젝트 수가 올바르지 않습니다: ${demoProjects.length}/15`);
console.log(`완료: 신규 ${createdCount}개 · 일정 동기화 ${syncedCount}개 · 전체 ${demoProjects.length}개`);
console.log(`다음 단계 목표: 산출물 ${demoRecordPlan.totalDeliverables}건 · 이슈/리스크/협업 ${demoRecordPlan.totalOperationalRecords}건 · Task 실적 및 Gate 승인 이력`);
