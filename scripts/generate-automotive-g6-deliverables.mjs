import {rm,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {automotiveProjects,buildAutomotiveTemplate,deliverableBlueprints} from "./demo-data/automotive-g6-portfolio.mjs";
import {buildDeliverableDocument,documentPlainText} from "./demo-data/automotive-document-content.mjs";
import {writeBusinessBriefDocx} from "./lib/minimal-docx.mjs";

const args=new Set(process.argv.slice(2)),sample=args.has("--sample"),clean=args.has("--clean");
const out=resolve(process.env.AUTO_G6_DOCS_DIR||".demo-generated/automotive-g6");
if(clean)await rm(out,{recursive:true,force:true});
const definition=buildAutomotiveTemplate();
const taskByDeliverable=new Map();
for(const task of definition.wbs)for(const item of task.deliverables||[])taskByDeliverable.set(`${task.id}|${item.name}`,task);

const selectedProjects=sample?automotiveProjects.slice(0,1):automotiveProjects;
const selectedBlueprints=sample?deliverableBlueprints.slice(0,1):deliverableBlueprints;
const manifest=[];
for(const project of selectedProjects){
  for(const blueprint of selectedBlueprints){
    const task=definition.wbs.find(item=>(item.deliverables||[]).some(output=>output.name===blueprint.title));
    if(!task)throw new Error(`산출물 연결 Task를 찾지 못했습니다: ${blueprint.title}`);
    const document=buildDeliverableDocument(project,blueprint);
    const bodyLength=document.sections.reduce((sum,section)=>sum+section.body.length,0);
    if(bodyLength<600||bodyLength>1200)throw new Error(`${project.code} ${blueprint.title} 본문 분량이 기준 밖입니다: ${bodyLength}자`);
    const path=join(out,project.code,`G${blueprint.gate}`,document.fileName.replace(/[\\/:*?"<>|]/g,"_"));
    const result=await writeBusinessBriefDocx(path,document);
    manifest.push({projectCode:project.code,projectName:project.name,customerName:project.customerName,gate:`G${blueprint.gate}`,taskCode:task.id,deliverableName:blueprint.title,category:blueprint.category,required:blueprint.required,fileName:document.fileName,path:result.path,fileSize:result.size,bodyLength,previewText:documentPlainText(document)});
  }
}
await writeFile(join(out,"manifest.json"),JSON.stringify({generatedAt:new Date().toISOString(),sample,count:manifest.length,documents:manifest},null,2));
console.log(`자동차 G6 산출물 생성 완료: ${manifest.length}건`);
console.log(`출력 위치: ${out}`);

