import fs from "node:fs/promises";
import path from "node:path";

type StoragePutOptions={httpMetadata?:{contentType?:string};customMetadata?:Record<string,string>};
export type StorageObject={body:ReadableStream<Uint8Array>;httpMetadata?:{contentType?:string};customMetadata?:Record<string,string>};
export type StorageAdapter={put:(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:StoragePutOptions)=>Promise<void>;get:(key:string)=>Promise<StorageObject|null>;delete:(key:string)=>Promise<void>};

type StoredMetadata={contentType?:string;customMetadata?:Record<string,string>};

function storageRoot(){
  const configured=process.env.STORAGE_ROOT?.trim()||"./storage";
  return path.resolve(process.cwd(),configured);
}

function safePath(key:string){
  const normalized=String(key||"").replaceAll("\\","/").replace(/^\/+/,"");
  if(!normalized||normalized.split("/").some(part=>part===".."||part===""))throw new Error("Invalid storage key.");
  const root=storageRoot(),target=path.resolve(root,...normalized.split("/"));
  const rootPrefix=`${root}${path.sep}`.toLowerCase();
  if(target.toLowerCase()!==root.toLowerCase()&&!target.toLowerCase().startsWith(rootPrefix))throw new Error("Storage key escapes configured root.");
  return target;
}

function metadataPath(filePath:string){return `${filePath}.metadata.json`;}

async function toBuffer(value:ReadableStream|ArrayBuffer|Blob|string){
  if(typeof value==="string")return Buffer.from(value,"utf8");
  if(value instanceof ArrayBuffer)return Buffer.from(value);
  if(value instanceof Blob)return Buffer.from(await value.arrayBuffer());
  return Buffer.from(await new Response(value).arrayBuffer());
}

class LocalFileStorageAdapter implements StorageAdapter{
  async put(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:StoragePutOptions){
    const filePath=safePath(key);await fs.mkdir(path.dirname(filePath),{recursive:true});
    await fs.writeFile(filePath,await toBuffer(value));
    const metadata:StoredMetadata={contentType:options?.httpMetadata?.contentType,customMetadata:options?.customMetadata};
    if(metadata.contentType||metadata.customMetadata)await fs.writeFile(metadataPath(filePath),JSON.stringify(metadata),"utf8");
  }
  async get(key:string){
    const filePath=safePath(key);let data:Buffer;
    try{data=await fs.readFile(filePath)}catch(error:any){if(error?.code==="ENOENT")return null;throw error}
    let metadata:StoredMetadata={};
    try{metadata=JSON.parse(await fs.readFile(metadataPath(filePath),"utf8")) as StoredMetadata}catch{}
    return {body:new Blob([data]).stream() as ReadableStream<Uint8Array>,httpMetadata:metadata.contentType?{contentType:metadata.contentType}:undefined,customMetadata:metadata.customMetadata};
  }
  async delete(key:string){
    const filePath=safePath(key);
    await Promise.all([fs.rm(filePath,{force:true}),fs.rm(metadataPath(filePath),{force:true})]);
  }
}

const globalStorage=globalThis as typeof globalThis&{__aiPlmStorageAdapter?:StorageAdapter};
export function getStorageAdapter():StorageAdapter{
  const provider=(process.env.STORAGE_PROVIDER?.trim()||"local").toLowerCase();
  if(provider!=="local")throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  if(!globalStorage.__aiPlmStorageAdapter)globalStorage.__aiPlmStorageAdapter=new LocalFileStorageAdapter();
  return globalStorage.__aiPlmStorageAdapter;
}

export function getStorageRoot(){return storageRoot();}
