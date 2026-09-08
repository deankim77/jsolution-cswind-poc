"use client";

import { AlertTriangle,FileText,GanttChartSquare,Search,X } from "lucide-react";

export type SharedAiContextItem={id:string;kind:string;title:string;meta?:string};

export default function AiContextSelectionBlock({items,onRemove,onClear}:{items:SharedAiContextItem[];onRemove:(item:SharedAiContextItem)=>void;onClear:()=>void}){
  if(!items.length)return null;
  return <section className="ai-context-selection-block">
    <header><div><strong>선택 문맥 {items.length}건</strong><small>선택한 업무 데이터를 함께 분석합니다.</small></div><button type="button" onClick={onClear}>전체 해제</button></header>
    <div className="ai-context-selection-list">{items.map(item=><article key={`${item.kind}-${item.id}`}>
      <i>{item.kind==="문서"||item.kind==="산출물"?<FileText size={14}/>:item.kind==="이슈"||item.kind==="리스크"||item.kind==="협업"?<AlertTriangle size={14}/>:item.kind==="WBS"?<GanttChartSquare size={14}/>:<Search size={14}/>}</i>
      <span><b>{item.kind}</b><strong>{item.title}</strong>{item.meta&&<small>{item.meta}</small>}</span>
      <button type="button" onClick={()=>onRemove(item)} aria-label={`${item.title} 선택 해제`}><X size={13}/></button>
    </article>)}</div>
  </section>;
}
