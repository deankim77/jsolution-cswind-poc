"use client";
import {Fragment,useId,useRef,useEffect,useState} from "react";
import {Columns3,ChevronsUp,ChevronsDown} from "lucide-react";
import "./table-view-controls.css";

export function ColumnVisibilityMenu<K extends string>({options,visible,onChange,onReset,open,onOpenChange,disabled=false,compact=false}:{compact?:boolean;disabled?:boolean;options:ReadonlyArray<{key:K;label:string;locked?:boolean;group?:string}>;visible:ReadonlySet<K>;onChange:(next:Set<K>)=>void;onReset:()=>void;open:boolean;onOpenChange:(open:boolean)=>void}){
 const id=useId(),menuRef=useRef<HTMLDivElement>(null);
 const [availableHeight,setAvailableHeight]=useState(720);
 useEffect(()=>{if(!open||!compact)return;const measure=()=>setAvailableHeight(Math.max(120,window.innerHeight-(menuRef.current?.getBoundingClientRect().bottom??0)-16));measure();window.addEventListener("resize",measure);return()=>window.removeEventListener("resize",measure)},[open,compact]);
 useEffect(()=>{
  if(!open)return;
  const closeOutside=(event:PointerEvent)=>{if(event.target instanceof Node&&!menuRef.current?.contains(event.target))onOpenChange(false);};
  document.addEventListener("pointerdown",closeOutside);
  return()=>document.removeEventListener("pointerdown",closeOutside);
 },[open,onOpenChange]);
 return <div ref={menuRef} className="wv2-toolbar-menu table-column-menu" onKeyDown={event=>{if(event.key==="Escape"){onOpenChange(false);event.stopPropagation();}}} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))onOpenChange(false);}}>
  <button type="button" className="table-view-action" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={()=>onOpenChange(!open)}><Columns3 size={18}/>표시 열</button>
  {open&&<div id={id} className={`table-column-popover${compact?" table-column-popover-compact":""}`} style={compact?{maxHeight:availableHeight}:undefined} role="group" aria-label="표시할 열"><b>표시할 열</b>
   {options.map(({key,label,locked,group},index)=><Fragment key={key}>{group&&group!==options[index-1]?.group&&<b className="table-column-group-title">{group}</b>}<label><input type="checkbox" checked={Boolean(locked)||visible.has(key)} disabled={disabled||locked} onChange={event=>{const next=new Set(visible);if(event.currentTarget.checked)next.add(key);else next.delete(key);onChange(next);}}/><span title={label}>{label}</span></label></Fragment>)}
   <button type="button" onClick={onReset}>기본값 복원</button>
  </div>}
 </div>;
}
export function HierarchyActions({onCollapseAll,onExpandAll,disabled=false}:{onCollapseAll:()=>void;onExpandAll:()=>void;disabled?:boolean}){
 return <><button type="button" className="table-view-action" disabled={disabled} onClick={event=>{event.stopPropagation();onCollapseAll();}}><ChevronsUp size={18}/>모두 접기</button><button type="button" className="table-view-action" disabled={disabled} onClick={event=>{event.stopPropagation();onExpandAll();}}><ChevronsDown size={18}/>모두 펼치기</button></>;
}

export function ColumnValueFilter({label,values,value,onChange}:{label:string;values:readonly string[];value:string;onChange:(value:string)=>void}){
 const options=[...new Set(values.map(v=>v.trim()))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 return <select className="table-value-filter" aria-label={`${label} 필터`} value={value} onChange={event=>onChange(event.target.value)}><option value="">전체</option>{options.map(option=><option key={option} value={JSON.stringify(option)}>{option||'(빈 값)'}</option>)}</select>;
}
