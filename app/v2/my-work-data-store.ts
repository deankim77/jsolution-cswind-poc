"use client";

type CacheEntry<T>={value:T;loadedAt:number};

const FRESH_MS=20_000;
const pageCache=new Map<string,CacheEntry<unknown>>();
const summaryCache=new Map<string,CacheEntry<unknown>>();

const read=<T>(cache:Map<string,CacheEntry<unknown>>,key:string)=>{
  const entry=cache.get(key);
  if(!entry)return null;
  return {value:entry.value as T,fresh:Date.now()-entry.loadedAt<FRESH_MS};
};

export const readMyWorkPageCache=<T>(key:string)=>read<T>(pageCache,key);
export const readMyWorkSummaryCache=<T>(key:string)=>read<T>(summaryCache,key);
export const writeMyWorkPageCache=<T>(key:string,value:T)=>pageCache.set(key,{value,loadedAt:Date.now()});
export const writeMyWorkSummaryCache=<T>(key:string,value:T)=>summaryCache.set(key,{value,loadedAt:Date.now()});
