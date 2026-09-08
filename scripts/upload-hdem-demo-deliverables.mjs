import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {hdemDemo} from "./demo-data/hdem-equipment-g6.mjs";

const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const root=resolve(process.env.HDEM_DOCS_DIR||".demo-generated/hdem-equipment-g6");
const projectCode=`${hdemDemo.projectCode}-DEMO`;
const request=async(path,init={})=>{const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);return data};
const manifest=JSON.parse(await readFile(resolve(root,"manifest.json"),"utf8"));
if(manifest.count!==12)throw new Error(`산출물 manifest가 올바르지 않습니다: ${manifest.count}/12`);
const listed=await request("/api/projects"),project=(listed.projects||[]).find(item=>item.code===projectCode);
if(!project)throw new Error(`${projectCode} 프로젝트가 없습니다. data:seed:hdem 을 먼저 실행해 주세요.`);
const [wbs,library]=await Promise.all([request(`/api/projects/${project.id}/wbs`),request(`/api/projects/${project.id}/deliverables`)]);
const taskByCode=new Map((wbs.tasks||[]).map(task=>[task.wbsCode,task]));
const drawingTypeFor=item=>item.name.includes("Layout")?"LAYOUT":item.name.includes("계통도")?"PROCESS_FLOW":"ELECTRICAL";
let uploaded=0,skipped=0;
for(const item of manifest.documents){
  const task=taskByCode.get(item.task);if(!task)throw new Error(`Task를 찾지 못했습니다: ${item.task}`);
  const slot=(library.deliverables||[]).find(output=>output.taskId===task.id&&output.name===item.name);
  if(!slot)throw new Error(`계획 산출물을 찾지 못했습니다: ${item.task} / ${item.name}`);
  if((library.versions||[]).some(version=>version.deliverableId===slot.id&&version.fileName===item.fileName)){skipped++;continue;}
  const bytes=await readFile(item.path),form=new FormData();
  form.set("taskId",task.id);form.set("deliverableId",slot.id);
  form.set("note",`${project.name} · ${item.gate} 현대전기기계공업 데모 실제 산출물`);
  if(item.documentKind==="drawing"){
    form.set("documentKind","drawing");
    form.set("drawingType",drawingTypeFor(item));
    form.set("internalDrawingNumber",item.name.match(/HD-[A-Z]+-\d+/)?.[0]||"");
    form.set("ownerDepartment",item.task.startsWith("G2")?"기계설계팀":"전기제어팀");
  }
  form.set("file",new File([bytes],item.fileName,{type:item.mime}));
  await request(`/api/projects/${project.id}/deliverables`,{method:"POST",body:form});uploaded++;
}
console.log(`현대전기기계공업 산출물 등록 완료: 신규 ${uploaded}건 · 기존 ${skipped}건 · 전체 ${uploaded+skipped}/12건`);
console.log("계획 산출물 18건 중 12건만 등록하여 등록률 66.7%를 유지합니다.");
