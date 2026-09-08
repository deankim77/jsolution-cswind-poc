"use client";

import {PanelRightClose,PanelRightOpen,type LucideIcon} from "lucide-react";
import type {ReactNode} from "react";

export type V2ViewTab<T extends string>={value:T;label:string;icon?:LucideIcon;disabled?:boolean;badge?:ReactNode};

export function V2ViewTabs<T extends string>({value,items,onChange,className=""}:{value:T;items:V2ViewTab<T>[];onChange:(value:T)=>void;className?:string}){
  return <nav className={`v2-foundation-tabs ${className}`.trim()}>{items.map(item=>{const Icon=item.icon;return <button key={item.value} type="button" className={value===item.value?"active":""} disabled={item.disabled} onClick={()=>onChange(item.value)}>{Icon&&<Icon size={18}/>}<span>{item.label}</span>{item.badge!=null&&<em>{item.badge}</em>}</button>})}</nav>;
}

export function V2PanelExpandButton({expanded,onToggle}:{expanded:boolean;onToggle:()=>void}){
  const Icon=expanded?PanelRightClose:PanelRightOpen;
  return <button type="button" className="v2-panel-expand-button" aria-label={expanded?"패널 기본 너비":"패널 넓게 보기"} title={expanded?"패널 기본 너비":"패널 넓게 보기"} onClick={onToggle}><Icon size={18}/></button>;
}
