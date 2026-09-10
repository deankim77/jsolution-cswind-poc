"use client";
import {useCallback,useEffect,useRef,useState} from "react";

// Keep writes ordered even when a view unmounts and mounts again.
const pendingWrites=new Map<string,Promise<void>>();
export function saveUserViewState(key:string,value:unknown):Promise<void>{
 const previous=pendingWrites.get(key)??Promise.resolve();
 const request=previous.catch(()=>{}).then(async()=>{
  const response=await fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key,value}),keepalive:true});
  if(!response.ok)throw Error("보기 설정을 저장하지 못했습니다.");
 });
 pendingWrites.set(key,request);
 const clear=()=>{if(pendingWrites.get(key)===request)pendingWrites.delete(key);};
 void request.then(clear,clear);
 return request;
}
export async function readUserViewState(key:string,signal:AbortSignal){
 await pendingWrites.get(key)?.catch(()=>{});
 const response=await fetch(`/api/state?key=${encodeURIComponent(key)}`,{cache:"no-store",signal});
 if(!response.ok)throw Error("보기 설정을 불러오지 못했습니다.");
 return response.json() as Promise<{value:unknown}>;
}
export function useColumnPreferences<K extends string>(key:string,defaults:readonly K[],locked:readonly K[]){
 const [visible,setVisible]=useState<Set<K>>(()=>new Set(defaults));
 const [readyKey,setReadyKey]=useState(""),[error,setError]=useState(""),[reload,setReload]=useState(0);
 const activeKey=useRef(key);activeKey.current=key;
 const mounted=useRef(false),latest=useRef<Set<K>>(new Set(defaults));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const normalize=useCallback((values:unknown[])=>new Set<K>([...values.filter((v):v is K=>typeof v==="string"&&defaults.includes(v as K)),...locked]),[defaults,locked]);
 useEffect(()=>{
  const controller=new AbortController();setError("");
  readUserViewState(key,controller.signal).then(({value})=>{
   if(controller.signal.aborted)return;
   const saved=value as {columns?:unknown[]}|null;
   const next=normalize(Array.isArray(saved?.columns)?saved.columns:[...defaults]);
   latest.current=next;setVisible(next);setReadyKey(key);
  }).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});
  return()=>controller.abort();
 },[key,defaults,normalize,reload]);
 const persist=useCallback((next:Set<K>)=>{
  setError("");
  void saveUserViewState(key,{columns:[...next]}).catch(reason=>{
   if(mounted.current&&activeKey.current===key)setError(reason.message);
  });
 },[key]);
 const change=useCallback((next:Set<K>)=>{
  if(readyKey!==key)return;
  const normalized=normalize([...next]);latest.current=normalized;setVisible(normalized);persist(normalized);
 },[key,readyKey,normalize,persist]);
 const retry=()=>{if(readyKey===key)persist(latest.current);else setReload(v=>v+1);};
 return {visible,change,ready:readyKey===key,error,retry};
}
