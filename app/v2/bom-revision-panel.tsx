"use client";

import {useEffect,useMemo,useState,type DragEvent,type ReactNode} from "react";
import {ChevronDown,GitCompareArrows,GripVertical,History,Sparkles,X} from "lucide-react";
import type {ContextItem} from "./connected-ai-workspaces";
import "./bom-revision-panel.css";

type Revision={id:string;revisionSeq:number;revision:string;changeNote?:string;createdAt:number;createdBy?:string};
type SnapshotPart={id:string;partNumber:string;name:string;partType?:string;spec?:string;unit?:string;revision?:string};
type SnapshotRow={id?:string;parentPartId:string;childPartId:string;quantity:number;unit?:string;sortOrder?:number};
type Snapshot={rootPartId:string;parts:SnapshotPart[];bom:SnapshotRow[]};
type DiffRow={parentPartId?:string;childPartId?:string;parent?:{partNumber?:string;name?:string};child?:{partNumber?:string;name?:string};quantity?:number;unit?:string};
type Diff={summary:{added:number;removed:number;quantityChanged:number;moved:number;total:number};added:DiffRow[];removed:DiffRow[];quantityChanged:Array<{before:DiffRow;after:DiffRow}>;moved:Array<{childPartId?:string;child?:{partNumber?:string;name?:string};fromParentPartId?:string;toParentPartId?:string;fromParent?:{partNumber?:string;name?:string};toParent?:{partNumber?:string;name?:string};quantity?:number;unit?:string}>};
type CompareResult={from:{revisionSeq:number;revision:string};to:{revisionSeq:number;revision:string};fromSnapshot:Snapshot;toSnapshot:Snapshot;diff:Diff};
type ChangeKind="added"|"removed"|"changed"|"moved"|"same";
type CompareSide="from"|"to";

const date=(value:number)=>value?new Date(value*1000).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";
const DRAG_TYPE="application/x-jsolution-bom-revision";

export function BomRevisionPanel({rootPartId,rootLabel,onClose}:{rootPartId:string;rootLabel:string;onClose:()=>void}){
  const [revisions,setRevisions]=useState<Revision[]>([]),[loading,setLoading]=useState(true),[notice,setNotice]=useState(""),[fromSeq,setFromSeq]=useState(0),[toSeq,setToSeq]=useState(0),[result,setResult]=useState<CompareResult|null>(null),[comparing,setComparing]=useState(false),[changesOnly,setChangesOnly]=useState(false),[dragOver,setDragOver]=useState<CompareSide|null>(null);
  const load=async()=>{setLoading(true);try{const response=await fetch(`/api/product-data/bom-revisions?rootPartId=${encodeURIComponent(rootPartId)}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Revision 이력을 불러오지 못했습니다.");const rows=(data.revisions??[]) as Revision[];setRevisions(rows);if(rows.length){setToSeq(rows[0].revisionSeq);setFromSeq(rows[1]?.revisionSeq||rows[0].revisionSeq)}setResult(null);setNotice("")}catch(reason){setNotice(reason instanceof Error?reason.message:"Revision 이력을 불러오지 못했습니다.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[rootPartId]);
  const bySeq=useMemo(()=>new Map(revisions.map(item=>[item.revisionSeq,item])),[revisions]);
  const comparePair=async(from:number,to:number)=>{if(!from||!to||from===to)return;setComparing(true);try{const response=await fetch(`/api/product-data/bom-revisions?rootPartId=${encodeURIComponent(rootPartId)}&from=${from}&to=${to}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Revision을 비교하지 못했습니다.");setResult(data as CompareResult);setNotice("")}catch(reason){setNotice(reason instanceof Error?reason.message:"Revision을 비교하지 못했습니다.")}finally{setComparing(false)}};
  const compare=()=>void comparePair(fromSeq,toSeq);

  const assignRevision=(side:CompareSide,seq:number)=>{
    const other=side==="from"?toSeq:fromSeq;
    if(seq===other){setNotice("비교하려면 서로 다른 Revision을 좌측과 우측에 놓아 주세요.");return}
    setNotice("");
    if(side==="from")setFromSeq(seq);else setToSeq(seq);
    if(other)void comparePair(side==="from"?seq:other,side==="to"?seq:other);
  };
  const dragRevision=(event:DragEvent<HTMLElement>,seq:number)=>{event.dataTransfer.effectAllowed="copy";event.dataTransfer.setData(DRAG_TYPE,String(seq));event.dataTransfer.setData("text/plain",String(seq))};
  const dropRevision=(event:DragEvent<HTMLElement>,side:CompareSide)=>{event.preventDefault();setDragOver(null);const raw=event.dataTransfer.getData(DRAG_TYPE)||event.dataTransfer.getData("text/plain"),seq=Number(raw);if(Number.isFinite(seq)&&bySeq.has(seq))assignRevision(side,seq)};
  const allowDrop=(event:DragEvent<HTMLElement>,side:CompareSide)=>{event.preventDefault();event.dataTransfer.dropEffect="copy";setDragOver(side)};

  const changeMaps=useMemo(()=>{
    const added=new Set<string>(),removed=new Set<string>(),changed=new Set<string>(),moved=new Set<string>();
    const diff=result?.diff;
    if(diff){for(const row of diff.added)if(row.childPartId)added.add(row.childPartId);for(const row of diff.removed)if(row.childPartId)removed.add(row.childPartId);for(const row of diff.quantityChanged)if(row.after.childPartId||row.before.childPartId)changed.add(String(row.after.childPartId||row.before.childPartId));for(const row of diff.moved)if(row.childPartId)moved.add(row.childPartId)}
    return {added,removed,changed,moved};
  },[result]);

  const changeKind=(partId:string,side:"from"|"to"):ChangeKind=>{
    if(changeMaps.moved.has(partId))return "moved";
    if(changeMaps.changed.has(partId))return "changed";
    if(side==="to"&&changeMaps.added.has(partId))return "added";
    if(side==="from"&&changeMaps.removed.has(partId))return "removed";
    return "same";
  };

  const renderTree=(snapshot:Snapshot,side:"from"|"to")=>{
    const parts=new Map(snapshot.parts.map(part=>[part.id,part]));
    const children=new Map<string,SnapshotRow[]>();
    for(const row of snapshot.bom)children.set(row.parentPartId,[...(children.get(row.parentPartId)||[]),row]);
    for(const rows of children.values())rows.sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
    const subtreeChanged=(partId:string,seen=new Set<string>()):boolean=>{
      if(seen.has(partId))return false;seen.add(partId);
      if(changeKind(partId,side)!=="same")return true;
      return (children.get(partId)||[]).some(row=>subtreeChanged(row.childPartId,new Set(seen)));
    };
    const walk=(parentId:string,depth:number,seen=new Set<string>()):ReactNode[]=>{
      if(seen.has(parentId)||depth>16)return [];seen.add(parentId);
      return (children.get(parentId)||[]).flatMap(row=>{
        if(changesOnly&&!subtreeChanged(row.childPartId))return [];
        const part=parts.get(row.childPartId),kind=changeKind(row.childPartId,side),hasChildren=(children.get(row.childPartId)||[]).length>0;
        return [<article className={`brp-tree-row ${kind}`} key={`${side}-${row.parentPartId}-${row.childPartId}`} style={{paddingLeft:`${10+depth*18}px`}}><span className="toggle">{hasChildren?<ChevronDown size={14}/>:<span/>}</span><i/><div><b>{part?.partNumber||row.childPartId}</b><span>{part?.name||"PART"}</span><small>{part?.spec||part?.partType||""}</small></div><em>{row.quantity} {row.unit||part?.unit||""}</em>{kind!=="same"&&<strong>{kind==="added"?"추가":kind==="removed"?"삭제":kind==="changed"?"수량":"이동"}</strong>}</article>,...walk(row.childPartId,depth+1,new Set(seen))];
      });
    };
    const root=parts.get(snapshot.rootPartId),rootChanged=subtreeChanged(snapshot.rootPartId);
    return <div className="brp-tree"><header><div><b>{root?.partNumber||rootPartId}</b><span>{root?.name||rootLabel}</span></div>{rootChanged&&<em>변경 포함</em>}</header><div>{walk(snapshot.rootPartId,0)}</div></div>;
  };

  const sendToAi=()=>{
    if(!result)return;
    const fromLabel=`Rev.${result.from.revision}`,toLabel=`Rev.${result.to.revision}`,s=result.diff.summary;
    const details=[
      ...result.diff.added.map(row=>`추가 ${row.child?.partNumber||row.childPartId} → ${row.parent?.partNumber||row.parentPartId}`),
      ...result.diff.removed.map(row=>`연결 해제 ${row.child?.partNumber||row.childPartId} ← ${row.parent?.partNumber||row.parentPartId}`),
      ...result.diff.quantityChanged.map(row=>`수량 변경 ${row.after.child?.partNumber||row.after.childPartId}: ${row.before.quantity}${row.before.unit||""} → ${row.after.quantity}${row.after.unit||""}`),
      ...result.diff.moved.map(row=>`위치 변경 ${row.child?.partNumber||row.childPartId}: ${row.fromParent?.partNumber||row.fromParentPartId} → ${row.toParent?.partNumber||row.toParentPartId}`),
    ];
    const context:ContextItem={id:rootPartId,kind:"BOM",title:`${rootLabel} · ${fromLabel} ↔ ${toLabel}`,meta:`BOM Revision 비교 · ${fromLabel}에서 ${toLabel} · 추가 ${s.added} · 연결 해제 ${s.removed} · 수량 변경 ${s.quantityChanged} · 위치 변경 ${s.moved}${details.length?` · 변경 상세: ${details.join(" | ")}`:" · 구조 차이 없음"}`};
    window.dispatchEvent(new CustomEvent("v2-open-part-detail",{detail:{partId:rootPartId,tab:"ai",context}}));
    onClose();
  };

  const slot=(side:CompareSide)=>{const seq=side==="from"?fromSeq:toSeq,revision=bySeq.get(seq);return <div className={`brp-drop-slot ${side} ${dragOver===side?"drag-over":""}`} onDragOver={event=>allowDrop(event,side)} onDragLeave={()=>setDragOver(current=>current===side?null:current)} onDrop={event=>dropRevision(event,side)}><small>{side==="from"?"변경 전 · 좌측 BOM":"변경 후 · 우측 BOM"}</small><b>{revision?`Rev.${revision.revision}`:"Revision을 여기에 드롭"}</b><span>{revision?.changeNote||"Revision 이력에서 끌어 놓으세요"}</span></div>};

  return <div className="brp-backdrop"><section className="brp-panel">
    <header><div><small>BOM REVISION HISTORY</small><h2>{rootLabel}</h2><p>Revision별 BOM 구조를 트리로 비교하고 변경 내용을 AI와 함께 분석합니다.</p></div><button onClick={onClose} aria-label="닫기"><X size={19}/></button></header>
    {notice&&<p className="brp-notice">{notice}</p>}
    <div className="brp-body">
      <aside><div className="brp-section-title"><History size={16}/><b>Revision 이력</b><span>{revisions.length}</span></div>{loading?<p className="brp-empty">Revision 이력을 불러오는 중…</p>:revisions.length?revisions.map(item=>{const isFrom=item.revisionSeq===fromSeq,isTo=item.revisionSeq===toSeq;return <article key={item.id} draggable onDragStart={event=>dragRevision(event,item.revisionSeq)} onClick={()=>assignRevision(isFrom?"to":"from",item.revisionSeq)} className={`${isFrom?"from":""} ${isTo?"to":""}`} title="드래그해서 좌측 또는 우측 비교 영역에 놓으세요"><GripVertical size={14}/><strong>Rev.{item.revision}</strong><div><b>{item.changeNote||"BOM 구조 저장"}</b><small>{item.createdBy||"사용자"} · {date(item.createdAt)}</small></div>{(isFrom||isTo)&&<em>{isFrom&&isTo?"좌·우":isFrom?"좌":"우"}</em>}</article>}):<p className="brp-empty">아직 저장된 BOM Revision이 없습니다.</p>}</aside>
      <main><div className="brp-compare-head"><div><GitCompareArrows size={17}/><b>Revision 비교</b></div><div className="brp-drop-slots">{slot("from")}<GitCompareArrows size={18}/>{slot("to")}<button disabled={!fromSeq||!toSeq||fromSeq===toSeq||comparing} onClick={compare}>{comparing?"비교 중":"비교"}</button></div></div>
        {!result?<div className="brp-placeholder"><GitCompareArrows size={28}/><b>Revision을 좌측과 우측에 끌어 놓아 주세요.</b><span>Revision 이력에서 원하는 버전을 드래그하면 두 BOM Tree를 바로 비교합니다.</span></div>:<><div className="brp-summary"><article className="added"><span>추가</span><b>{result.diff.summary.added}</b></article><article className="removed"><span>연결 해제</span><b>{result.diff.summary.removed}</b></article><article className="changed"><span>수량 변경</span><b>{result.diff.summary.quantityChanged}</b></article><article className="moved"><span>위치 변경</span><b>{result.diff.summary.moved}</b></article></div><div className="brp-tree-toolbar"><label><input type="checkbox" checked={changesOnly} onChange={event=>setChangesOnly(event.target.checked)}/>변경 항목만 보기</label><button onClick={sendToAi}><Sparkles size={15}/>AI에게 비교 요청</button></div><div className="brp-tree-compare"><section className={dragOver==="from"?"drag-over":""} onDragOver={event=>allowDrop(event,"from")} onDragLeave={()=>setDragOver(current=>current==="from"?null:current)} onDrop={event=>dropRevision(event,"from")}><header><b>Rev.{result.from.revision}</b><span>변경 전 BOM · Revision 드롭 가능</span></header>{renderTree(result.fromSnapshot,"from")}</section><section className={dragOver==="to"?"drag-over":""} onDragOver={event=>allowDrop(event,"to")} onDragLeave={()=>setDragOver(current=>current==="to"?null:current)} onDrop={event=>dropRevision(event,"to")}><header><b>Rev.{result.to.revision}</b><span>변경 후 BOM · Revision 드롭 가능</span></header>{renderTree(result.toSnapshot,"to")}</section></div></>}
        {revisions.length>0&&<footer>현재 비교: Rev.{bySeq.get(fromSeq)?.revision||"—"} → Rev.{bySeq.get(toSeq)?.revision||"—"}</footer>}
      </main>
    </div>
  </section></div>;
}
