"use client";

import {useEffect,useState} from "react";

export type MasterCode={id?:string;code:string;label:string;groupCode:string;enabled?:boolean|number;status?:string};
export type MasterData={
  organizations?:Array<{id:string;name:string;status?:string}>;
  users?:Array<{id:string;userId?:string;name:string;email?:string;status?:string;organizationId?:string;organizationPath?:string;roleNames?:string[]|string}>;
  roles?:unknown[];
  codes?:MasterCode[];
  partners?:Array<{id:string;name:string;status:string}>;
  projectTypes?:Array<{id:string;name:string;status:string}>;
  projectRoles?:Array<{code:string;name:string;groupName?:string;enabled?:boolean|number;status?:string}>;
  [key:string]:unknown;
};

type Snapshot={data:MasterData|null;loadedAt:number;loading:boolean;error:string};

declare global {
  interface Window { __wv2MasterDataInvalidationInstalled?: boolean }
}

let snapshot:Snapshot={data:null,loadedAt:0,loading:false,error:""};
let request:Promise<MasterData>|null=null;
const listeners=new Set<()=>void>();
const FRESH_MS=60_000;

const emit=()=>listeners.forEach(listener=>listener());
export const getMasterDataSnapshot=()=>snapshot;
export const subscribeMasterData=(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener)};

export const invalidateMasterData=()=>{
  snapshot={...snapshot,loadedAt:0};
  emit();
};

if(typeof window!=="undefined"&&!window.__wv2MasterDataInvalidationInstalled){
  window.__wv2MasterDataInvalidationInstalled=true;
  window.addEventListener("v2-master-data-invalidated",()=>invalidateMasterData());
}

export const loadMasterData=async(force=false)=>{
  if(!force&&snapshot.data&&Date.now()-snapshot.loadedAt<FRESH_MS)return snapshot.data;
  if(request)return request;
  snapshot={...snapshot,loading:true,error:""};emit();
  request=fetch("/api/system/master-data",{cache:"no-store"}).then(async response=>{
    const data=await response.json() as MasterData&{error?:string};
    if(!response.ok)throw new Error(data.error||"시스템 기준정보를 불러오지 못했습니다.");
    snapshot={data,loadedAt:Date.now(),loading:false,error:""};emit();
    return data;
  }).catch(reason=>{
    snapshot={...snapshot,loading:false,error:reason instanceof Error?reason.message:"시스템 기준정보를 불러오지 못했습니다."};emit();
    throw reason;
  }).finally(()=>{request=null});
  return request;
};

export const masterCodeLabel=(data:MasterData|null,groupCode:string,code?:string)=>{
  if(!code)return "";
  const item=(data?.codes??[]).find(entry=>entry.groupCode===groupCode&&entry.code===code&&entry.enabled!==false&&entry.enabled!==0&&entry.status!=="inactive");
  return item?.label||"";
};

export function useMasterData(){
  const [state,setState]=useState(snapshot);
  useEffect(()=>subscribeMasterData(()=>setState({...snapshot})),[]);
  useEffect(()=>{void loadMasterData().catch(()=>undefined)},[]);
  return {...state,reload:()=>loadMasterData(true)};
}
