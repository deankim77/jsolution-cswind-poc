import {hdemDemo,buildHdemTemplate,equipmentBom,delayedTaskCodes} from "./demo-data/hdem-equipment-g6.mjs";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const request=async(path,init={})=>{
  const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.body&&typeof init.body==="string"?{"content-type":"application/json"}:{}),...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);
  return data;
};
const post=(path,body,headers)=>request(path,{method:"POST",headers,body:JSON.stringify(body)});
const patch=(path,body)=>request(path,{method:"PATCH",body:JSON.stringify(body)});
const put=(path,body,headers)=>request(path,{method:"PUT",headers,body:JSON.stringify(body)});
const projectCode=`${hdemDemo.projectCode}-DEMO`;
const definition=buildHdemTemplate();
const delayEndByCode=new Map([
  ["G4-A02","2026-08-26"],["G4-A03","2026-08-25"],["G4-A05","2026-08-27"],["G4-A06","2026-08-26"],["G4-A08","2026-08-27"],
]);

console.log(`현대전기기계공업 G6 데모 프로젝트를 ${base}에 준비합니다.`);
const session=await request("/api/session");
if(!session.user?.id)throw new Error("활성 로그인 사용자를 찾지 못했습니다. 김진영 PM 계정으로 로그인한 V2 개발 서버에서 실행해 주세요.");

let master=await request("/api/system/master-data");
const partner=(master.partners||[]).find(item=>String(item.name||"").includes("코오롱"));
if(!partner)throw new Error("기존 거래처에서 '코오롱' 거래처를 찾지 못했습니다. 임의 거래처를 생성하지 않고 중단합니다.");
if(!(master.projectTypes||[]).some(item=>item.code===hdemDemo.projectType.code)){
  await post("/api/system/master-data",{entity:"projectType",...hdemDemo.projectType,description:hdemDemo.description,status:"active"});
  console.log(`프로젝트 유형 생성: ${hdemDemo.projectType.name}`);
}
master=await request("/api/system/master-data");
const projectType=(master.projectTypes||[]).find(item=>item.code===hdemDemo.projectType.code);
if(!projectType)throw new Error("수주형 설비 제작·설치 프로젝트 유형을 준비하지 못했습니다.");

let template=(await request("/api/templates")).templates?.find(item=>item.code===hdemDemo.templateCode);
const templateDefinition={...definition,wbs:definition.wbs.map(task=>({...task,status:undefined,progress:undefined,deliverables:(task.deliverables||[]).map(output=>({...output,type:output.type||output.category}))}))};
if(!template){
  const created=await post("/api/templates",{code:hdemDemo.templateCode,name:hdemDemo.templateName,version:hdemDemo.templateVersion,status:"active",definition:templateDefinition});
  template={id:created.id,versionId:created.versionId,version:hdemDemo.templateVersion};
  console.log(`템플릿 생성: ${hdemDemo.templateName}`);
}else{
  await patch("/api/templates",{id:template.id,code:hdemDemo.templateCode,name:hdemDemo.templateName,version:template.version||hdemDemo.templateVersion,status:"active",mode:"update",definition:templateDefinition});
  console.log(`템플릿 동기화: ${hdemDemo.templateName}`);
}

let listed=await request("/api/projects");
let project=(listed.projects||[]).find(item=>item.code===projectCode);
const projectName=`${partner.name} 화성공장 자동 원료공급 시스템 제작·설치`;
if(!project){
  project=await post("/api/projects",{
    code:projectCode,name:projectName,customerName:partner.name,partnerId:partner.id,projectTypeId:projectType.id,
    startDate:hdemDemo.startDate,endDate:hdemDemo.endDate,templateVersionId:template.versionId,creationMode:"template",
    description:`${partner.name} 화성공장 사출 3~8호기 대상 자동 원료공급 Turn-key System. ${hdemDemo.equipmentType}, ${hdemDemo.process}, G1~G6 Gate 기반 수주·설계·제작·설치 프로젝트.`,
    referenceCode:"HDEM-MATERIAL-SUPPLY-2026",visibility:"company",members:[{userId:session.user.id,projectRole:"PM"}],
  });
  console.log(`프로젝트 생성: ${projectName}`);
}else console.log(`프로젝트 유지: ${project.name}`);

await post("/api/projects/roles/sync",{projectCode,roleCodes:definition.roles});

let current=await request(`/api/projects/${project.id}/wbs`);
const byCode=new Map((current.tasks||[]).map(task=>[task.wbsCode,task]));
const seedTasks=definition.wbs.map(source=>{
  const existing=byCode.get(source.id);
  return {
    id:existing?.id,clientKey:existing?.id||source.id,wbsCode:source.id,level:source.level,name:source.name,taskType:source.taskType,
    durationDays:source.durationDays,plannedStart:source.plannedStart,plannedEnd:delayEndByCode.get(source.id)||source.plannedEnd,
    roleCode:source.kind==="summary"?undefined:source.role,assigneeUserId:source.kind==="summary"?undefined:session.user.id,
    completionActor:source.completionActor==="pm"?"PM":source.completionActor||"assignee",completionCriteria:source.completionCriteria,
    deliverables:(source.deliverables||[]).map(output=>({...output,type:output.type||output.category,id:(existing?.deliverables||[]).find(item=>item.name===output.name)?.id})),
  };
});
await put(`/api/projects/${project.id}/wbs`,{tasks:seedTasks,projectStart:hdemDemo.startDate,projectEnd:hdemDemo.endDate},{"x-demo-seed":"jsolution-local-demo","x-demo-schedule":"preserve-plan-dates"});
if((project.status||"preparing")==="preparing")await post(`/api/projects/${project.id}/status`,{action:"start",force:true});

current=await request(`/api/projects/${project.id}/wbs`);
const taskByCode=new Map((current.tasks||[]).map(task=>[task.wbsCode,task]));
for(const source of definition.wbs.filter(item=>item.kind!=="summary"&&item.taskType!=="gate")){
  const task=taskByCode.get(source.id);if(!task)continue;
  const targetProgress=Math.max(0,Math.min(100,Number(source.progress)||0));
  if(!targetProgress||task.progress>=targetProgress)continue;
  const completed=targetProgress>=100;
  await post(`/api/projects/${project.id}/actuals`,{taskId:task.id,actualDate:completed?(source.plannedEnd||"2026-08-28"):"2026-08-28",actualHours:completed?Math.max(4,Number(source.durationDays||1)*4):5.5,progress:targetProgress,workNote:completed?`${source.name} 계획 업무 완료. 관련 설계·제작 자료 검토 및 산출물 반영.`:`${source.name} 진행 중. 계획 대비 납기·제작 상태를 점검하고 후속 조치 중.`,completed,completionConfirmed:completed});
}
for(let gate=1;gate<=3;gate++){
  const gateTask=taskByCode.get(`G${gate}-R`);if(!gateTask)continue;
  const state=(await request(`/api/projects/${project.id}/gates`)).gates?.find(item=>item.gateCode===`G${gate}`);
  if(state?.decision!=="PASS")await post(`/api/projects/${project.id}/gates`,{taskId:gateTask.id,decision:"PASS",note:`G${gate} 필수 활동과 산출물 검토 완료. 다음 단계 착수 승인.`});
}

const memberData=await request(`/api/projects/${project.id}/members`);
const candidates=(memberData.users||[]).filter(user=>user.userId!==session.user.id);
const functionalRoleSequence=["MECHANICAL","ELECTRICAL","PURCHASE","PRODUCTION","QUALITY","SERVICE"];
const functionalMembers=[{userId:session.user.id,projectRole:"PM"}];
if(candidates[0])functionalMembers.push({userId:candidates[0].userId,projectRole:"PL"});
for(let index=1;index<Math.min(candidates.length,7);index++)functionalMembers.push({userId:candidates[index].userId,projectRole:"MEMBER"});
await put(`/api/projects/${project.id}/members`,{members:functionalMembers});
const roleUser=new Map();
roleUser.set("PM",session.user.id);
roleUser.set("PL",candidates[0]?.userId||session.user.id);
for(let index=0;index<functionalRoleSequence.length;index++)roleUser.set(functionalRoleSequence[index],candidates[index+1]?.userId||candidates[0]?.userId||session.user.id);
roleUser.set("SALES",roleUser.get("PL")||session.user.id);
roleUser.set("DESIGN",roleUser.get("PL")||session.user.id);
roleUser.set("SW",roleUser.get("ELECTRICAL")||roleUser.get("PL")||session.user.id);

current=await request(`/api/projects/${project.id}/wbs`);
const currentByCode=new Map((current.tasks||[]).map(task=>[task.wbsCode,task]));
const assignedTasks=definition.wbs.map(source=>{
  const task=currentByCode.get(source.id);if(!task)throw new Error(`WBS Task 누락: ${source.id}`);
  return {
    id:task.id,clientKey:task.id,wbsCode:source.id,level:source.level,name:source.name,taskType:source.taskType,durationDays:source.durationDays,
    plannedStart:source.plannedStart,plannedEnd:delayEndByCode.get(source.id)||source.plannedEnd,
    roleCode:source.kind==="summary"?undefined:source.role,assigneeUserId:source.kind==="summary"?undefined:(roleUser.get(source.role)||session.user.id),
    completionActor:source.completionActor==="pm"?"PM":source.completionActor||"assignee",completionCriteria:source.completionCriteria,
    deliverables:(source.deliverables||[]).map(output=>({...output,type:output.type||output.category,id:(task.deliverables||[]).find(item=>item.name===output.name)?.id})),
  };
});
await put(`/api/projects/${project.id}/wbs`,{tasks:assignedTasks,projectStart:hdemDemo.startDate,projectEnd:hdemDemo.endDate},{"x-demo-seed":"jsolution-local-demo","x-demo-schedule":"preserve-plan-dates"});
await post("/api/projects/roles/sync",{projectCode,roleCodes:definition.roles,replaceUnused:true});

let product=await request("/api/product-data");
const existingByName=new Map((product.parts||[]).map(part=>[part.name,part]));
const partIdByKey=new Map();
for(const item of equipmentBom){
  let part=existingByName.get(item.name);
  if(!part){
    const created=await post("/api/product-data",{action:"create-part",name:item.name,partType:item.type,spec:item.spec,unit:item.unit,standardCost:item.cost});
    product=await request("/api/product-data");part=(product.parts||[]).find(row=>row.id===created.id)||{id:created.id,name:item.name};
    existingByName.set(item.name,part);
  }
  partIdByKey.set(item.key,part.id);
}
const rootId=partIdByKey.get("ROOT");
await post("/api/product-data",{action:"checkout-bom",rootPartId:rootId});
product=await request("/api/product-data");
const existingEdges=new Set((product.bom||[]).map(row=>`${row.parentPartId}|${row.childPartId}`));
for(const item of equipmentBom.filter(item=>item.parent)){
  const parentPartId=partIdByKey.get(item.parent),childPartId=partIdByKey.get(item.key),edge=`${parentPartId}|${childPartId}`;
  if(existingEdges.has(edge))continue;
  await post("/api/product-data",{action:"add-bom",rootPartId:rootId,parentPartId,childPartId,quantity:item.qty,note:`${projectName} 설비 BOM`});
  existingEdges.add(edge);
}
await post("/api/product-data",{action:"checkin-bom",rootPartId:rootId});

// 이슈 4 / 리스크 2 / 협업요청 3 = 총 9건. 재실행 시 제목 기준 중복 생성하지 않는다.
const issueData=await request(`/api/projects/${project.id}/issues`);
const existingTitles=new Set((issueData.issues||[]).map(item=>item.title));
const issueSpecs=[
  {type:"issue",task:"G4-A03",title:"외주 판금·가공품 입고 일정 지연",description:"외주 제작 중인 판금 프레임과 브라켓 일부가 계획 입고일을 초과하였다. 기계 Assembly 착수 일정에 영향이 예상되어 공급사 잔여 공정과 긴급 납품 가능 일정을 재확인한다.",severity:"high",status:"in_progress",dueDate:"2026-09-01"},
  {type:"issue",task:"G4-A06",title:"Control Panel 제작 진척 지연",description:"주요 전장품 입고 순연과 내부 배선 작업 증가로 Control Panel 제작 진척이 계획 대비 지연되고 있다. 핵심 회로 우선 조립과 병렬 배선 작업으로 FAT 전 완료 일정을 회복한다.",severity:"high",status:"open",dueDate:"2026-09-04"},
  {type:"issue",task:"G4-A08",title:"PLC I/O Address 변경 및 프로그램 수정",description:"현장 Sensor 추가 요구로 I/O Address 일부가 변경되었다. 전기도면과 I/O List, PLC Tag를 동시에 수정하고 Unit Test 결과를 재검증해야 한다.",severity:"medium",status:"in_progress",dueDate:"2026-09-05"},
  {type:"issue",task:"G4-A05",title:"배관 Support와 장비 Frame 간 간섭 발견",description:"기계 조립 중 일부 배관 Support가 장비 Frame 보강재와 간섭되는 위치가 확인되었다. Support 위치를 이동하고 Layout 및 상세 제작도 Revision에 반영한다.",severity:"medium",status:"resolved",dueDate:"2026-08-31"},
  {type:"risk",task:"G4-A02",title:"PLC·Inverter 장기납기 품목 조달 위험",description:"PLC CPU와 Inverter 공급 리드타임 변동 시 Panel 조립 및 FAT 일정이 추가 지연될 수 있다. 대체 재고, 호환 모델과 공급사 분할 납품 가능 여부를 주간 단위로 점검한다.",severity:"high",status:"open",dueDate:"2026-09-03"},
  {type:"risk",task:"G6-A02",title:"현장 설치 시 기존 설비·배관 간섭 위험",description:"화성공장 기존 Utility 및 생산설비와 신규 이송배관 동선이 간섭될 가능성이 있다. 출하 전 최신 현장 실측과 설치 Routing Review를 수행하고 예비 Support 자재를 준비한다.",severity:"medium",status:"open",dueDate:"2026-09-25"},
  {type:"collaboration",task:"G4-A02",title:"구매팀 장기납기품 확정 납기 협조 요청",description:"PLC, HMI, Inverter, Blower 주요 구매품의 확정 납기와 부분입고 가능 일정을 공급사별로 재확인해 달라. G4 지연 회복계획에 반영한다.",severity:"high",status:"in_progress",dueDate:"2026-09-01",ownerUserId:roleUser.get("PURCHASE")||session.user.id},
  {type:"collaboration",task:"G4-A09",title:"품질팀 제작 중간검사 및 재검사 협조 요청",description:"기계 조립과 전장 조립 지연 구간을 우선 검사하고 Punch 항목의 재검사 일정을 조정해 달라. FAT 착수 전 Critical Punch 0건을 목표로 한다.",severity:"medium",status:"in_progress",dueDate:"2026-09-12",ownerUserId:roleUser.get("QUALITY")||session.user.id},
  {type:"collaboration",task:"G6-A01",title:"현장 Utility 및 작업허가 사전확인 협조 요청",description:"설비 반입 전 전원, Air, 설치공간, Crane/Forklift 동선과 작업허가 조건을 고객 현장 담당자와 사전 확인한다. SAT 일정 차질 요소를 조기 제거한다.",severity:"medium",status:"open",dueDate:"2026-09-28",ownerUserId:roleUser.get("SERVICE")||session.user.id},
];
let createdOperational=0;
for(const spec of issueSpecs){
  if(existingTitles.has(spec.title))continue;
  const task=currentByCode.get(spec.task);if(!task)throw new Error(`이슈 연결 Task를 찾지 못했습니다: ${spec.task}`);
  const form=new FormData();form.set("taskId",task.id);form.set("issueType",spec.type);form.set("title",spec.title);form.set("description",spec.description);form.set("severity",spec.severity);form.set("dueDate",spec.dueDate);if(spec.ownerUserId)form.set("ownerUserId",spec.ownerUserId);
  const created=await request(`/api/projects/${project.id}/issues`,{method:"POST",body:form});
  if(spec.status!=="open")await patch(`/api/projects/${project.id}/issues`,{id:created.id,status:spec.status});
  createdOperational++;
}

console.log(`완료: ${projectName}`);
console.log(`PM: ${session.user.name||session.user.id} / 프로젝트 참여자: ${functionalMembers.length}명 / WBS: ${assignedTasks.length}건`);
console.log(`지연 표시 대상: ${delayedTaskCodes.length}건 (${delayedTaskCodes.join(", ")}) / Part: ${equipmentBom.length}건`);
console.log(`이슈·리스크·협업: 총 9건 구성 (이슈 4 / 리스크 2 / 협업 3) · 신규 ${createdOperational}건`);
console.log("다음 단계: data:seed:hdem-docs 로 실제 산출물 12건(도면 3건 포함)을 등록합니다.");
