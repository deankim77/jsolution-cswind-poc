import {automotiveProjects} from "./demo-data/automotive-g6-portfolio.mjs";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const request=async(path,init={})=>{const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.body&&typeof init.body==="string"?{"content-type":"application/json"}:{}),...(init.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);return data};
const post=(path,body)=>request(path,{method:"POST",body:JSON.stringify(body)}),patch=(path,body)=>request(path,{method:"PATCH",body:JSON.stringify(body)});
const addDays=(iso,days)=>{const value=new Date(`${iso}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)};
const gateOf=task=>Number(String(task.wbsCode||"").match(/^G(\d)/)?.[1]||0);

const session=await request("/api/session");if(!session.user?.id)throw new Error("활성 로그인 사용자를 찾지 못했습니다.");
const listed=await request("/api/projects"),projectByCode=new Map((listed.projects||[]).map(item=>[item.code,item]));
let actualCount=0,gateCount=0,recordCount=0;

for(const profile of automotiveProjects){
  const project=projectByCode.get(profile.code);if(!project)throw new Error(`${profile.code} 프로젝트가 없습니다. 자동차 G6 프로젝트 Seed를 먼저 실행해 주세요.`);
  let [wbs,library,issueData]=await Promise.all([request(`/api/projects/${project.id}/wbs`),request(`/api/projects/${project.id}/deliverables`),request(`/api/projects/${project.id}/issues`)]);
  if((library.versions||[]).length<30)throw new Error(`${profile.code} 산출물이 부족합니다: ${(library.versions||[]).length}/30. 문서 생성·등록을 먼저 실행해 주세요.`);
  const latestVersion=new Map();for(const version of library.versions||[])if(!latestVersion.has(version.deliverableId))latestVersion.set(version.deliverableId,version);
  for(const output of library.deliverables||[]){
    const task=(wbs.tasks||[]).find(item=>item.id===output.taskId),gate=task?gateOf(task):0;
    if(!gate||gate>profile.currentGate||output.status==="approved")continue;
    const version=latestVersion.get(output.id);if(!version)continue;
    await patch(`/api/projects/${project.id}/deliverables`,{action:"approve",deliverableId:output.id,versionId:version.id,note:`${profile.customerName} G${gate} 데모 검토 승인`});
  }
  library=await request(`/api/projects/${project.id}/deliverables`);
  const executable=(wbs.tasks||[]).filter(task=>task.kind!=="summary").sort((a,b)=>a.sortOrder-b.sortOrder);
  for(let gate=1;gate<profile.currentGate;gate++){
    for(const task of executable.filter(item=>gateOf(item)===gate&&item.taskType!=="gate")){
      if(task.status==="completed")continue;
      await post(`/api/projects/${project.id}/actuals`,{taskId:task.id,actualDate:addDays(profile.startDate,gate*40+task.sortOrder),actualHours:Math.max(2,Math.min(16,Number(task.durationDays||1)*2)),progress:100,workNote:`G${gate} ${task.name} 계획 대비 실적 완료. 관련 산출물 등록 및 내부 검토 완료.`,completed:true,completionConfirmed:true});actualCount++;
    }
    const gateTask=executable.find(item=>item.wbsCode===`G${gate}-REVIEW`),gateState=(await request(`/api/projects/${project.id}/gates`)).gates?.find(item=>item.gateCode===`G${gate}`);
    if(gateTask&&gateState?.decision!=="PASS"){await post(`/api/projects/${project.id}/gates`,{taskId:gateTask.id,decision:"PASS",note:`G${gate} 필수 활동·산출물 검토 완료. 다음 단계 착수 승인.`});gateCount++;}
  }
  const currentActivities=executable.filter(item=>gateOf(item)===profile.currentGate&&item.taskType!=="gate");
  const completedTarget=["PASS","REVIEW"].includes(profile.gateDecision)?currentActivities.length:Math.max(1,Math.floor(currentActivities.length*0.65));
  for(let index=0;index<currentActivities.length;index++){
    const task=currentActivities[index];if(task.status==="completed")continue;
    const progress=index<completedTarget?100:index===completedTarget?65:0;if(!progress)continue;
    await post(`/api/projects/${project.id}/actuals`,{taskId:task.id,actualDate:addDays(profile.startDate,profile.currentGate*42+index),actualHours:index<completedTarget?8:5.5,progress,workNote:index<completedTarget?`G${profile.currentGate} 계획 활동 완료. ${profile.objective} 기준과 산출물 검토 반영.`:`${profile.riskFocus} 관리항목 보완 및 재확인 진행 중.`,completed:progress===100,completionConfirmed:progress===100});actualCount++;
  }
  const currentGateTask=executable.find(item=>item.wbsCode===`G${profile.currentGate}-REVIEW`);
  if(currentGateTask){
    const currentState=(await request(`/api/projects/${project.id}/gates`)).gates?.find(item=>item.gateCode===`G${profile.currentGate}`);
    if(profile.gateDecision==="REVIEW"){
      if(currentGateTask.status!=="review")await patch(`/api/projects/${project.id}/wbs/status`,{taskId:currentGateTask.id,status:"review"});
    }else if(currentState?.decision!==profile.gateDecision){
      await post(`/api/projects/${project.id}/gates`,{taskId:currentGateTask.id,decision:profile.gateDecision,note:profile.gateDecision==="PASS"?`G${profile.currentGate} 승인 기준 충족. 다음 단계 착수 승인.`:`${profile.riskFocus} 보완 결과 확인 전까지 Gate ${profile.gateDecision} 상태 유지.`});gateCount++;
    }
  }

  const currentTask=currentActivities.find(item=>item.status!=="completed")||currentActivities.at(-1)||executable.find(item=>item.taskType!=="gate");
  const suffix=profile.code.replace(/^AUTO-|\-DEMO$/g,"");
  const specs=[
    {type:"issue",title:`[${suffix}] ${profile.riskFocus} 시험 결과 기준 미흡`,description:`${profile.name}의 ${profile.riskFocus} 시험값이 목표 관리범위를 벗어났다. 원사 장력·조직 밀도·후가공 조건을 점검하고 재시험 결과를 G${profile.currentGate} 검토자료에 반영한다.`,severity:"high",status:"in_progress"},
    {type:"issue",title:`[${suffix}] 고객 평가 의견 반영 일정 지연`,description:`${profile.customerName} 평가 의견 중 표면 감성과 색상 보완이 계획보다 지연되고 있다. 변경 사양과 샘플 제출일을 고객 창구와 재합의한다.`,severity:"medium",status:"open"},
    {type:"risk",title:`[${suffix}] 핵심 원사 공급 리드타임 증가 위험`,description:`${profile.composition} 적용 원사의 조달기간이 증가할 경우 시작품 및 양산 준비 일정에 영향을 줄 수 있다. 대체 공급처와 안전재고 확보 여부를 주간 단위로 확인한다.`,severity:"high",status:"open"},
    {type:"risk",title:`[${suffix}] 양산 로트 간 품질 편차 위험`,description:`기준 중량 ${profile.weightGsm}g/㎡와 두께 ${profile.thicknessMm}mm의 로트 편차가 고객 품질 기준을 초과할 가능성이 있다. 관리한계와 샘플링 주기를 강화한다.`,severity:"medium",status:"in_progress"},
    {type:"collaboration",title:`[${suffix}] 품질보증팀 재시험 협업 요청`,description:`${profile.riskFocus} 미흡 항목의 원인 검증을 위해 시험편 3종 비교시험과 결과 검토를 요청한다. 결과는 Gate 체크리스트와 AI 브리핑에 연결한다.`,severity:"high",status:"in_progress"},
    {type:"collaboration",title:`[${suffix}] 생산기획팀 공정조건 검토 요청`,description:`${profile.objective} 목표를 유지하면서 양산성이 확보되도록 열처리 온도·라인 속도·장력 조건 검토를 요청한다.`,severity:"medium",status:"resolved"},
  ];
  const existingTitles=new Set((issueData.issues||[]).map(item=>item.title));
  for(let index=0;index<specs.length;index++){
    const spec=specs[index];if(existingTitles.has(spec.title))continue;
    const form=new FormData();form.set("taskId",currentTask.id);form.set("issueType",spec.type);form.set("title",spec.title);form.set("description",spec.description);form.set("severity",spec.severity);form.set("dueDate",addDays(profile.startDate,profile.currentGate*45+14+index));if(spec.type==="collaboration")form.set("ownerUserId",session.user.id);
    const created=await request(`/api/projects/${project.id}/issues`,{method:"POST",body:form});if(spec.status!=="open")await patch(`/api/projects/${project.id}/issues`,{id:created.id,status:spec.status});recordCount++;
  }
  if(profile.projectStatus==="completed"&&project.status!=="completed")await post(`/api/projects/${project.id}/status`,{action:"complete",force:true});
  console.log(`${profile.code}: G${profile.currentGate} ${profile.gateDecision} · 운영 데이터 6건 확인`);
}

console.log(`자동차 G6 실행 데이터 완료: 실적 신규 ${actualCount}건 · Gate 결정 신규 ${gateCount}건 · 이슈/리스크/협업 신규 ${recordCount}건`);
console.log("기대 수량: 프로젝트 15개 · 산출물 450건 · 이슈/리스크/협업 90건");

