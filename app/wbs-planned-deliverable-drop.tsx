"use client";

import { useEffect } from "react";

const cardFromTarget=(target:EventTarget|null)=>target instanceof Element?target.closest(".ops-card"):null;

export default function WbsPlannedDeliverableDrop(){
  useEffect(()=>{
    const clear=()=>document.querySelectorAll(".planned-deliverable-drop-active").forEach(node=>node.classList.remove("planned-deliverable-drop-active"));

    const onDragOver=(event:DragEvent)=>{
      const card=cardFromTarget(event.target);
      if(!card||!card.querySelector(".ops-upload-open"))return;
      event.preventDefault();
      event.dataTransfer!.dropEffect="copy";
      clear();
      card.classList.add("planned-deliverable-drop-active");
    };

    const onDragLeave=(event:DragEvent)=>{
      const card=cardFromTarget(event.target);
      if(!card)return;
      const related=event.relatedTarget;
      if(related instanceof Node&&card.contains(related))return;
      card.classList.remove("planned-deliverable-drop-active");
    };

    const onDrop=(event:DragEvent)=>{
      const card=cardFromTarget(event.target);
      if(!card||!card.querySelector(".ops-upload-open"))return;
      const file=event.dataTransfer?.files?.[0];
      event.preventDefault();
      clear();
      if(!file)return;

      const openButton=card.querySelector(".ops-upload-open") as HTMLButtonElement|null;
      openButton?.click();

      window.setTimeout(()=>{
        const input=card.querySelector('input[type="file"]') as HTMLInputElement|null;
        if(!input)return;
        const transfer=new DataTransfer();
        transfer.items.add(file);
        input.files=transfer.files;
        input.dispatchEvent(new Event("change",{bubbles:true}));

        window.setTimeout(()=>{
          const submit=card.querySelector(".ops-form .primary") as HTMLButtonElement|null;
          if(submit&&!submit.disabled)submit.click();
        },180);
      },60);
    };

    document.addEventListener("dragover",onDragOver,true);
    document.addEventListener("dragleave",onDragLeave,true);
    document.addEventListener("drop",onDrop,true);
    window.addEventListener("dragend",clear);
    return()=>{
      document.removeEventListener("dragover",onDragOver,true);
      document.removeEventListener("dragleave",onDragLeave,true);
      document.removeEventListener("drop",onDrop,true);
      window.removeEventListener("dragend",clear);
      clear();
    };
  },[]);

  return null;
}
