"use client";
import {useId} from "react";
import {Columns3,ChevronsUp,ChevronsDown} from "lucide-react";
import "./table-view-controls.css";

export function ColumnVisibilityMenu<K extends string>({options,visible,onChange,onReset,open,onOpenChange}:{options:ReadonlyArray<{key:K;label:string;locked?:boolean}>;visible:ReadonlySet<K>;onChange:(next:Set<K>)=>void;onReset:()=>void;open:boolean;onOpenChange:(open:boolean)=>void}){
 const id=useId();
 return <div className="wv2-toolbar-menu table-column-menu" onKeyDown={event=>{if(event.key==="Escape"){onOpenChange(false);event.stopPropagation();}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))onOpenChange(false);}}>
  <button type="button" className="table-view-action" aria-expanded={open} aria-controls={id} onClick={()=>onOpenChange(!open)}><Columns3 size={18}/>표시 열</button>
  {open&&<div id={id} className="table-column-popover" role="group" aria-label="표시할 열"><b>표시할 열</b>
   {options.map(({key,label,locked})=><label key={key}><input type="checkbox" checked={Boolean(locked)||visible.has(key)} disabled={locked} onChange={()=>{const next=new Set(visible);if(next.has(key))next.delete(key);else next.add(key);onChange(next);}}/>{label}</label>)}
   <button type="button" onClick={onReset}>기본값 복원</button>
  </div>}
 </div>;
}
export function HierarchyActions({onCollapseAll,onExpandAll,disabled=false}:{onCollapseAll:()=>void;onExpandAll:()=>void;disabled?:boolean}){
 return <><button type="button" className="table-view-action" disabled={disabled} onClick={event=>{event.stopPropagation();onCollapseAll();}}><ChevronsUp size={18}/>모두 접기</button><button type="button" className="table-view-action" disabled={disabled} onClick={event=>{event.stopPropagation();onExpandAll();}}><ChevronsDown size={18}/>모두 펼치기</button></>;
}
