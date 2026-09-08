import {readFile,copyFile,mkdir,stat,writeFile,readdir} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import pg from "pg";

async function loadDotEnv(){
  if(process.env.DATABASE_URL)return;
  let text="";try{text=await readFile(resolve(".env"),"utf8")}catch{}
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith("#"))continue;
    const idx=line.indexOf("=");if(idx<=0)continue;
    const key=line.slice(0,idx).trim();let value=line.slice(idx+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    if(process.env[key]===undefined)process.env[key]=value;
  }
}

await loadDotEnv();
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL이 필요합니다. .env를 확인해 주세요.");
const provider=(process.env.STORAGE_PROVIDER||"local").toLowerCase();
if(provider!=="local")throw new Error(`이 복원 도구는 local storage 전용입니다: ${provider}`);

const projectCode="CIM-2026-PILOT-DEMO";
const sourceRoot=resolve("scripts/demo-files/cim");
const storageRoot=resolve(process.env.STORAGE_ROOT||"./storage");
const expected=[
  "01_프로젝트_정의서.docx",
  "02_개발품_사양서.docx",
  "03_Gate_체크리스트.docx",
  "04_외주_작업_의뢰서.docx",
  "05_품질_이슈_보고서.docx",
  "06_설계변경_영향_분석서.docx",
  "07_양산_이관_체크리스트.docx",
  "08_주간보고서.docx",
];

const actual=new Set(await readdir(sourceRoot));
for(const name of expected)if(!actual.has(name))throw new Error(`CIM 원본 파일 없음: ${name}`);

const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
let restored=0,alreadyPresent=0,missingVersion=0,sizeMismatch=0;
try{
  const projectResult=await client.query("SELECT id,code,name FROM projects WHERE code=$1 LIMIT 1",[projectCode]);
  const project=projectResult.rows[0];
  if(!project)throw new Error(`${projectCode} 프로젝트를 PostgreSQL에서 찾을 수 없습니다.`);

  for(const fileName of expected){
    const source=resolve(sourceRoot,fileName);
    const sourceStat=await stat(source);
    const versionResult=await client.query(`
      SELECT v.id,v.file_key AS "fileKey",v.file_name AS "fileName",v.file_size AS "fileSize",v.content_type AS "contentType",v.revision,
             d.id AS "deliverableId",d.name AS "deliverableName",w.wbs_code AS "wbsCode"
      FROM deliverable_versions v
      JOIN deliverables d ON d.id=v.deliverable_id
      LEFT JOIN wbs_tasks w ON w.id=d.task_id
      WHERE v.project_id=$1 AND v.file_name=$2 AND v.deleted_at IS NULL
      ORDER BY v.revision DESC,v.created_at DESC
      LIMIT 1`,[project.id,fileName]);
    const version=versionResult.rows[0];
    if(!version){console.warn(`SKIP DB version 없음: ${fileName}`);missingVersion++;continue;}

    const target=resolve(storageRoot,...String(version.fileKey).replaceAll("\\","/").split("/"));
    const rootPrefix=`${storageRoot}${process.platform==="win32"?"\\":"/"}`.toLowerCase();
    if(target.toLowerCase()!==storageRoot.toLowerCase()&&!target.toLowerCase().startsWith(rootPrefix))throw new Error(`Unsafe storage key: ${version.fileKey}`);

    try{
      const existing=await stat(target);
      if(existing.size===sourceStat.size){alreadyPresent++;continue;}
    }catch{}

    await mkdir(dirname(target),{recursive:true});
    await copyFile(source,target);
    const metadata={contentType:version.contentType||"application/vnd.openxmlformats-officedocument.wordprocessingml.document",customMetadata:{restoredFrom:"CIM_DEMO_FILES",versionId:version.id,originalName:version.fileName}};
    await writeFile(`${target}.metadata.json`,JSON.stringify(metadata),"utf8");
    const written=await stat(target);
    if(Number(version.fileSize||0)>0&&written.size!==Number(version.fileSize)){sizeMismatch++;console.warn(`WARN size mismatch ${version.fileName}: DB=${version.fileSize}, restored=${written.size}`)}
    restored++;
    console.log(`RESTORED ${version.wbsCode||"-"} -> ${version.fileKey}`);
  }

  console.log("\nCIM Local Storage 복원 완료");
  console.log(`프로젝트: ${project.code} / ${project.name}`);
  console.log(`복원: ${restored}건`);
  console.log(`이미 존재: ${alreadyPresent}건`);
  console.log(`DB version 없음: ${missingVersion}건`);
  console.log(`크기 불일치 경고: ${sizeMismatch}건`);
  console.log(`Storage root: ${storageRoot}`);
}finally{
  await client.end();
}
