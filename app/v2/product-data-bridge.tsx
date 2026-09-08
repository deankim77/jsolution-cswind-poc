"use client";

import {useEffect,useState} from "react";
import {ConnectedAiPanel} from "./connected-ai-workspaces";

const replaceAiTerminology=(value:string)=>value
  .replaceAll("AI 대화 문맥","AI 참고자료")
  .replaceAll("문맥 추가","AI 자료 추가")
  .replaceAll("연결된 문맥이 없습니다.","추가된 AI 자료가 없습니다.")
  .replaceAll("분석할 문맥을 선택해 주세요","분석할 자료를 추가해 주세요")
  .replaceAll("선택한 여러 업무 문맥을 기준으로 질문하세요","선택한 자료를 기준으로 질문하세요")
  .replaceAll("선택한 업무·문서·BOM을 하나의 AI 대화 문맥으로 연결","선택한 업무·문서·BOM을 AI 자료로 연결")
  .replaceAll("여러 업무 공간의 문맥을 함께 분석합니다.","선택한 업무 정보를 함께 분석합니다.")
  .replaceAll("선택 문맥","선택 정보")
  .replace(/(\d+)개 문맥으로 무엇을 도와드릴까요\?/g,"선택한 자료로 무엇을 도와드릴까요?")
  .replace(/(\d+)개 문맥/g,"자료 $1건")
  .replace(/(\d+)개 업무 자료를 AI 문맥에 추가했습니다\./g,"AI 자료 $1건을 추가했습니다.");

export function ProductDataBridge(){
  const [globalAiOpen,setGlobalAiOpen]=useState(false);

  useEffect(()=>{
    const handler=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      if(!target?.closest(".wv2-ai-button"))return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setGlobalAiOpen(true);
    };
    document.addEventListener("click",handler,true);
    return()=>document.removeEventListener("click",handler,true);
  },[]);

  useEffect(()=>{
    const apply=()=>{
      const roots=document.querySelectorAll<HTMLElement>(".wv2-ai,.wv2-neutral-ai-panel,.wv2-part-detail-panel,.wv2-ai-selection-bar");
      roots.forEach(root=>{
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        let node=walker.nextNode();
        while(node){const next=walker.nextNode(),text=node.nodeValue||"",replaced=replaceAiTerminology(text);if(replaced!==text)node.nodeValue=replaced;node=next}
        root.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>("input[placeholder],textarea[placeholder]").forEach(input=>{const value=input.placeholder,replaced=replaceAiTerminology(value);if(replaced!==value)input.placeholder=replaced});
      });
    };
    apply();
    let timer=0;
    const observer=new MutationObserver(()=>{window.clearTimeout(timer);timer=window.setTimeout(apply,20)});
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>{window.clearTimeout(timer);observer.disconnect()};
  },[]);

  return globalAiOpen?<aside className="wv2-panel wide"><div className="wv2-resize"/><header><div><small>COMMON AI · GLOBAL</small><h2>AI 대화</h2><span>특정 프로젝트나 WBS에 고정되지 않은 공통 AI 시작점입니다.</span></div><div><button onClick={()=>setGlobalAiOpen(false)} aria-label="AI 대화 닫기">×</button></div></header><section className="wv2-panel-body"><ConnectedAiPanel project={null}/></section></aside>:null;
}
