"use client";

import { useEffect } from "react";

const PANEL_GAP=14;

function visiblePanel(){
  const panels=Array.from(document.querySelectorAll(".context-panel")) as HTMLElement[];
  return panels.find(panel=>{
    const style=window.getComputedStyle(panel);
    const rect=panel.getBoundingClientRect();
    return style.display!=="none"&&style.visibility!=="hidden"&&rect.width>0&&rect.height>0;
  })||null;
}

export default function GlobalAiPanelShift(){
  useEffect(()=>{
    let frame=0;

    const place=()=>{
      frame=0;
      const button=document.querySelector(".floating-ai") as HTMLElement|null;
      if(!button)return;

      const panel=visiblePanel();
      if(!panel){
        button.classList.remove("floating-ai-panel-open");
        button.style.removeProperty("left");
        button.style.removeProperty("right");
        return;
      }

      const panelRect=panel.getBoundingClientRect();
      const buttonWidth=button.getBoundingClientRect().width||116;
      const left=Math.max(12,Math.round(panelRect.left-buttonWidth-PANEL_GAP));
      button.classList.add("floating-ai-panel-open");
      button.style.setProperty("left",`${left}px`,"important");
      button.style.setProperty("right","auto","important");
    };

    const schedule=()=>{
      if(frame)return;
      frame=window.requestAnimationFrame(place);
    };

    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    window.addEventListener("resize",schedule);
    place();

    return()=>{
      observer.disconnect();
      window.removeEventListener("resize",schedule);
      if(frame)window.cancelAnimationFrame(frame);
      const button=document.querySelector(".floating-ai") as HTMLElement|null;
      if(button){
        button.classList.remove("floating-ai-panel-open");
        button.style.removeProperty("left");
        button.style.removeProperty("right");
      }
    };
  },[]);

  return null;
}
