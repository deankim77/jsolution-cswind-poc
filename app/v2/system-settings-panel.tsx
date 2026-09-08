"use client";

import type {FormEvent,ReactNode} from "react";
import {X} from "lucide-react";
import "./system-settings-panel.css";

export function SystemSettingsPanel({kicker="SYSTEM MASTER DATA",title,description,children,onClose,onSubmit,submitLabel="저장",saving=false}:{kicker?:string;title:string;description?:string;children:ReactNode;onClose:()=>void;onSubmit?:(event:FormEvent<HTMLFormElement>)=>void;submitLabel?:string;saving?:boolean}){
  const content=<><header><div><small>{kicker}</small><h2>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" aria-label="닫기" onClick={onClose}><X size={18}/></button></header><div className="ssp-body">{children}</div>{onSubmit&&<footer><button type="button" onClick={onClose}>취소</button><button className="primary" disabled={saving}>{saving?"저장 중…":submitLabel}</button></footer>}</>;
  return onSubmit?<form className="ssp-panel" onSubmit={onSubmit}>{content}</form>:<aside className="ssp-panel">{content}</aside>;
}
