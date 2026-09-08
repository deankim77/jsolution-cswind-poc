import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {automotiveProjects} from "./demo-data/automotive-g6-portfolio.mjs";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const root=resolve(process.env.AUTO_G6_DOCS_DIR||".demo-generated/automotive-g6");
const request=async(path,init={})=>{
  const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);
  return data;
};
const manifest=JSON.parse(await readFile(resolve(root,"manifest.json"),"utf8"));
if(manifest.count!==450)throw new Error(`산출물 manifest가 완전하지 않습니다: ${manifest.count}/450`);

const listed=await request("/api/projects"),projectByCode=new Map((listed.projects||[]).map(item=>[item.code,item]));
const expectedCodes=new Set(automotiveProjects.map(item=>item.code));
if([...expectedCodes].some(code=>!projectByCode.has(code)))throw new Error("15개 자동차 데모 프로젝트를 먼저 생성해 주세요: npm run data:seed:auto-g6");

let uploaded=0,skipped=0;
for(const profile of automotiveProjects){
  const project=projectByCode.get(profile.code);
  const [wbs,library]=await Promise.all([request(`/api/projects/${project.id}/wbs`),request(`/api/projects/${project.id}/deliverables`)]);
  const taskByCode=new Map((wbs.tasks||[]).map(task=>[task.wbsCode,task]));
  const docs=manifest.documents.filter(item=>item.projectCode===profile.code);
  for(const item of docs){
    const task=taskByCode.get(item.taskCode);
    if(!task)throw new Error(`${profile.code} Task를 찾지 못했습니다: ${item.taskCode}`);
    const slot=(library.deliverables||[]).find(output=>output.taskId===task.id&&output.name===item.deliverableName);
    if(!slot)throw new Error(`${profile.code} 계획 산출물을 찾지 못했습니다: ${item.taskCode} / ${item.deliverableName}`);
    if((library.versions||[]).some(version=>version.deliverableId===slot.id&&version.fileName===item.fileName)){skipped++;continue;}
    const bytes=await readFile(item.path),form=new FormData();
    form.set("taskId",task.id);form.set("deliverableId",slot.id);
    form.set("note",`${profile.customerName} ${profile.name} · ${item.gate} AI 분석용 데모 산출물 · 본문 ${item.bodyLength}자`);
    form.set("file",new File([bytes],item.fileName,{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}));
    await request(`/api/projects/${project.id}/deliverables`,{method:"POST",body:form});uploaded++;
  }
  console.log(`${profile.code}: 신규 ${docs.length-(library.versions||[]).filter(version=>docs.some(item=>item.fileName===version.fileName)).length}건 처리`);
}
console.log(`자동차 G6 산출물 등록 완료: 신규 ${uploaded}건 · 기존 유지 ${skipped}건 · 전체 ${uploaded+skipped}/450건`);

