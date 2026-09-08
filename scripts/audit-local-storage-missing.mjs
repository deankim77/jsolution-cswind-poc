import {readFile,stat} from "node:fs/promises";
import {resolve} from "node:path";
import pg from "pg";

async function loadDotEnv(){
  if(process.env.DATABASE_URL)return;
  let text="";
  try{text=await readFile(resolve(".env"),"utf8")}catch{}
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith("#"))continue;
    const idx=line.indexOf("=");
    if(idx<=0)continue;
    const key=line.slice(0,idx).trim();
    let value=line.slice(idx+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    if(process.env[key]===undefined)process.env[key]=value;
  }
}

await loadDotEnv();
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL이 필요합니다. .env를 확인해 주세요.");
const provider=(process.env.STORAGE_PROVIDER||"local").toLowerCase();
if(provider!=="local")throw new Error(`이 감사 도구는 local storage 전용입니다: ${provider}`);

const storageRoot=resolve(process.env.STORAGE_ROOT||"./storage");
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();

try{
  const result=await client.query(`
    SELECT v.id AS "versionId",v.file_key AS "fileKey",v.file_name AS "fileName",v.file_size AS "fileSize",v.revision,
           d.id AS "deliverableId",d.name AS "deliverableName",p.code AS "projectCode",p.name AS "projectName",
           w.wbs_code AS "wbsCode"
    FROM deliverable_versions v
    JOIN deliverables d ON d.id=v.deliverable_id
    JOIN projects p ON p.id=d.project_id
    LEFT JOIN wbs_tasks w ON w.id=d.task_id
    WHERE v.file_key IS NOT NULL AND v.file_key<>'' AND v.deleted_at IS NULL
    ORDER BY p.code,d.name,v.revision,v.created_at`);

  const missing=[];
  const present=[];
  for(const row of result.rows){
    const target=resolve(storageRoot,...String(row.fileKey).replaceAll("\\","/").split("/"));
    let exists=false,size=null;
    try{const info=await stat(target);exists=info.isFile();size=info.size}catch{}
    const item={...row,target,size};
    if(exists)present.push(item);else missing.push(item);
  }

  console.log(`Local Storage 감사 완료`);
  console.log(`DB file_key 대상: ${result.rows.length}건`);
  console.log(`실파일 존재: ${present.length}건`);
  console.log(`실파일 누락: ${missing.length}건`);
  console.log(`Storage root: ${storageRoot}`);

  const byProject=new Map();
  for(const item of missing){
    const key=`${item.projectCode} | ${item.projectName}`;
    byProject.set(key,(byProject.get(key)||0)+1);
  }
  if(byProject.size){
    console.log("\n[프로젝트별 누락]");
    for(const [key,count] of [...byProject.entries()].sort((a,b)=>b[1]-a[1]))console.log(`${String(count).padStart(3)}건  ${key}`);
  }

  if(missing.length){
    console.log("\n[누락 상세]");
    for(const item of missing){
      console.log(`${item.projectCode}\t${item.wbsCode||"-"}\tRev.${item.revision??"-"}\t${item.deliverableName}\t${item.fileName}\t${item.versionId}`);
    }
  }
}finally{
  await client.end();
}
