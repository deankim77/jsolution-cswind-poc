import {cimDefinition,cimDemo} from "./demo-data/cim-e2e-pilot.mjs";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const request=async(path,init={})=>{
  const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);
  return data;
};
const post=(path,body)=>request(path,{method:"POST",body:JSON.stringify(body)});

console.log(`CIM 1차 구축 메인 데모 데이터를 ${base}에 준비합니다.`);
const session=await request("/api/session");
if(!session.user?.id)throw new Error("활성 로그인 사용자를 찾지 못했습니다. dev:v2 서버와 초기 데이터를 확인해 주세요.");

const listed=await request("/api/projects");
const existing=(listed.projects||[]).find(project=>project.code===cimDemo.projectCode);
if(existing)console.log(`기존 CIM 프로젝트를 최종 142건 데모 기준으로 동기화합니다: ${existing.code} · ${existing.name}`);

const templates=await request("/api/templates");
let template=(templates.templates||[]).find(item=>item.code===cimDemo.templateCode);
if(!template){
  const created=await post("/api/templates",{code:cimDemo.templateCode,name:cimDemo.templateName,version:cimDemo.templateVersion,status:"active",definition:cimDefinition});
  template={versionId:created.versionId};
  console.log(`CIM 템플릿 생성: ${cimDemo.templateCode} ${cimDemo.templateVersion}`);
}

const project=existing||await post("/api/projects",{
  code:cimDemo.projectCode,name:cimDemo.projectName,customerName:cimDemo.customerName,startDate:cimDemo.startDate,endDate:cimDemo.endDate,
  templateVersionId:template.versionId,creationMode:"template",description:cimDemo.description,referenceCode:"KOLON-CIM-2026-PILOT",visibility:"company",
  members:[{userId:session.user.id,projectRole:"PM"}],
});
if(!existing)console.log(`CIM 프로젝트 생성: ${project.code} · ${project.name}`);
await post("/api/projects/roles/sync",{projectCode:cimDemo.projectCode,roleCodes:cimDefinition.roles});

let detail=await request(`/api/projects/${project.id}/wbs`);
const sourceByCode=new Map(cimDefinition.wbs.map(task=>[task.id,task]));
const currentIdByCode=new Map((detail.tasks||[]).map(task=>[task.wbsCode,task.id]));
const tasks=(detail.tasks||[]).map(task=>{
  const source=sourceByCode.get(task.wbsCode);
  if(!source)throw new Error(`시드 WBS를 찾지 못했습니다: ${task.wbsCode}`);
  const predecessorCode=task.predecessorCode||source.predecessorId;
  return {
    id:task.id,clientKey:task.id,wbsCode:task.wbsCode,level:source.level,name:source.name,taskType:source.taskType,durationDays:source.durationDays,
    plannedStart:source.plannedStart,plannedEnd:source.plannedEnd,roleCode:source.kind==="summary"?undefined:source.role,
    predecessorClientKey:task.predecessorId||currentIdByCode.get(predecessorCode),
    assigneeUserId:source.kind==="summary"?undefined:session.user.id,completionActor:source.completionActor||"assignee",completionCriteria:source.completionCriteria,
    deliverables:task.deliverables,
  };
});
await request(`/api/projects/${project.id}/wbs`,{method:"PUT",headers:{"x-demo-seed":"jsolution-local-demo"},body:JSON.stringify({tasks})});
await post("/api/projects/roles/sync",{projectCode:cimDemo.projectCode,roleCodes:cimDefinition.roles,replaceUnused:true});
if(!existing)await post(`/api/projects/${project.id}/status`,{action:"start",force:true});

detail=await request(`/api/projects/${project.id}/wbs`);
for(const task of detail.tasks||[]){
  const source=sourceByCode.get(task.wbsCode);
  if(!source||source.kind==="summary")continue;
  await request(`/api/projects/${project.id}/wbs/status`,{method:"PATCH",body:JSON.stringify({taskId:task.id,status:source.sourceStatus})});
}

const activities=cimDefinition.wbs.filter(task=>task.kind==="task");
const byStatus=Object.fromEntries(["completed","active","review","planned"].map(status=>[status,activities.filter(task=>task.sourceStatus===status).length]));
console.log(`완료: 최종 142건 기준 CIM End-to-End 10단계 · 실행 Task ${activities.length}개 · 완료 ${byStatus.completed} · 진행 ${byStatus.active} · 검토 ${byStatus.review} · 예정 ${byStatus.planned}`);
console.log(`데모 원칙: ${cimDemo.demoPositioning}`);
console.log(`브라우저에서 ${base} 을 새로고침한 뒤 ${cimDemo.projectCode} 프로젝트를 선택하세요.`);
