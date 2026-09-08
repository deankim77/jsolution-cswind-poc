import {cimDefinition,cimDemo} from "./demo-data/cim-e2e-pilot.mjs";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const request=async(path,init={})=>{const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.body?{"content-type":"application/json"}:{}),...init.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);return data};
const DAY=86400000,SHIFT_DAYS=-112,DELAY_BUSINESS_DAYS=8,AS_OF="2026-08-14";
const iso=value=>new Date(value).toISOString().slice(0,10);
const shiftDays=(date,days)=>iso(Date.parse(`${date}T00:00:00Z`)+days*DAY);
const isBusiness=date=>{const day=new Date(`${date}T00:00:00Z`).getUTCDay();return day!==0&&day!==6};
const moveBusiness=(date,days)=>{const value=new Date(`${date}T00:00:00Z`),direction=days<0?-1:1;let remaining=Math.abs(days);while(remaining){value.setUTCDate(value.getUTCDate()+direction);if(isBusiness(iso(value)))remaining--}return iso(value)};
const nextBusiness=date=>moveBusiness(date,1);
const endFromDuration=(start,duration)=>moveBusiness(start,Math.max(1,Number(duration)||1)-1);

const projects=await request("/api/projects");
const project=(projects.projects||[]).find(item=>item.code===cimDemo.projectCode);
if(!project)throw new Error(`${cimDemo.projectCode} 프로젝트를 찾지 못했습니다.`);
let detail=await request(`/api/projects/${project.id}/wbs`);
const sourceByCode=new Map(cimDefinition.wbs.map(task=>[task.id,task]));
const firstTasks=(detail.tasks||[]).map((task,index)=>({...task,sortOrder:Number(task.sortOrder??index)}));
const taskByCode=new Map(firstTasks.map(task=>[task.wbsCode,task]));
const validLeafCodes=new Set(firstTasks.filter(task=>task.kind!=="summary").map(task=>task.wbsCode));
let preservedRelationships=0,generatedRelationships=0;
const relationshipByCode=new Map();
for(const task of firstTasks.filter(task=>task.kind!=="summary")){
  const sourcePredecessor=sourceByCode.get(task.wbsCode)?.predecessorId;
  const existing=validLeafCodes.has(task.predecessorCode)?task.predecessorCode:undefined;
  const generated=!existing&&validLeafCodes.has(sourcePredecessor)?sourcePredecessor:undefined;
  if(existing)preservedRelationships++;
  if(generated)generatedRelationships++;
  relationshipByCode.set(task.wbsCode,existing||generated);
}
if(generatedRelationships){
  const payload={tasks:firstTasks.map(task=>({
    id:task.id,clientKey:task.id,wbsCode:task.wbsCode,level:task.level,name:task.name,taskType:task.taskType,durationDays:task.durationDays,
    plannedStart:task.plannedStart,plannedEnd:task.plannedEnd,predecessorClientKey:relationshipByCode.get(task.wbsCode)?taskByCode.get(relationshipByCode.get(task.wbsCode))?.id:undefined,
    roleCode:task.roleCode,assigneeUserId:task.assigneeUserId,completionActor:task.completionActor,completionCriteria:task.completionCriteria,deliverables:task.deliverables,
  }))};
  await request(`/api/projects/${project.id}/wbs`,{method:"PUT",headers:{"x-demo-seed":"jsolution-local-demo"},body:JSON.stringify(payload)});
  detail=await request(`/api/projects/${project.id}/wbs`);
}
const tasks=(detail.tasks||[]).map((task,index)=>({...task,sortOrder:Number(task.sortOrder??index)}));
const leaves=tasks.filter(task=>task.kind!=="summary");
const relationshipCount=leaves.filter(task=>task.predecessorCode).length;
if(!relationshipCount)throw new Error("CIM 기준 선행 Task 관계를 생성하지 못해 일정 보정을 중단했습니다.");

const baselineByCode=new Map();
for(let pass=0;pass<leaves.length+2;pass++){
  let changed=false;
  for(const task of leaves){
    const source=sourceByCode.get(task.wbsCode);
    if(!source?.plannedStart)throw new Error(`${task.wbsCode}의 CIM 기준 일정을 찾지 못했습니다.`);
    const baseStart=shiftDays(source.plannedStart,SHIFT_DAYS),predecessor=task.predecessorCode?baselineByCode.get(task.predecessorCode):undefined;
    const start=predecessor?.plannedEnd&&nextBusiness(predecessor.plannedEnd)>baseStart?nextBusiness(predecessor.plannedEnd):baseStart;
    const planned={plannedStart:start,plannedEnd:endFromDuration(start,task.durationDays)};
    const previous=baselineByCode.get(task.wbsCode);
    if(!previous||previous.plannedStart!==planned.plannedStart||previous.plannedEnd!==planned.plannedEnd){baselineByCode.set(task.wbsCode,planned);changed=true}
  }
  if(!changed)break;
}

const delayedCodes=new Set(leaves.slice(32).map(task=>task.wbsCode));
const progressByIndex=[...Array(32).fill(100),70,55,40,20,0,0,0,0];
const statusFor=index=>index<32?"completed":index<36?"active":"planned";
const baselineLeaves=leaves.map(task=>({...task,...baselineByCode.get(task.wbsCode)}));
const currentLeaves=baselineLeaves.map((task,index)=>{const delayed=delayedCodes.has(task.wbsCode),progress=progressByIndex[index]??0;return {...task,plannedStart:delayed?moveBusiness(task.plannedStart,DELAY_BUSINESS_DAYS):task.plannedStart,plannedEnd:delayed?moveBusiness(task.plannedEnd,DELAY_BUSINESS_DAYS):task.plannedEnd,progress,status:statusFor(index)}});

const descendantsOf=group=>{const index=tasks.findIndex(task=>task.id===group.id),result=[];for(let cursor=index+1;cursor<tasks.length&&Number(tasks[cursor].level)>Number(group.level);cursor++)if(tasks[cursor].kind!=="summary")result.push(tasks[cursor]);return result};
const buildAll=(leafRows,baseline=false)=>tasks.map(task=>{
  if(task.kind!=="summary")return leafRows.find(item=>item.id===task.id);
  const descendants=descendantsOf(task).map(child=>leafRows.find(item=>item.id===child.id)).filter(Boolean),starts=descendants.map(item=>item.plannedStart).sort(),ends=descendants.map(item=>item.plannedEnd).sort();
  const total=descendants.reduce((sum,item)=>sum+Math.max(1,item.durationDays),0),weighted=descendants.reduce((sum,item)=>sum+item.progress*Math.max(1,item.durationDays),0),progress=baseline?0:Math.round(weighted/Math.max(1,total));
  const status=baseline?"planned":descendants.every(item=>item.status==="completed")?"completed":descendants.some(item=>item.status==="active"||item.progress>0)?"active":"planned";
  return {...task,plannedStart:starts[0],plannedEnd:ends.at(-1),durationDays:0,progress,status};
});
const baselineTasks=buildAll(baselineLeaves,true),currentTasks=buildAll(currentLeaves,false);
const earlyCodes=new Set(["P2-A06","P5-A18","P8-A30"]),lateCodes=new Set(["P3-A10","P5-A19"]);
const actuals=[];
for(const [index,task] of currentLeaves.entries()){
  if(index>=36)continue;
  const baseline=baselineByCode.get(task.wbsCode),early=earlyCodes.has(task.wbsCode);
  const actualStart=early?moveBusiness(baseline.plannedStart,-2):baseline.plannedStart;
  actuals.push({taskId:task.id,actualDate:actualStart,progress:index<32?10:Math.min(15,task.progress),completed:false,actualHours:4,workNote:early?"선행 완료 전 조기 착수":"업무 착수"});
  if(index<32){actuals.push({taskId:task.id,actualDate:lateCodes.has(task.wbsCode)?moveBusiness(baseline.plannedEnd,2):baseline.plannedEnd,progress:100,completed:true,actualHours:Math.max(1,task.durationDays)*7,workNote:lateCodes.has(task.wbsCode)?"계획 대비 2영업일 지연 완료":"계획 일정 내 완료"})}
  else actuals.push({taskId:task.id,actualDate:AS_OF,progress:task.progress,completed:false,actualHours:Math.max(1,task.durationDays)*4,workNote:"현재 진행 실적"});
}
const projectStart=baselineLeaves.map(task=>task.plannedStart).sort()[0],projectEnd=currentLeaves.map(task=>task.plannedEnd).sort().at(-1);
const shape=rows=>rows.map(task=>({taskId:task.id,wbsCode:task.wbsCode,name:task.name,plannedStart:task.plannedStart,plannedEnd:task.plannedEnd,durationDays:Number(task.durationDays)||0,sortOrder:task.sortOrder,status:task.status,progress:Number(task.progress)||0}));
const totalWeight=currentLeaves.reduce((sum,task)=>sum+Math.max(1,task.durationDays),0),actualProgress=Math.round(currentLeaves.reduce((sum,task)=>sum+task.progress*Math.max(1,task.durationDays),0)/totalWeight);
console.log(`CIM 현재 데이터 확인: 실행 Task ${leaves.length}개 · 선행관계 ${relationshipCount}개 (기존 ${preservedRelationships} · 자동 생성 ${generatedRelationships})`);
console.log(`보정안: 완료 32 · 진행 4 · 예정 4 · 기간 가중 진척률 ${actualProgress}% · 조기 착수 ${earlyCodes.size}개`);
console.log(`Baseline 종료 ${baselineLeaves.map(task=>task.plannedEnd).sort().at(-1)} → 현재 예상 종료 ${projectEnd} (${DELAY_BUSINESS_DAYS}영업일 지연)`);
const result=await request(`/api/projects/${project.id}/demo-rebalance`,{method:"POST",headers:{"x-demo-seed":"jsolution-local-demo"},body:JSON.stringify({projectStart,projectEnd,baselineName:"CIM Pilot 기준 Baseline · 계획 90% 시점",baselineTasks:shape(baselineTasks),currentTasks:shape(currentTasks),actuals})});
console.log(`완료: ${result.projectName} · Baseline v${result.baseline.version} · 선후행 관계 보존 ${result.predecessorsPreserved?"확인":"확인 필요"}`);
