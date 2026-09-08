"use client";

import {useEffect,useState} from "react";

const PROJECT_DASHBOARD_FRESH_MS=20_000;

type ProjectDashboardSnapshot={data:unknown;loadedAt:number};
const snapshots=new Map<string,ProjectDashboardSnapshot>();
const inflight=new Map<string,Promise<unknown>>();
const listeners=new Map<string,Set<()=>void>>();

const publish=(projectId:string)=>listeners.get(projectId)?.forEach(listener=>listener());

async function loadProjectDashboard(projectId:string,force=false){
  const now=Date.now(),cached=snapshots.get(projectId);
  if(!force&&cached&&now-cached.loadedAt<PROJECT_DASHBOARD_FRESH_MS)return cached.data;
  const existing=inflight.get(projectId);if(existing)return existing;
  const request=Promise.all([
    fetch(`/api/projects/${projectId}/issues`,{cache:"no-store"}).then(response=>response.ok?response.json():{issues:[]}),
    fetch(`/api/deliverables?projectId=${encodeURIComponent(projectId)}`,{cache:"no-store"}).then(response=>response.ok?response.json():{deliverables:[]}),
    fetch(`/api/projects/${projectId}/gates`,{cache:"no-store"}).then(response=>response.ok?response.json():{gates:[]}),
  ]).then(([issueData,deliverableData,gateData])=>{
    const data={
      issues:issueData.issues??[],
      deliverables:(deliverableData.deliverables??[]).filter((item:{projectId?:string})=>!item.projectId||item.projectId===projectId),
      gates:gateData.gates??[],
    };
    snapshots.set(projectId,{data,loadedAt:Date.now()});publish(projectId);return data;
  }).finally(()=>inflight.delete(projectId));
  inflight.set(projectId,request);return request;
}

export function useSharedProjectDashboard<T>(projectId?:string){
  const [data,setData]=useState<T|null>(()=>projectId?(snapshots.get(projectId)?.data as T??null):null);
  useEffect(()=>{
    if(!projectId){setData(null);return}
    let active=true;const projectListeners=listeners.get(projectId)??new Set<()=>void>();listeners.set(projectId,projectListeners);
    const sync=()=>{if(active)setData((snapshots.get(projectId)?.data as T)??null)};projectListeners.add(sync);sync();
    const cached=snapshots.get(projectId);if(cached){if(Date.now()-cached.loadedAt>=PROJECT_DASHBOARD_FRESH_MS)void loadProjectDashboard(projectId).catch(()=>{})}else void loadProjectDashboard(projectId).catch(()=>{});
    const invalidate=(event:Event)=>{const target=(event as CustomEvent<{projectId?:string}>).detail?.projectId;if(target&&target!==projectId)return;const snapshot=snapshots.get(projectId);if(snapshot)snapshots.set(projectId,{...snapshot,loadedAt:0});void loadProjectDashboard(projectId,true).catch(()=>{})};
    window.addEventListener("v2-project-data-updated",invalidate);window.addEventListener("v2-project-issues-updated",invalidate);window.addEventListener("v2-deliverables-updated",invalidate);
    return()=>{active=false;projectListeners.delete(sync);if(!projectListeners.size)listeners.delete(projectId);window.removeEventListener("v2-project-data-updated",invalidate);window.removeEventListener("v2-project-issues-updated",invalidate);window.removeEventListener("v2-deliverables-updated",invalidate)};
  },[projectId]);
  return data;
}

export function invalidateProjectDashboard(projectId:string){
  const snapshot=snapshots.get(projectId);if(snapshot)snapshots.set(projectId,{...snapshot,loadedAt:0});
}
