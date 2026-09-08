"use client";

import {ChevronDown,Search,X} from "lucide-react";
import {useEffect,useMemo,useRef,useState} from "react";
import "./common-project-selector.css";

export type ProjectSelectorItem={id:string;code:string;name:string;customerName?:string;partnerName?:string;status?:string;pmNames?:string[]};

const statusLabel=(value?:string)=>value==="active"?"진행 중":value==="preparing"?"준비 중":value==="completed"?"완료":value==="hold"||value==="stopped"?"중단":value||"상태 미정";
const RECENT_KEY="v2-recent-projects";

export function CommonProjectSelector({projects,value,onChange,allLabel="전체 프로젝트",compact=false}:{projects:ProjectSelectorItem[];value:string;onChange:(projectId:string)=>void;allLabel?:string;compact?:boolean}){
  const root=useRef<HTMLDivElement|null>(null);
  const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[status,setStatus]=useState(""),[customer,setCustomer]=useState(""),[recent,setRecent]=useState<string[]>([]);
  useEffect(()=>{try{setRecent(JSON.parse(localStorage.getItem(RECENT_KEY)||"[]"))}catch{setRecent([])}},[]);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
  const customers=useMemo(()=>Array.from(new Set(projects.map(item=>item.partnerName||item.customerName).filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,"ko")),[projects]);
  const visible=useMemo(()=>{const key=query.trim().toLowerCase();return projects.filter(item=>(!status||item.status===status)&&(!customer||(item.partnerName||item.customerName)===customer)&&(!key||`${item.code} ${item.name} ${item.partnerName||item.customerName||""} ${(item.pmNames||[]).join(" ")}`.toLowerCase().includes(key)))},[projects,query,status,customer]);
  const selected=projects.find(item=>item.id===value);
  const choose=(id:string)=>{onChange(id);if(id){const next=[id,...recent.filter(item=>item!==id)].slice(0,5);setRecent(next);try{localStorage.setItem(RECENT_KEY,JSON.stringify(next))}catch{}}setOpen(false);setQuery("")};
  const recentItems=recent.map(id=>projects.find(item=>item.id===id)).filter((item):item is ProjectSelectorItem=>Boolean(item));
  return <div ref={root} className={`wv2-common-project-selector${compact?" compact":""}`}>
    <button type="button" className="trigger" onClick={()=>setOpen(value=>!value)}><span><small>프로젝트</small><b>{selected?selected.name:allLabel}</b></span><ChevronDown size={17}/></button>
    {open&&<div className="popover"><header><Search size={17}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="프로젝트명 · 코드 · 거래처 · PM 검색"/><button type="button" onClick={()=>setOpen(false)}><X size={16}/></button></header><div className="filters"><select value={status} onChange={event=>setStatus(event.target.value)}><option value="">전체 상태</option><option value="preparing">준비 중</option><option value="active">진행 중</option><option value="hold">중단</option><option value="completed">완료</option></select><select value={customer} onChange={event=>setCustomer(event.target.value)}><option value="">전체 거래처</option>{customers.map(item=><option key={item}>{item}</option>)}</select></div>{!query&&!status&&!customer&&recentItems.length>0&&<section><label>최근 프로젝트</label>{recentItems.map(item=><button type="button" key={item.id} onClick={()=>choose(item.id)}><span><b>{item.name}</b><small>{item.code} · {item.partnerName||item.customerName||"거래처 미지정"}</small></span><em>{statusLabel(item.status)}</em></button>)}</section>}<section><label>{query||status||customer?`검색 결과 ${visible.length}개`:`전체 프로젝트 ${visible.length}개`}</label><button type="button" onClick={()=>choose("")}><span><b>{allLabel}</b><small>프로젝트 조건 해제</small></span></button>{visible.slice(0,50).map(item=><button type="button" key={item.id} className={item.id===value?"selected":""} onClick={()=>choose(item.id)}><span><b>{item.name}</b><small>{item.code} · {item.partnerName||item.customerName||"거래처 미지정"} · {(item.pmNames||[]).join(", ")||"PM 미지정"}</small></span><em>{statusLabel(item.status)}</em></button>)}</section></div>}
  </div>;
}
