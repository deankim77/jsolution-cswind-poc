"use client";

import {useEffect,useState} from "react";

const DASHBOARD_FRESH_MS=20_000;

type DashboardSnapshot={data:unknown|null;loadedAt:number;detailLoadedAt:number};

let snapshot:DashboardSnapshot={data:null,loadedAt:0,detailLoadedAt:0};
let summaryInflight:Promise<unknown>|null=null;
let detailInflight:Promise<unknown>|null=null;
const listeners=new Set<()=>void>();

const publish=()=>listeners.forEach(listener=>listener());

async function loadDetail(force=false){
  const now=Date.now();
  if(!force&&snapshot.data&&snapshot.detailLoadedAt&&now-snapshot.detailLoadedAt<DASHBOARD_FRESH_MS)return snapshot.data;
  if(detailInflight)return detailInflight;
  detailInflight=fetch("/api/dashboard-detail",{cache:"no-store"}).then(async response=>{
    if(!response.ok)throw new Error("대시보드 상세 데이터를 불러오지 못했습니다.");
    const data=await response.json();
    snapshot={data,loadedAt:Date.now(),detailLoadedAt:Date.now()};
    publish();
    return data;
  }).finally(()=>{detailInflight=null});
  return detailInflight;
}

async function loadDashboard(){
  const now=Date.now();
  if(snapshot.data){
    if(!snapshot.detailLoadedAt||now-snapshot.detailLoadedAt>=DASHBOARD_FRESH_MS)void loadDetail().catch(()=>{});
    return snapshot.data;
  }
  if(summaryInflight)return summaryInflight;
  summaryInflight=fetch("/api/dashboard/summary",{cache:"no-store"}).then(async response=>{
    if(!response.ok)throw new Error("대시보드 요약 데이터를 불러오지 못했습니다.");
    const data=await response.json();
    snapshot={data,loadedAt:Date.now(),detailLoadedAt:0};
    publish();
    void loadDetail().catch(()=>{});
    return data;
  }).finally(()=>{summaryInflight=null});
  return summaryInflight;
}

export function useSharedDashboard<T>(){
  const [data,setData]=useState<T|null>(()=>snapshot.data as T|null);
  useEffect(()=>{
    let active=true;
    const sync=()=>{if(active)setData(snapshot.data as T|null)};
    listeners.add(sync);
    sync();
    void loadDashboard().catch(()=>{});
    return()=>{active=false;listeners.delete(sync)};
  },[]);
  return data;
}

export function invalidateSharedDashboard(){
  snapshot={...snapshot,loadedAt:0,detailLoadedAt:0};
}

export async function refreshSharedDashboard<T>(){
  return await loadDetail(true) as T;
}
