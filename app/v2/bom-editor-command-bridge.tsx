"use client";

import {useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {ArrowDown,ArrowUp,ChevronsDownUp,ChevronsUpDown,IndentDecrease,IndentIncrease,Plus,Unlink,X} from "lucide-react";
import "./bom-editor-command-bridge.css";

type Part={id:string;partNumber:string;name:string;partType:string;spec?:string;unit:string};
type BomRow={id:string;parentPartId:string;childPartId:string;sortOrder:number};
type ProductData={parts:Part[];bom:BomRow[];bomLocks?:Array<{rootPartId:string;lockedBy:string}>;currentUserId?:string};
type FlatRow={row:BomRow;depth:number;ancestors:string[]};
type NewPartForm={name:string;spec:string;unit:string};

const emptyForm=():NewPartForm=>({name:"",spec:"",unit:"EA"});
const label=(part?:Part)=>part?`${part.partNumber} · ${part.name}`:"선택 없음";

export default function BomEditorCommandBridge(){
  const [data,setData]=useState<ProductData>({parts:[],bom:[]});
  const [rootId,setRootId]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [selectedRoot,setSelectedRoot]=useState(false);
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [busy,setBusy]=useState(false);
  const [dialog,setDialog]=useState(false);
  const [form,setForm]=useState<NewPartForm>(emptyForm());
  const [notice,setNotice]=useState("");
  const [toolbarHost,setToolbarHost]=useState<HTMLElement|null>(null);

  const partMap=useMemo(()=>new Map(data.parts.map(part=>[part.id,part])),[data.parts]);
  const childrenMap=useMemo(()=>{const map=new Map<string,BomRow[]>();for(const row of data.bom)map.set(row.parentPartId,[...(map.get(row.parentPartId)||[]),row]);for(const rows of map.values())rows.sort((a,b)=>a.sortOrder-b.sortOrder);return map},[data.bom]);
  const flat=useMemo(()=>{const result:FlatRow[]=[];const walk=(parentId:string,depth:number,ancestors:string[],seen:Set<string>)=>{if(seen.has(parentId))return;const nextSeen=new Set(seen);nextSeen.add(parentId);for(const row of childrenMap.get(parentId)||[]){result.push({row,depth,ancestors});walk(row.childPartId,depth+1,[...ancestors,row.childPartId],nextSeen)}};if(rootId)walk(rootId,0,[],new Set());return result},[rootId,childrenMap]);
  const selected=flat.find(item=>item.row.id===selectedId);
  const selectedPart=selectedRoot?partMap.get(rootId):selected?partMap.get(selected.row.childPartId):undefined;
  const editable=Boolean(rootId&&data.bomLocks?.some(lock=>lock.rootPartId===rootId&&lock.lockedBy===data.currentUserId));

  const resolveScope=()=>document.querySelector<HTMLElement>(".bom-central-editor-host")||document.querySelector<HTMLElement>(".pbw-bom-screen")?.parentElement||null;
  const reload=async()=>{try{const response=await fetch("/api/product-data",{cache:"no-store"});if(!response.ok)return;const next=await response.json() as ProductData;setData(next);const scope=resolveScope();const rootNumber=scope?.querySelector<HTMLElement>(".pbw-tree-root b")?.textContent?.trim()||"";const root=next.parts.find(part=>part.partNumber===rootNumber);if(root)setRootId(root.id)}catch{}};

  useEffect(()=>{void reload();const refresh=()=>void reload();window.addEventListener("jsolution:product-data-refresh",refresh);window.addEventListener("v2-part-updated",refresh);return()=>{window.removeEventListener("jsolution:product-data-refresh",refresh);window.removeEventListener("v2-part-updated",refresh)}},[]);
  useEffect(()=>{let timer=0;const bind=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>{const head=resolveScope()?.querySelector<HTMLElement>(".pbw-tree-head")||null;if(head){head.classList.add("pbw-command-head");setToolbarHost(head)}else setToolbarHost(null);void reload()},80)};bind();const observer=new MutationObserver(bind);observer.observe(document.body,{childList:true,subtree:true});return()=>{observer.disconnect();window.clearTimeout(timer)}},[]);

  useEffect(()=>{
    const apply=()=>{
      const scope=resolveScope();if(!scope)return;
      const root=scope.querySelector<HTMLElement>(".pbw-tree-root");root?.classList.toggle("pbw-command-selected",selectedRoot);
      const rows=[...scope.querySelectorAll<HTMLElement>(".pbw-current .pbw-tree-row")];
      rows.forEach((element,index)=>{const item=flat[index];if(!item)return;element.dataset.bomItemId=item.row.id;element.classList.toggle("pbw-command-selected",item.row.id===selectedId&&!selectedRoot);element.classList.toggle("pbw-hierarchy-hidden",item.ancestors.some(id=>collapsed.has(id)));const hasChildren=Boolean(childrenMap.get(item.row.childPartId)?.length);element.classList.toggle("pbw-has-children",hasChildren);element.classList.toggle("pbw-collapsed",hasChildren&&collapsed.has(item.row.childPartId))});
    };
    apply();const id=window.setTimeout(apply,120);return()=>window.clearTimeout(id)
  },[flat,selectedId,selectedRoot,collapsed,childrenMap]);

  useEffect(()=>{
    const handler=(event:MouseEvent)=>{const target=event.target as HTMLElement|null;if(!target||!target.closest(".bom-central-editor-host,.pbw-bom-screen"))return;const root=target.closest(".pbw-tree-root");if(root){setSelectedRoot(true);setSelectedId("");return}const row=target.closest(".pbw-current .pbw-tree-row") as HTMLElement|null;if(!row)return;const id=row.dataset.bomItemId;if(!id)return;const item=flat.find(entry=>entry.row.id===id);if(target.closest(".pbw-tree-toggle")&&item&&childrenMap.get(item.row.childPartId)?.length){event.preventDefault();event.stopPropagation();setCollapsed(current=>{const next=new Set(current);next.has(item.row.childPartId)?next.delete(item.row.childPartId):next.add(item.row.childPartId);return next});return}setSelectedRoot(false);setSelectedId(id)};
    document.addEventListener("click",handler,true);return()=>document.removeEventListener("click",handler,true)
  },[flat,childrenMap]);

  const requestStructure=async(body:Record<string,unknown>,promoteParent:boolean)=>{const response=await fetch("/api/product-data/bom-structure",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,rootPartId:rootId,promoteParent})});const result=await response.json();return {response,result}};
  const move=async(body:Record<string,unknown>)=>{if(!editable||busy)return false;setBusy(true);setNotice("");try{let {response,result}=await requestStructure(body,false);if(response.status===409&&result.error==="ROLE_PROMOTION_REQUIRED"){if(!window.confirm("이 위치를 Assembly로 변경한 뒤 이동할까요?"))return false;({response,result}=await requestStructure(body,true))}if(!response.ok)throw new Error(result.message||result.error||"BOM 구조를 변경하지 못했습니다.");await reload();window.dispatchEvent(new CustomEvent("jsolution:product-data-refresh"));return true}catch(reason){setNotice(reason instanceof Error?reason.message:"BOM 구조를 변경하지 못했습니다.");return false}finally{setBusy(false)}};

  const siblings=selected?childrenMap.get(selected.row.parentPartId)||[]:[];
  const siblingIndex=selected?siblings.findIndex(row=>row.id===selected.row.id):-1;
  const moveUp=()=>selected&&siblingIndex>0&&void move({action:"move",bomItemId:selected.row.id,newParentId:selected.row.parentPartId,targetBomItemId:siblings[siblingIndex-1].id,position:"before"});
  const moveDown=()=>selected&&siblingIndex>=0&&siblingIndex<siblings.length-1&&void move({action:"move",bomItemId:selected.row.id,newParentId:selected.row.parentPartId,targetBomItemId:siblings[siblingIndex+1].id,position:"after"});
  const indent=()=>{if(!selected||siblingIndex<=0)return;const previous=siblings[siblingIndex-1];void move({action:"move",bomItemId:selected.row.id,newParentId:previous.childPartId,targetBomItemId:"",position:"inside"})};
  const outdent=()=>{if(!selected||selected.row.parentPartId===rootId)return;const parentRow=flat.find(item=>item.row.childPartId===selected.row.parentPartId);if(parentRow)void move({action:"move",bomItemId:selected.row.id,newParentId:parentRow.row.parentPartId,targetBomItemId:parentRow.row.id,position:"after"})};
  const disconnect=()=>{if(selected&&window.confirm(`${label(selectedPart)}을 현재 BOM에서 연결 해제할까요?`))void move({action:"disconnect",bomItemId:selected.row.id})};

  const newParentId=selectedRoot?rootId:selected?.row.childPartId||"";
  const openNewPart=()=>{if(!editable){setNotice("편집 시작 후 신규 PART를 생성할 수 있습니다.");return}if(!newParentId){setNotice("신규 PART를 생성할 위치를 먼저 선택해 주세요.");return}setForm(emptyForm());setDialog(true)};
  const createPart=async()=>{if(busy||!form.name.trim()||!newParentId)return;const parent=partMap.get(newParentId);const needsPromotion=String(parent?.partType||"PART").toUpperCase()==="PART";if(needsPromotion&&!window.confirm(`${label(parent)}을 Assembly로 변경하고 신규 PART를 하위에 생성할까요?`))return;setBusy(true);setNotice("");try{const create=await fetch("/api/product-data/parts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({itemRole:"PART",categoryId:"",numberMode:"auto",partNumber:"",name:form.name.trim(),spec:form.spec.trim(),unit:form.unit.trim()||"EA"})});const created=await create.json();if(!create.ok)throw new Error(created.error||"신규 PART를 생성하지 못했습니다.");const add=await fetch("/api/product-data",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"add-bom",rootPartId:rootId,parentPartId:newParentId,childPartId:created.id,quantity:1,unit:form.unit.trim()||"EA",promoteParent:needsPromotion})});const added=await add.json();if(!add.ok)throw new Error(added.message||added.error||"신규 PART를 BOM에 연결하지 못했습니다.");setDialog(false);await reload();window.dispatchEvent(new CustomEvent("jsolution:product-data-refresh"));setNotice(`${created.partNumber} 신규 PART를 생성하고 선택 위치 하위에 추가했습니다.`)}catch(reason){setNotice(reason instanceof Error?reason.message:"신규 PART 생성에 실패했습니다.")}finally{setBusy(false)}};

  const collapseAll=()=>setCollapsed(new Set(flat.filter(item=>childrenMap.get(item.row.childPartId)?.length).map(item=>item.row.childPartId)));
  const expandAll=()=>setCollapsed(new Set());
  if(!rootId)return null;

  const toolbar=<div className="pbw-command-floating"><span className="pbw-command-selection"><b>{selectedRoot?"TOP":selected?"선택":"선택 없음"}</b><em>{label(selectedPart)}</em></span><button title="위로" disabled={!editable||!selected||siblingIndex<=0||busy} onClick={moveUp}><ArrowUp size={15}/></button><button title="아래로" disabled={!editable||!selected||siblingIndex<0||siblingIndex>=siblings.length-1||busy} onClick={moveDown}><ArrowDown size={15}/></button><button title="내어쓰기" disabled={!editable||!selected||selected.row.parentPartId===rootId||busy} onClick={outdent}><IndentDecrease size={15}/></button><button title="들여쓰기" disabled={!editable||!selected||siblingIndex<=0||busy} onClick={indent}><IndentIncrease size={15}/></button><button title="전체 접기" onClick={collapseAll}><ChevronsDownUp size={15}/></button><button title="전체 펼치기" onClick={expandAll}><ChevronsUpDown size={15}/></button><button className="new" title="신규 PART 생성" disabled={!editable||(!selected&&!selectedRoot)||busy} onClick={openNewPart}><Plus size={15}/>신규 PART</button><button className="danger" title="연결 해제" disabled={!editable||!selected||busy} onClick={disconnect}><Unlink size={15}/></button></div>;

  return <>{toolbarHost&&createPortal(toolbar,toolbarHost)}{notice&&<div className="pbw-command-notice">{notice}</div>}{dialog&&<div className="pbw-new-part-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setDialog(false)}}><section className="pbw-new-part-dialog"><header><div><small>NEW PART</small><h3>신규 PART 생성</h3><p><b>{label(partMap.get(newParentId))}</b> 하위에 새 PART를 생성합니다.</p></div><button onClick={()=>!busy&&setDialog(false)}><X size={18}/></button></header><main><label><span>품명 *</span><input autoFocus value={form.name} onChange={event=>setForm(current=>({...current,name:event.target.value}))}/></label><label><span>사양</span><input value={form.spec} onChange={event=>setForm(current=>({...current,spec:event.target.value}))}/></label><label className="short"><span>단위</span><input value={form.unit} onChange={event=>setForm(current=>({...current,unit:event.target.value}))}/></label><p>품번은 자동 생성됩니다. 생성 완료 후 기존 PART 정보 수정은 PART Master에서 수행합니다.</p></main><footer><button onClick={()=>setDialog(false)} disabled={busy}>취소</button><button className="primary" onClick={()=>void createPart()} disabled={busy||!form.name.trim()}>{busy?"생성 중…":"생성 후 BOM 추가"}</button></footer></section></div>}</>;
}
