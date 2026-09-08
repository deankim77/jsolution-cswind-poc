import {readFile,copyFile,mkdir,stat,writeFile} from "node:fs/promises";
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

const docsRoot=resolve(process.env.AUTO_G6_DOCS_DIR||".demo-generated/automotive-g6");
const storageRoot=resolve(process.env.STORAGE_ROOT||"./storage");
const manifestPath=resolve(docsRoot,"manifest.json");
let manifest;
try{manifest=JSON.parse(await readFile(manifestPath,"utf8"))}catch{throw new Error(`자동차 G6 manifest를 찾을 수 없습니다: ${manifestPath}\n먼저 npm.cmd run data:generate:auto-g6-docs 를 실행해 주세요.`)}
if(manifest.count!==450)throw new Error(`자동차 G6 manifest가 완전하지 않습니다: ${manifest.count}/450`);

const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
let restored=0,alreadyPresent=0,missingProject=0,missingVersion=0,missingSource=0,sizeMismatch=0;
try{
  const projectsResult=await client.query("SELECT id,code,name FROM projects WHERE code LIKE 'AUTO-%-DEMO'");
  const projectByCode=new Map(projectsResult.rows.map(row=>[row.code,row]));

  for(const item of manifest.documents||[]){
    const project=projectByCode.get(item.projectCode);
    if(!project){console.warn(`SKIP 프로젝트 없음: ${item.projectCode}`);missingProject++;continue;}

    const versionResult=await client.query(`
      SELECT v.id,v.file_key AS "fileKey",v.file_name AS "fileName",v.file_size AS "fileSize",v.content_type AS "contentType",v.revision,
             d.id AS "deliverableId",d.name AS "deliverableName",w.wbs_code AS "wbsCode"
      FROM deliverable_versions v
      JOIN deliverables d ON d.id=v.deliverable_id
      LEFT JOIN wbs_tasks w ON w.id=d.task_id
      WHERE v.project_id=$1 AND v.file_name=$2 AND d.name=$3 AND COALESCE(w.wbs_code,'')=$4 AND v.deleted_at IS NULL
      ORDER BY v.revision DESC,v.created_at DESC
      LIMIT 1`,[project.id,item.fileName,item.deliverableName,item.taskCode]);
    const version=versionResult.rows[0];
    if(!version){console.warn(`SKIP DB version 없음: ${item.projectCode} / ${item.taskCode} / ${item.fileName}`);missingVersion++;continue;}

    let sourceStat;try{sourceStat=await stat(item.path)}catch{console.warn(`SKIP 생성 파일 없음: ${item.path}`);missingSource++;continue;}
    const target=resolve(storageRoot,...String(version.fileKey).replaceAll("\\","/").split("/"));
    const rootPrefix=`${storageRoot}${process.platform==="win32"?"\\":"/"}`.toLowerCase();
    if(target.toLowerCase()!==storageRoot.toLowerCase()&&!target.toLowerCase().startsWith(rootPrefix))throw new Error(`Unsafe storage key: ${version.fileKey}`);

    try{
      const existing=await stat(target);
      if(existing.size===sourceStat.size){alreadyPresent++;continue;}
    }catch{}

    await mkdir(dirname(target),{recursive:true});
    await copyFile(item.path,target);
    const metadata={contentType:version.contentType||"application/vnd.openxmlformats-officedocument.wordprocessingml.document",customMetadata:{restoredFrom:"AUTOMOTIVE_G6_DEMO_GENERATOR",versionId:version.id,originalName:version.fileName}};
    await writeFile(`${target}.metadata.json`,JSON.stringify(metadata),"utf8");
    const written=await stat(target);
    if(Number(version.fileSize||0)>0&&written.size!==Number(version.fileSize)){sizeMismatch++;console.warn(`WARN size mismatch ${item.projectCode} / ${version.fileName}: DB=${version.fileSize}, restored=${written.size}`)}
    restored++;
  }

  console.log("\n자동차 G6 Local Storage 복원 완료");
  console.log(`복원: ${restored}건`);
  console.log(`이미 존재: ${alreadyPresent}건`);
  console.log(`프로젝트 없음: ${missingProject}건`);
  console.log(`DB version 없음: ${missingVersion}건`);
  console.log(`생성 파일 없음: ${missingSource}건`);
  console.log(`크기 불일치 경고: ${sizeMismatch}건`);
  console.log(`Storage root: ${storageRoot}`);
}finally{
  await client.end();
}
