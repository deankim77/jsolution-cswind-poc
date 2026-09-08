"use client";

type Snapshot<T>={data:T;loadedAt:number};

const snapshots=new Map<string,Snapshot<unknown>>();
export const ISSUE_SNAPSHOT_FRESH_MS=20_000;

export function getIssueSnapshot<T>(key:string){
  return snapshots.get(key) as Snapshot<T>|undefined;
}

export function setIssueSnapshot<T>(key:string,data:T){
  snapshots.set(key,{data,loadedAt:Date.now()});
}

export function isIssueSnapshotFresh(snapshot:{loadedAt:number}){
  return Date.now()-snapshot.loadedAt<ISSUE_SNAPSHOT_FRESH_MS;
}

export function invalidateIssueSnapshots(){
  snapshots.clear();
}
