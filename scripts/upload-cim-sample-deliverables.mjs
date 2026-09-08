import {readFile} from "node:fs/promises";
import {basename,dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const here=dirname(fileURLToPath(import.meta.url));
const sampleDir=resolve(here,"demo-files/cim");
const samples=[
  {taskCode:"P1-A02",deliverableName:"프로젝트 정의서",file:"01_프로젝트_정의서.docx"},
  {taskCode:"P2-A08",deliverableName:"개발품 사양서",file:"02_개발품_사양서.docx"},
  {taskCode:"P3-A09",deliverableName:"Gate 체크리스트",file:"03_Gate_체크리스트.docx"},
  {taskCode:"P4-A15",deliverableName:"외주 작업 의뢰서",file:"04_외주_작업_의뢰서.docx"},
  {taskCode:"P5-A17",deliverableName:"품질 이슈 보고서",file:"05_품질_이슈_보고서.docx"},
  {taskCode:"P6-A22",deliverableName:"설계변경 영향 분석서",file:"06_설계변경_영향_분석서.docx"},
  {taskCode:"P8-A29",deliverableName:"양산 이관 체크리스트",file:"07_양산_이관_체크리스트.docx"},
  {taskCode:"P10-A39",deliverableName:"주간보고서",file:"08_주간보고서.docx"},
];

const json=async(path,init={})=>{
  const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);
  return data;
};

console.log(`CIM 데모 산출물 ${samples.length}종을 ${base}에 등록합니다.`);
const session=await json("/api/session");
if(!session.user?.id)throw new Error("활성 로그인 사용자를 찾지 못했습니다. dev:v2 서버와 초기 데이터를 확인해 주세요.");

const projects=await json("/api/projects");
const project=(projects.projects||[]).find(item=>item.code==="CIM-2026-PILOT-DEMO");
if(!project)throw new Error("CIM-2026-PILOT-DEMO 프로젝트가 없습니다. npm run data:seed:cim을 먼저 실행해 주세요.");

const [wbs,library]=await Promise.all([
  json(`/api/projects/${project.id}/wbs`),
  json(`/api/projects/${project.id}/deliverables`),
]);
const taskByCode=new Map((wbs.tasks||[]).map(task=>[task.wbsCode,task]));
let uploaded=0,skipped=0;

for(const sample of samples){
  const task=taskByCode.get(sample.taskCode);
  if(!task)throw new Error(`Task를 찾지 못했습니다: ${sample.taskCode}`);
  const slot=(library.deliverables||[]).find(item=>item.taskId===task.id&&item.name===sample.deliverableName);
  if(!slot)throw new Error(`계획 산출물을 찾지 못했습니다: ${sample.taskCode} / ${sample.deliverableName}`);
  const already=(library.versions||[]).some(version=>version.deliverableId===slot.id&&version.fileName===sample.file);
  if(already){console.log(`건너뜀: ${sample.taskCode} · ${sample.deliverableName} (동일 샘플 등록됨)`);skipped++;continue;}

  const bytes=await readFile(resolve(sampleDir,sample.file));
  const form=new FormData();
  form.set("taskId",task.id);
  form.set("deliverableId",slot.id);
  form.set("note","CIM 2026-08-21 데모용 반 페이지 샘플");
  form.set("file",new File([bytes],basename(sample.file),{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}));
  const result=await json(`/api/projects/${project.id}/deliverables`,{method:"POST",body:form});
  console.log(`등록: ${sample.taskCode} · ${sample.deliverableName} · ${result.version}`);
  uploaded++;
}

console.log(`완료: 신규 등록 ${uploaded}건 · 기존 유지 ${skipped}건 · 총 ${samples.length}건`);
console.log("브라우저의 문서·산출물 또는 해당 Task 산출물 패널에서 Revision과 미리보기를 확인하세요.");

