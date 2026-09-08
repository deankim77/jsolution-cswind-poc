import {readFile,writeFile} from "node:fs/promises";

const path="app/api/workflows/[workflowId]/route.ts";
let source=await readFile(path,"utf8");

const importAnchor='import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../db/request-context";';
const storageImport='import {getStorageAdapter} from "../../../../lib/storage-adapter";';
if(!source.includes(storageImport)){
  if(!source.includes(importAnchor))throw new Error("Workflow request-context import anchor not found.");
  source=source.replace(importAnchor,`${importAnchor}\n${storageImport}`);
}

const oldRuntime='const runtime=await import("cloudflare:workers"),FILES=(runtime.env as unknown as {FILES?:R2Bucket}).FILES;if(!FILES)return Response.json({error:"파일 저장소가 연결되지 않았습니다."},{status:503});';
const newRuntime='const FILES=getStorageAdapter() as unknown as R2Bucket;';
if(source.includes(oldRuntime))source=source.replace(oldRuntime,newRuntime);

if(source.includes('cloudflare:workers'))throw new Error("Workflow route still contains cloudflare:workers.");
if(!source.includes(storageImport)||!source.includes(newRuntime))throw new Error("Workflow Storage Adapter conversion did not apply.");

await writeFile(path,source,"utf8");
console.log("Workflow route moved from Cloudflare FILES to Node Storage Adapter.");
