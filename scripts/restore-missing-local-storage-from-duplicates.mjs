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
const storageRoot=resolve(process.env.STORAGE_ROOT||"./storage");

function targetFor(fileKey){
  const target=resolve(storageRoot,...String(fileKey).replaceAll("\\","/").split("/"));
  const rootPrefix=`${storageRoot}${process.platform==="win32"?"\\":"/"}`.toLowerCase();
  if(target.toLowerCase()!==storageRoot.toLowerCase()&&!target.toLowerCase().startsWith(rootPrefix))throw new Error(`Unsafe storage key: ${fileKey}`);
  return target;
}

async function existingStat(path){try{return await stat(path)}catch{return null}}

const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
let restored=0,missing=0,noExactDuplicate=0;
try{
  const {rows}=await client.query(`
    SELECT v.id,v.file_key AS "fileKey",v.file_name AS "fileName",v.file_size AS "fileSize",v.content_type AS "contentType",v.revision,
           p.code AS "projectCode",d.name AS "deliverableName",COALESCE(w.wbs_code,'') AS "wbsCode"
    FROM deliverable_versions v
    JOIN deliverables d ON d.id=v.deliverable_id
    JOIN projects p ON p.id=d.project_id
    LEFT JOIN wbs_tasks w ON w.id=d.task_id
    WHERE v.file_key IS NOT NULL AND v.file_key<>'' AND v.deleted_at IS NULL
    ORDER BY p.code,d.name,v.revision,v.created_at`);

  const present=[];const absent=[];
  for(const row of rows){
    const path=targetFor(row.fileKey),s=await existingStat(path);
    if(s)present.push({...row,path,actualSize:s.size});else absent.push({...row,path});
  }
  missing=absent.length;

  const exact=new Map();
  for(const row of present){
    const size=Number(row.fileSize||row.actualSize||0);
    const key=`${row.fileName}\u0000${size}`;
    if(!exact.has(key))exact.set(key,[]);
    exact.get(key).push(row);
  }

  for(const row of absent){
    const key=`${row.fileName}\u0000${Number(row.fileSize||0)}`;
    const candidates=exact.get(key)||[];
    if(!Number(row.fileSize||0)||candidates.length===0){
      console.log(`NO MATCH ${row.projectCode} ${row.wbsCode} Rev.${row.revision} ${row.fileName}`);
      noExactDuplicate++;continue;
    }
    const source=candidates[0];
    await mkdir(dirname(row.path),{recursive:true});
    await copyFile(source.path,row.path);
    const metadata={contentType:row.contentType||source.contentType||"application/octet-stream",customMetadata:{restoredFrom:"EXACT_LOCAL_DUPLICATE",sourceVersionId:source.id,versionId:row.id,originalName:row.fileName}};
    await writeFile(`${row.path}.metadata.json`,JSON.stringify(metadata),"utf8");
    restored++;
    console.log(`RESTORED ${row.projectCode} ${row.wbsCode} Rev.${row.revision} ${row.fileName}`);
    console.log(`  FROM ${source.projectCode} ${source.wbsCode} Rev.${source.revision}`);
  }

  console.log("\n중복 실파일 기반 Local Storage 복원 완료");
  console.log(`실행 전 누락: ${missing}건`);
  console.log(`정확 일치 복원: ${restored}건`);
  console.log(`정확 중복 없음: ${noExactDuplicate}건`);
  console.log(`Storage root: ${storageRoot}`);
}finally{
  await client.end();
}
