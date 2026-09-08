"use client";

import {useEffect} from "react";

export default function SystemCostNavigationGuard(){
  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      const button=(event.target as HTMLElement|null)?.closest(".wv2-system-suite > nav button") as HTMLButtonElement|null;
      if(!button)return;
      const suite=button.closest(".wv2-system-suite") as HTMLElement|null;
      if(!suite)return;
      const isCost=Boolean(button.closest(".pcw-settings-nav-host"))||button.textContent?.includes("프로젝트 비용");
      const costButton=suite.querySelector(".pcw-settings-nav-host button") as HTMLButtonElement|null;
      if(isCost){
        suite.classList.add("pcw-settings-cost-active");
        suite.querySelectorAll(":scope > nav > button.active").forEach(node=>node.classList.remove("active"));
        costButton?.classList.add("active");
        return;
      }
      suite.classList.remove("pcw-settings-cost-active");
      costButton?.classList.remove("active");
      const sidePanel=document.querySelector(".pcw-right-panel");
      if(sidePanel&&(sidePanel.textContent||"").includes("비용 카테고리")){
        const close=sidePanel.querySelector("header > button") as HTMLButtonElement|null;
        close?.click();
      }
    };
    document.addEventListener("click",onClick);
    return()=>document.removeEventListener("click",onClick);
  },[]);
  return null;
}
