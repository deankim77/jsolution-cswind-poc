import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const changed=[];
function patch(rel,transforms){const file=path.join(root,rel);let text=fs.readFileSync(file,"utf8"),before=text;for(const fn of transforms)text=fn(text);if(text!==before){fs.writeFileSync(file,text,"utf8");changed.push(rel)}}
function addImport(text,anchor,line){if(text.includes(line))return text;return text.replace(anchor,`${anchor}\n${line}`)}
const replace=(from,to)=>text=>text.replace(from,to);

const storageImport5='import {getStorageAdapter} from "../../../../../lib/storage-adapter";';
const storageImport4='import {getStorageAdapter} from "../../../../lib/storage-adapter";';
const storageImport3='import {getStorageAdapter} from "../../../lib/storage-adapter";';

patch("app/api/projects/[projectId]/deliverables/route.ts",[
  text=>addImport(text,'import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";',storageImport5),
  text=>addImport(text,'import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";',storageImport5),
  replace('FILES:undefined as R2Bucket|undefined','FILES:getStorageAdapter() as unknown as R2Bucket'),
  text=>text.replace(/async function runtime\(\)\{const runtime=await import\("cloudflare:workers"\);return runtime\.env as unknown as \{DB:D1;FILES\?:R2Bucket;DWG_CONVERTER_URL\?:string;DWG_CONVERTER_TOKEN\?:string\};\}/,
    'async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket,DWG_CONVERTER_URL:process.env.DWG_CONVERTER_URL,DWG_CONVERTER_TOKEN:process.env.DWG_CONVERTER_TOKEN};}'),
]);

patch("app/api/projects/[projectId]/issues/route.ts",[
  text=>addImport(text,'import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";',storageImport5),
  text=>addImport(text,'import {canManageProject,contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";',storageImport5),
  replace('FILES:undefined as R2Bucket|undefined','FILES:getStorageAdapter() as unknown as R2Bucket'),
  text=>text.replace(/async function runtime\(\)\{const runtime=await import\("cloudflare:workers"\);return runtime\.env as unknown as \{DB:D1;FILES\?:R2Bucket\};\}/,
    'async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};}'),
]);

patch("app/api/ai/conversations/route.ts",[
  text=>addImport(text,'import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";','import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";'),
  text=>addImport(text,'import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";',storageImport4),
  text=>text.replace(/async function runtime\(\): Promise<\{DB:D1;FILES\?:R2Bucket\}> \{[\s\S]*?\n\}/m,
    'async function runtime(): Promise<{DB:D1;FILES?:R2Bucket}> {\n  return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};\n}'),
  replace('ORDER BY created_at ASC,rowid ASC','ORDER BY created_at ASC,id ASC'),
  replace('ORDER BY created_at DESC,rowid DESC','ORDER BY created_at DESC,id DESC'),
]);

patch("app/api/ai/chat/route.ts",[
  text=>addImport(text,'import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";','import {getLegacyDbCompat} from "../../../../db/postgres-d1-compat";'),
  text=>addImport(text,'import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";',storageImport4),
  text=>text.replace(/async function runtime\(\): Promise<\{ DB: D1; FILES\?: R2Bucket \}> \{[\s\S]*?\n\}/m,
    'async function runtime(): Promise<{ DB: D1; FILES?: R2Bucket }> {\n  return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};\n}'),
  replace('ORDER BY created_at DESC,rowid DESC','ORDER BY created_at DESC,id DESC'),
]);

patch("app/api/ai/document-revision/route.ts",[
  text=>addImport(text,'import type {RuntimeD1} from "../../../../db/project-data-foundation";','import {getLegacyDbCompat} from "../../../../db/postgres-d1-compat";'),
  text=>addImport(text,'import type {RuntimeD1} from "../../../../db/project-data-foundation";',storageImport4),
  text=>text.replace(/async function runtime\(\)\{const cloudflare=await import\("cloudflare:workers"\);return cloudflare\.env as unknown as RuntimeEnv;\}/,
    'async function runtime(){return {DB:getLegacyDbCompat() as unknown as RuntimeD1,FILES:getStorageAdapter() as unknown as R2Bucket} satisfies RuntimeEnv;}'),
]);

patch("app/api/workflows/source-files.ts",[
  text=>addImport(text,'import type {D1} from "./shared";',storageImport3),
  text=>text.replace(/\s*const runtime=await import\("cloudflare:workers"\);\s*const FILES=\(runtime\.env as unknown as \{FILES\?:R2Bucket\}\)\.FILES;\s*/,
    '\n  const FILES=getStorageAdapter() as unknown as R2Bucket;\n  '),
  text=>text.replace(/if\(\(rows\.results\?\?\[\]\)\.length\)\{const runtime=await import\("cloudflare:workers"\),FILES=\(runtime\.env as unknown as \{FILES\?:R2Bucket\}\)\.FILES;if\(FILES\)for\(const item of rows\.results\?\?\[\]\)await FILES\.delete\(item\.fileKey\)\}/,
    'if((rows.results??[]).length){const FILES=getStorageAdapter() as unknown as R2Bucket;for(const item of rows.results??[])await FILES.delete(item.fileKey)}'),
]);

patch("app/api/workflows/source-attachments/route.ts",[
  text=>addImport(text,'import {workflowDb} from "../shared";',storageImport4),
  text=>text.replace(/const runtime=await import\("cloudflare:workers"\),FILES=\(runtime\.env as unknown as \{FILES\?:R2Bucket\}\)\.FILES;if\(!FILES\)return Response\.json\(\{error:"파일 저장소가 연결되지 않았습니다\."\},\{status:503\}\);/,
    'const FILES=getStorageAdapter() as unknown as R2Bucket;'),
]);

console.log(`Local Storage Adapter wiring complete: ${changed.length} file(s) changed.`);
for(const file of changed)console.log(` - ${file}`);
if(!changed.length)console.log("No changes needed; storage wiring is already applied.");
