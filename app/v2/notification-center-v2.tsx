"use client";

import {Bell,Check,ChevronRight,Clock3,FileText,X} from "lucide-react";
import {useMemo,useState} from "react";
import "./notification-center-v2.css";

export type NotificationItem={id?:string;kind:"review"|"delayed"|"deliverable";taskId:string;projectId:string;projectCode:string;projectName:string;wbsCode:string;title:string;dueDate?:string;message:string;createdAt:number};
type FilterKind="all"|NotificationItem["kind"];

const label:Record<FilterKind,string>={all:"전체",review:"승인",delayed:"지연",deliverable:"산출물"};

export function NotificationCenterV2({items,onClose,onOpen}:{items:NotificationItem[];onClose:()=>void;onOpen:(item:NotificationItem)=>void}){
  const [filter,setFilter]=useState<FilterKind>("all");
  const [reading,setReading]=useState("");
  const counts=useMemo(()=>({all:items.length,review:items.filter(item=>item.kind==="review").length,delayed:items.filter(item=>item.kind==="delayed").length,deliverable:items.filter(item=>item.kind==="deliverable").length}),[items,reading]);
  const visible=filter==="all"?items:items.filter(item=>item.kind===filter);
  const confirmItem=async(item:NotificationItem)=>{
    if(reading)return;setReading(item.id||`${item.kind}:${item.taskId}`);
    try{
      if(item.id){const response=await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id})});if(!response.ok)throw new Error()}
      const index=items.indexOf(item);if(index>=0)items.splice(index,1);
      onOpen(item);
    }finally{setReading("")}
  };
  const markAllRead=async()=>{
    if(reading||!items.length)return;setReading("all");
    try{const response=await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({all:true})});if(!response.ok)throw new Error();items.splice(0,items.length);onClose()}finally{setReading("")}
  };
  return <section className="wv2-notification-center wv2-notification-center-v2" role="dialog" aria-label="업무 알림">
    <header><div><small>WORK ALERT</small><h3>확인할 업무</h3></div><button onClick={onClose}><X size={18}/></button></header>
    <nav>{(["all","review","delayed","deliverable"] as FilterKind[]).map(key=><button key={key} type="button" className={filter===key?"active":""} onClick={()=>setFilter(key)}><span>{label[key]}</span><b>{counts[key]}</b></button>)}</nav>
    <main>{visible.map(item=><button key={item.id||`${item.kind}-${item.taskId}`} disabled={Boolean(reading)} onClick={()=>void confirmItem(item)}><i className={item.kind}>{item.kind==="review"?<Check size={18}/>:item.kind==="delayed"?<Clock3 size={18}/>:<FileText size={18}/>}</i><span><small>{item.projectCode} · WBS {item.wbsCode}</small><b>{item.title}</b><em>{item.message}{item.dueDate?` · ${item.dueDate}`:""}</em></span><ChevronRight size={18}/></button>)}{!visible.length&&<div className="wv2-notification-filter-empty"><Bell size={22}/><b>{label[filter]} 알림이 없습니다.</b></div>}</main>
    <footer><span>{label[filter]} {visible.length}건</span><div>{items.length>0&&<button disabled={Boolean(reading)} onClick={()=>void markAllRead()}>모두 읽음</button>}<button onClick={onClose}>닫기</button></div></footer>
  </section>;
}
