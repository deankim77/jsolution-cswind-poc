import {readFile,mkdir,stat,writeFile,rm} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {spawn} from "node:child_process";
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

function run(cmd,args,cwd){
  return new Promise((resolvePromise,reject)=>{
    const p=spawn(cmd,args,{cwd,stdio:["ignore","pipe","pipe"],shell:false});
    let out="",err="";
    p.stdout.on("data",d=>out+=d);p.stderr.on("data",d=>err+=d);
    p.on("error",reject);
    p.on("close",code=>code===0?resolvePromise({out,err}):reject(new Error(`${cmd} ${args.join(" ")} failed (${code})\n${out}\n${err}`)));
  });
}

await loadDotEnv();
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL이 필요합니다.");
const storageRoot=resolve(process.env.STORAGE_ROOT||"./storage");
const v2Root=resolve(process.env.V2_ROOT||"C:/Projects/jsolution-ai-pms-v2");
const bucket=process.env.V2_R2_BUCKET||"jsolution-ai-pms-files";
const tmpRoot=resolve(process.env.TEMP||process.env.TMP||"C:/Temp","jsolution-v2-r2-recovery");
await mkdir(tmpRoot,{recursive:true});

const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
let restored=0,missingInR2=0,sizeMismatch=0,alreadyPresent=0;
try{
  const {rows}=await client.query(`
    SELECT v.id,v.file_key AS "fileKey",v.file_name AS "fileName",v.file_size AS "fileSize",v.content_type AS "contentType",
           p.code AS "projectCode",d.name AS "deliverableName"
    FROM deliverable_versions v
    JOIN deliverables d ON d.id=v.deliverable_id
    JOIN projects p ON p.id=d.project_id
    WHERE v.file_key IS NOT NULL AND v.file_key<>'' AND v.deleted_at IS NULL
    ORDER BY v.created_at`);

  for(const row of rows){
    const target=resolve(storageRoot,...String(row.fileKey).replaceAll("\\","/").split("/"));
    try{await stat(target);alreadyPresent++;continue}catch{}
    const tmp=join(tmpRoot,`${row.id}-${row.fileName}`);
    try{
      await run("npx.cmd",["wrangler","r2","object","get",`${bucket}/${row.fileKey}`,"--local","--file",tmp],v2Root);
    }catch(error){
      console.warn(`NO R2 OBJECT ${row.projectCode} ${row.fileName}`);
      missingInR2++;continue;
    }
    const s=await stat(tmp);
    if(Number(row.fileSize||0)>0&&s.size!==Number(row.fileSize)){
      console.warn(`SIZE MISMATCH ${row.fileName}: DB=${row.fileSize} R2=${s.size}`);
      sizeMismatch++;await rm(tmp,{force:true});continue;
    }
    await mkdir(dirname(target),{recursive:true});
    await writeFile(target,await readFile(tmp));
    await writeFile(`${target}.metadata.json`,JSON.stringify({contentType:row.contentType||"application/octet-stream",customMetadata:{restoredFrom:"V2_LOCAL_R2",versionId:row.id,originalName:row.fileName}}),"utf8");
    await rm(tmp,{force:true});
    restored++;
    console.log(`RESTORED ${row.projectCode} ${row.fileName}`);
  }

  console.log("\nV2 Local R2 복원 완료");
  console.log(`복원: ${restored}건`);
  console.log(`이미 존재: ${alreadyPresent}건`);
  console.log(`V2 Local R2 원본 없음: ${missingInR2}건`);
  console.log(`크기 불일치: ${sizeMismatch}건`);
  console.log(`Storage root: ${storageRoot}`);
  console.log(`V2 root: ${v2Root}`);
}finally{await client.end()}
