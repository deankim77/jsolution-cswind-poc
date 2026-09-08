"use client";

import {useEffect,useId,useRef,useState,type ReactNode} from "react";
import {Check,RotateCcw,X} from "lucide-react";
import "./workspace-filter-multi.css";

export type FilterOption={value:string;label:string;meta?:string;disabled?:boolean};
export type WorkspaceFilterConfig={
  eyebrow:string;
  title:string;
  description:string;
  resultCount:number;
  resultLoading?:boolean;
  activeCount:number;
  onCancel:()=>void;
  onApply:()=>void;
  onReset:()=>void;
  content:ReactNode;
};

export function FilterSection({title,description,children}:{title:string;description?:string;children:ReactNode}){
  return <fieldset className="wv2-filter-section"><legend>{title}</legend>{description&&<p>{description}</p>}{children}</fieldset>;
}

export function FilterChipGroup({options,selected,onToggle}:{options:FilterOption[];selected:string[];onToggle:(value:string)=>void}){
  return <div className="chips">{options.map(option=><button type="button" key={option.value} className={selected.includes(option.value)?"selected":""} disabled={option.disabled} onClick={()=>onToggle(option.value)}>{selected.includes(option.value)&&<Check size={18}/>}<span>{option.label}</span>{option.meta&&<small>{option.meta}</small>}</button>)}</div>;
}

export function FilterSelect({label,value,options,allLabel="전체",onChange}:{label:string;value:string;options:FilterOption[];allLabel?:string;onChange:(value:string)=>void}){
  return <label className="wv2-filter-field"><span>{label}</span><select value={value} onChange={event=>onChange(event.target.value)}><option value="">{allLabel}</option>{options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}{option.meta?` · ${option.meta}`:""}</option>)}</select></label>;
}

function ImeSafeInput({value,placeholder,list,onChange,onCommit}:{value:string;placeholder:string;list?:string;onChange:(value:string)=>void;onCommit?:(value:string)=>void}){
  const composing=useRef(false);
  const [input,setInput]=useState(value);
  useEffect(()=>{if(!composing.current)setInput(value)},[value]);
  return <input list={list} value={input} placeholder={placeholder} onKeyDown={event=>{if(event.key==="Enter"&&!composing.current){event.preventDefault();onCommit?.(event.currentTarget.value)}}} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={event=>{composing.current=false;const next=event.currentTarget.value;setInput(next);onChange(next)}} onChange={event=>{const next=event.target.value;setInput(next);if(!composing.current)onChange(next)}}/>;
}

export function FilterText({label,value,placeholder,onChange}:{label:string;value:string;placeholder:string;onChange:(value:string)=>void}){
  return <label className="wv2-filter-field"><span>{label}</span><ImeSafeInput value={value} placeholder={placeholder} onChange={onChange}/></label>;
}

export function FilterSuggest({label,value,placeholder,options,onChange}:{label:string;value:string;placeholder:string;options:FilterOption[];onChange:(value:string)=>void}){
  const listId=useId();
  return <label className="wv2-filter-field"><span>{label}</span><ImeSafeInput list={listId} value={value} placeholder={placeholder} onChange={onChange}/><datalist id={listId}>{options.map(option=><option key={option.value} value={option.label}>{option.meta||""}</option>)}</datalist></label>;
}

export function FilterMultiSuggest({label,selected,placeholder,options,onChange}:{label:string;selected:string[];placeholder:string;options:FilterOption[];onChange:(values:string[])=>void}){
  const listId=useId();
  const [query,setQuery]=useState("");
  const selectedSet=new Set(selected);
  const commit=(raw:string)=>{const text=raw.trim();if(!text)return;const match=options.find(option=>!selectedSet.has(option.value)&&(option.label===text||option.value===text));if(!match)return;onChange([...selected,match.value]);setQuery("")};
  return <div className="wv2-filter-field wv2-filter-multi-suggest"><span>{label}</span>{selected.length>0&&<div className="wv2-filter-selected-values">{selected.map(value=>{const option=options.find(item=>item.value===value);return <button type="button" key={value} onClick={()=>onChange(selected.filter(item=>item!==value))}><span>{option?.label||value}</span><X size={14}/></button>})}</div>}<ImeSafeInput list={listId} value={query} placeholder={placeholder} onChange={setQuery} onCommit={commit}/><datalist id={listId}>{options.filter(option=>!selectedSet.has(option.value)).map(option=><option key={option.value} value={option.label}>{option.meta||""}</option>)}</datalist>{query&&<div className="wv2-filter-suggest-results">{options.filter(option=>!selectedSet.has(option.value)&&`${option.label} ${option.meta||""}`.toLowerCase().includes(query.toLowerCase())).slice(0,8).map(option=><button type="button" key={option.value} onClick={()=>{onChange([...selected,option.value]);setQuery("")}}><b>{option.label}</b>{option.meta&&<small>{option.meta}</small>}</button>)}</div>}</div>;
}

export function FilterDateRange({label,from,to,onFrom,onTo}:{label:string;from:string;to:string;onFrom:(value:string)=>void;onTo:(value:string)=>void}){
  return <FilterSection title={label}><div className="two"><label className="wv2-filter-field"><span>시작</span><input type="date" value={from} onChange={event=>onFrom(event.target.value)}/></label><label className="wv2-filter-field"><span>종료</span><input type="date" value={to} onChange={event=>onTo(event.target.value)}/></label></div></FilterSection>;
}

export function WorkspaceFilterContent({config}:{config:WorkspaceFilterConfig}){
  return <section className="wv2-workspace-filter"><div className="wv2-filter-active-summary"><span>선택 조건</span><b>{config.activeCount}개</b><small>{config.resultLoading?"적용 전 결과 집계 중…":`적용 전 결과 ${config.resultCount}건`}</small></div><main>{config.content}</main><footer><button type="button" onClick={config.onReset}><RotateCcw size={18}/>초기화</button><button type="button" className="primary" disabled={config.resultLoading} onClick={config.onApply}>{config.resultLoading?"결과 집계 중…":`필터 적용 · ${config.resultCount}건`}</button></footer></section>;
}
