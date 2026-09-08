"use client";

import {useEffect,useState} from "react";

type Part={id:string;partNumber:string;name:string;partType:string;unit:string};
type BomRow={id:string;parentPartId:string;childPartId:string;sortOrder:number};
type ProductData={parts:Part[];bom:BomRow[];bomLocks?:Array<{rootPartId:string;lockedBy:string}>;currentUserId?:string};
type PendingDrop={kind:"add"|"move";part:Part;parent:Part;bomItemId?:string;targetBomItemId?:string;position?:"before"|"inside"|"after"};

const text=(el:Element|null)=>el?.textContent?.trim()||"";
const refreshWorkspace=()=>{document.querySelector<HTMLButtonElement>(".pbw-head-actions button")?.click();window.dispatchEvent(new CustomEvent("jsolution:product-data-refresh"))};

export function PartBomDndBridge({active}:{active:boolean}){
  const [pending,setPending]=useState<PendingDrop|null>(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(!active)return;
    let disposed=false;let cleanupFns:Array<()=>void>=[];
    const clear=()=>{cleanupFns.forEach(fn=>fn());cleanupFns=[]};
    const bind=async()=>{
      clear();
      const response=await fetch("/api/product-data",{cache:"no-store"});if(!response.ok||disposed)return;
      const data=await response.json() as ProductData,byNumber=new Map(data.parts.map(part=>[part.partNumber,part]));
      const rootNumber=text(document.querySelector(".pbw-tree-root b")),root=byNumber.get(rootNumber);if(!root)return;
      const lock=data.bomLocks?.find(item=>item.rootPartId===root.id),editable=Boolean(lock&&lock.lockedBy===data.currentUserId);
      const findPart=(element:Element)=>byNumber.get(text(element.querySelector("b")));
      const flatten=(parentId:string,seen=new Set<string>()):BomRow[]=>{if(seen.has(parentId))return[];seen.add(parentId);return data.bom.filter(row=>row.parentPartId===parentId).sort((a,b)=>a.sortOrder-b.sortOrder).flatMap(row=>[row,...flatten(row.childPartId,new Set(seen))])};
      const flatRows=flatten(root.id),centralRows=[...document.querySelectorAll<HTMLElement>(".pbw-current .pbw-tree-row")];
      const rowByElement=new Map<HTMLElement,BomRow>();centralRows.forEach((element,index)=>{if(flatRows[index])rowByElement.set(element,flatRows[index])});

      const externalSources=[...document.querySelectorAll<HTMLElement>(".pbw-reuse-list>button,.pbw-reference .pbw-tree-row,.pbw-reference-root")];
      for(const element of externalSources){const part=findPart(element);if(!part||part.id===root.id)continue;element.draggable=editable;element.classList.toggle("pbw-dnd-source",editable);const onStart=(event:DragEvent)=>{if(!editable)return;event.dataTransfer?.setData("application/x-jsolution-part",part.id);if(event.dataTransfer)event.dataTransfer.effectAllowed="copy";element.classList.add("dragging")};const onEnd=()=>element.classList.remove("dragging");element.addEventListener("dragstart",onStart);element.addEventListener("dragend",onEnd);cleanupFns.push(()=>{element.removeEventListener("dragstart",onStart);element.removeEventListener("dragend",onEnd);element.draggable=false;element.classList.remove("pbw-dnd-source","dragging")})}

      for(const element of centralRows){const row=rowByElement.get(element),part=row?data.parts.find(item=>item.id===row.childPartId):undefined;if(!row||!part)continue;element.draggable=editable;element.classList.toggle("pbw-dnd-move-source",editable);const onStart=(event:DragEvent)=>{if(!editable)return;event.dataTransfer?.setData("application/x-jsolution-bom-item",row.id);event.dataTransfer?.setData("application/x-jsolution-part",part.id);if(event.dataTransfer)event.dataTransfer.effectAllowed="move";element.classList.add("dragging")};const onEnd=()=>element.classList.remove("dragging");element.addEventListener("dragstart",onStart);element.addEventListener("dragend",onEnd);
        let disconnect=element.querySelector<HTMLButtonElement>(".pbw-disconnect-action");if(!disconnect&&editable){disconnect=document.createElement("button");disconnect.type="button";disconnect.className="pbw-disconnect-action";disconnect.title="BOM에서 연결 해제";disconnect.setAttribute("aria-label",`${part.partNumber} 연결 해제`);disconnect.textContent="×";element.appendChild(disconnect)}
        if(disconnect)disconnect.style.display=editable?"grid":"none";
        const onDisconnect=async(event:Event)=>{event.stopPropagation();event.preventDefault();if(!editable||busy)return;if(!window.confirm(`${part.partNumber} · ${part.name}을 현재 BOM에서 연결 해제할까요?\nPART Master 자체는 삭제되지 않습니다.`))return;setBusy(true);try{await structureAction({action:"disconnect",rootPartId:root.id,bomItemId:row.id});refreshWorkspace()}catch(reason){alert(reason instanceof Error?reason.message:"연결을 해제하지 못했습니다.")}finally{setBusy(false)}};disconnect?.addEventListener("click",onDisconnect);
        cleanupFns.push(()=>{element.removeEventListener("dragstart",onStart);element.removeEventListener("dragend",onEnd);disconnect?.removeEventListener("click",onDisconnect);element.draggable=false;element.classList.remove("pbw-dnd-move-source","dragging")})}

      const targets=[document.querySelector<HTMLElement>(".pbw-current .pbw-tree-root"),...centralRows].filter(Boolean) as HTMLElement[];
      for(const element of targets){const targetRow=rowByElement.get(element),parent=element.classList.contains("pbw-tree-root")?root:findPart(element);if(!parent)continue;
        const zone=(event:DragEvent):"before"|"inside"|"after"=>{if(!targetRow)return"inside";const rect=element.getBoundingClientRect(),ratio=(event.clientY-rect.top)/Math.max(1,rect.height);return ratio<.28?"before":ratio>.72?"after":"inside"};
        const paint=(position:string)=>{element.classList.remove("pbw-drop-before","pbw-drop-target","pbw-drop-after");element.classList.add(position==="before"?"pbw-drop-before":position==="after"?"pbw-drop-after":"pbw-drop-target")};
        const onOver=(event:DragEvent)=>{if(!editable)return;event.preventDefault();const moving=Boolean(event.dataTransfer?.types.includes("application/x-jsolution-bom-item"));if(event.dataTransfer)event.dataTransfer.dropEffect=moving?"move":"copy";paint(moving?zone(event):"inside")};
        const onLeave=()=>element.classList.remove("pbw-drop-before","pbw-drop-target","pbw-drop-after");
        const onDrop=async(event:DragEvent)=>{event.preventDefault();onLeave();if(!editable||busy)return;const bomItemId=event.dataTransfer?.getData("application/x-jsolution-bom-item"),partId=event.dataTransfer?.getData("application/x-jsolution-part"),part=data.parts.find(item=>item.id===partId);if(!part)return;setBusy(true);try{
          if(bomItemId){const position=zone(event),newParentId=position==="inside"?parent.id:(targetRow?.parentPartId||root.id);if(targetRow?.id===bomItemId&&position!=="inside")return;const result=await movePart(root.id,bomItemId,newParentId,targetRow?.id||"",position,false);if(result==="PROMOTE"){const promoteParent=data.parts.find(item=>item.id===newParentId);if(promoteParent)setPending({kind:"move",part,parent:promoteParent,bomItemId,targetBomItemId:targetRow?.id,position})}else refreshWorkspace();return}
          if(part.id===parent.id)return;const result=await addPart(root.id,parent.id,part,false);if(result==="PROMOTE")setPending({kind:"add",part,parent});else refreshWorkspace();
        }catch(reason){alert(reason instanceof Error?reason.message:"BOM 구조를 변경하지 못했습니다.")}finally{setBusy(false)}};
        element.addEventListener("dragover",onOver);element.addEventListener("dragleave",onLeave);element.addEventListener("drop",onDrop);cleanupFns.push(()=>{element.removeEventListener("dragover",onOver);element.removeEventListener("dragleave",onLeave);element.removeEventListener("drop",onDrop);onLeave()})}
    };
    const observer=new MutationObserver(()=>{window.clearTimeout((observer as any)._timer);(observer as any)._timer=window.setTimeout(()=>void bind(),90)});observer.observe(document.body,{childList:true,subtree:true});const refresh=()=>void bind();window.addEventListener("jsolution:product-data-refresh",refresh);void bind();return()=>{disposed=true;observer.disconnect();window.removeEventListener("jsolution:product-data-refresh",refresh);clear()};
  },[active,busy]);

  const confirmPromotion=async()=>{if(!pending||busy)return;setBusy(true);try{const response=await fetch("/api/product-data",{cache:"no-store"});const data=await response.json() as ProductData;const rootNumber=text(document.querySelector(".pbw-tree-root b")),root=data.parts.find(item=>item.partNumber===rootNumber);if(!root)return;if(pending.kind==="add")await addPart(root.id,pending.parent.id,pending.part,true);else await movePart(root.id,pending.bomItemId||"",pending.parent.id,pending.targetBomItemId||"",pending.position||"inside",true);setPending(null);refreshWorkspace()}catch(reason){alert(reason instanceof Error?reason.message:"BOM 구조를 변경하지 못했습니다.")}finally{setBusy(false)}};

  if(!pending)return null;
  return <div className="pbw-dnd-dialog-backdrop"><div className="pbw-dnd-dialog"><header><small>BOM STRUCTURE</small><h3>Assembly 역할로 변경</h3></header><main><b>{pending.parent.partNumber} · {pending.parent.name}</b><p>현재 Part 역할입니다. 이 위치 아래에 {pending.part.partNumber}을 배치하려면 Assembly 역할로 변경해야 합니다.</p></main><footer><button onClick={()=>setPending(null)} disabled={busy}>취소</button><button className="primary" onClick={()=>void confirmPromotion()} disabled={busy}>{busy?"처리 중…":"변경 후 적용"}</button></footer></div></div>;
}

async function addPart(rootPartId:string,parentPartId:string,part:Part,promoteParent:boolean):Promise<"OK"|"PROMOTE">{const response=await fetch("/api/product-data",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"add-bom",rootPartId,parentPartId,childPartId:part.id,quantity:1,unit:part.unit,promoteParent})});const result=await response.json();if(response.ok)return"OK";if(response.status===409&&result.error==="ROLE_PROMOTION_REQUIRED"&&!promoteParent)return"PROMOTE";throw new Error(result.message||result.error||"BOM에 PART를 추가하지 못했습니다.")}
async function movePart(rootPartId:string,bomItemId:string,newParentId:string,targetBomItemId:string,position:"before"|"inside"|"after",promoteParent:boolean):Promise<"OK"|"PROMOTE">{const response=await fetch("/api/product-data/bom-structure",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"move",rootPartId,bomItemId,newParentId,targetBomItemId,position,promoteParent})});const result=await response.json();if(response.ok)return"OK";if(response.status===409&&result.error==="ROLE_PROMOTION_REQUIRED"&&!promoteParent)return"PROMOTE";throw new Error(result.message||result.error||"BOM 항목을 이동하지 못했습니다.")}
async function structureAction(body:Record<string,unknown>){const response=await fetch("/api/product-data/bom-structure",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.message||result.error||"BOM 구조를 변경하지 못했습니다.");return result}
