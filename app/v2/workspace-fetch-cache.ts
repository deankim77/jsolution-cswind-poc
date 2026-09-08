"use client";

type CachedResponse={body:ArrayBuffer;status:number;statusText:string;headers:Array<[string,string]>;loadedAt:number};
declare global {
  interface Window { __wv2WorkspaceFetchCacheInstalled?: boolean }
}

const snapshots=new Map<string,CachedResponse>();
const inflight=new Map<string,Promise<Response>>();
const FRESH_MS=20_000;
const MASTER_DATA_FRESH_MS=60_000;

const matchesListRequest=(url:URL)=>{
  if(url.pathname==="/api/system/master-data")return true;
  if(url.pathname==="/api/templates")return !url.searchParams.has("id");
  if(url.pathname==="/api/workflows/templates")return true;
  if(url.pathname==="/api/deliverable-standards")return true;
  if(url.pathname==="/api/workflows")return !url.searchParams.has("id");
  if(url.pathname==="/api/ecr"||url.pathname==="/api/quality")return !url.searchParams.has("id");
  if(url.pathname==="/api/deliverables")return !url.searchParams.has("deliverableId")&&!url.searchParams.has("versionId")&&!url.searchParams.has("attachmentId");
  return false;
};

const freshMsFor=(url:URL)=>url.pathname==="/api/system/master-data"?MASTER_DATA_FRESH_MS:FRESH_MS;

const namespaceForMutation=(url:URL)=>{
  if(url.pathname==="/api/system/master-data")return "/api/system/master-data";
  if(url.pathname==="/api/templates")return "/api/templates";
  if(url.pathname==="/api/deliverable-standards")return "/api/deliverable-standards";
  if(url.pathname==="/api/workflows/templates")return "/api/workflows/templates";
  if(url.pathname.startsWith("/api/workflows"))return "/api/workflows";
  if(url.pathname==="/api/ecr")return "/api/ecr";
  if(url.pathname==="/api/quality")return "/api/quality";
  if(url.pathname==="/api/deliverables"||/^\/api\/projects\/[^/]+\/deliverables$/.test(url.pathname))return "/api/deliverables";
  return "";
};

const clearNamespace=(namespace:string)=>{
  for(const key of snapshots.keys())if(key.startsWith(namespace+"?"))snapshots.delete(key);
};

const responseFrom=(cached:CachedResponse)=>new Response(cached.body.slice(0),{status:cached.status,statusText:cached.statusText,headers:cached.headers});

const storeResponse=async(key:string,response:Response)=>{
  if(!response.ok)return;
  const copy=response.clone();
  const body=await copy.arrayBuffer();
  snapshots.set(key,{body,status:copy.status,statusText:copy.statusText,headers:Array.from(copy.headers.entries()),loadedAt:Date.now()});
};

const isAbortError=(reason:unknown)=>reason instanceof DOMException&&reason.name==="AbortError"||reason instanceof Error&&(reason.name==="AbortError"||reason.message.toLowerCase().includes("abort"));

if(typeof window!=="undefined"&&!window.__wv2WorkspaceFetchCacheInstalled){
  window.__wv2WorkspaceFetchCacheInstalled=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const request=input instanceof Request?input:null;
    const method=(init?.method||request?.method||"GET").toUpperCase();
    const rawUrl=request?.url||String(input);
    const url=new URL(rawUrl,window.location.origin);

    if(method!=="GET"){
      const namespace=namespaceForMutation(url);
      if(namespace){
        clearNamespace(namespace);
        if(namespace==="/api/system/master-data")window.dispatchEvent(new CustomEvent("v2-master-data-invalidated"));
      }
      return nativeFetch(input as RequestInfo,init);
    }

    if(!matchesListRequest(url))return nativeFetch(input as RequestInfo,init);

    const key=`${url.pathname}?${url.searchParams.toString()}`;
    const cached=snapshots.get(key);
    if(cached){
      if(Date.now()-cached.loadedAt>=freshMsFor(url)&&!inflight.has(key)){
        const refresh=nativeFetch(input as RequestInfo,init).then(async response=>{await storeResponse(key,response);return response}).catch(reason=>{if(isAbortError(reason))return responseFrom(cached);throw reason}).finally(()=>inflight.delete(key));
        inflight.set(key,refresh);
      }
      return responseFrom(cached);
    }

    const existing=inflight.get(key);
    if(existing)return (await existing).clone();
    const requestPromise=nativeFetch(input as RequestInfo,init).then(async response=>{await storeResponse(key,response);return response}).finally(()=>inflight.delete(key));
    inflight.set(key,requestPromise);
    return requestPromise;
  }) as typeof window.fetch;

  const prewarm=["/api/system/master-data","/api/templates","/api/deliverable-standards","/api/workflows/templates"];
  for(const url of prewarm)void window.fetch(url,{cache:"no-store"}).catch(()=>undefined);
}
