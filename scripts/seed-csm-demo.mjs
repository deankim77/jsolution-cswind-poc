import {csmDefinition,csmDemo} from "./demo-data/csm-new-car-r14.mjs";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const request=async(path,init={})=>{
  const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);
  return data;
};
const post=(path,body)=>request(path,{method:"POST",body:JSON.stringify(body)});

console.log(`CSM 데모 데이터를 ${base}에 준비합니다.`);
const session=await request("/api/session");
if(!session.user?.id)throw new Error("활성 로그인 사용자를 찾지 못했습니다. dev:v2 서버와 초기 데이터를 확인해 주세요.");

const listed=await request("/api/projects");
const existing=(listed.projects||[]).find(project=>project.code===csmDemo.projectCode);
if(existing){
  console.log(`기존 CSM 프로젝트를 간략 Role 기준으로 동기화합니다: ${existing.code} · ${existing.name}`);
}

const templates=await request("/api/templates");
let template=(templates.templates||[]).find(item=>item.code===csmDemo.templateCode);
if(!template){
  const created=await post("/api/templates",{code:csmDemo.templateCode,name:csmDemo.templateName,version:csmDemo.templateVersion,status:"active",definition:csmDefinition});
  template={versionId:created.versionId};
  console.log(`템플릿 생성: ${csmDemo.templateCode} ${csmDemo.templateVersion}`);
}

const project=existing||await post("/api/projects",{
  code:csmDemo.projectCode,name:csmDemo.projectName,customerName:csmDemo.customerName,startDate:csmDemo.startDate,endDate:csmDemo.endDate,
  templateVersionId:template.versionId,creationMode:"template",description:csmDemo.description,referenceCode:"CSM-R14-DL3-PE2",visibility:"company",
  members:[{userId:session.user.id,projectRole:"PM"}],
});
if(!existing)console.log(`프로젝트 생성: ${project.code} · ${project.name}`);
await post("/api/projects/roles/sync",{projectCode:csmDemo.projectCode,roleCodes:csmDefinition.roles});

let detail=await request(`/api/projects/${project.id}/wbs`);
const sourceByCode=new Map(csmDefinition.wbs.map(task=>[task.id,task]));
const tasks=(detail.tasks||[]).map(task=>{
  const source=sourceByCode.get(task.wbsCode);
  if(!source)throw new Error(`시드 WBS를 찾지 못했습니다: ${task.wbsCode}`);
  return {
    id:task.id,clientKey:task.id,wbsCode:task.wbsCode,level:source.level,name:source.name,taskType:source.taskType,durationDays:source.durationDays,
    plannedStart:source.plannedStart,plannedEnd:source.plannedEnd,roleCode:source.kind==="summary"?undefined:source.role,
    assigneeUserId:source.kind==="summary"?undefined:session.user.id,completionActor:source.completionActor||"assignee",completionCriteria:source.completionCriteria,
    deliverables:task.deliverables,
  };
});
await request(`/api/projects/${project.id}/wbs`,{method:"PUT",headers:{"x-demo-seed":"jsolution-local-demo"},body:JSON.stringify({tasks})});
await post("/api/projects/roles/sync",{projectCode:csmDemo.projectCode,roleCodes:csmDefinition.roles,replaceUnused:true});
if(!existing)await post(`/api/projects/${project.id}/status`,{action:"start",force:true});

detail=await request(`/api/projects/${project.id}/wbs`);
for(const task of detail.tasks||[]){
  const source=sourceByCode.get(task.wbsCode);
  if(!source||source.kind==="summary")continue;
  await request(`/api/projects/${project.id}/wbs/status`,{method:"PATCH",body:JSON.stringify({taskId:task.id,status:source.sourceStatus})});
}

const completed=csmDefinition.wbs.filter(task=>task.sourceStatus==="completed").length;
const active=csmDefinition.wbs.filter(task=>task.kind!=="summary"&&task.sourceStatus==="active").length;
console.log(`완료: 6 Gate · 고객 활동 50개 · 완료 ${completed}개 · 미흡/진행 ${active-6}개 · Gate Review 6개`);
console.log(`브라우저에서 ${base} 을 새로고침한 뒤 ${csmDemo.projectCode} 프로젝트를 선택하세요.`);
