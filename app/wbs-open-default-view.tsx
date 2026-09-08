"use client";

import { useEffect } from "react";

export default function WbsOpenDefaultView(){
  useEffect(()=>{
    const handler=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      const button=target?.closest("button") as HTMLButtonElement|null;
      if(!button)return;
      const label=button.textContent?.replace(/\s+/g," ").trim()||"";
      if(label.includes("WBS 열기")){
        sessionStorage.setItem("js-wbs-view","actual");
      }
    };
    document.addEventListener("click",handler,true);
    return()=>document.removeEventListener("click",handler,true);
  },[]);
  return null;
}
