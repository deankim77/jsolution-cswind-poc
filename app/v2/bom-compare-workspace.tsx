"use client";

import {useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {ChevronDown,GitCompareArrows,Sparkles,X} from "lucide-react";
import {ConnectedAiPanel,type ContextItem} from "./connected-ai-workspaces";
import {consumeBomCompareSeed} from "./bom-compare-launch";
import "./bom-compare-workspace.css";

type Revision={id:string;rootPartId:string;revisionSeq:number;revision:string;changeNote?:string;createdAt:number;createdBy?:string};
type Part={id:string;partNumber:string;name:string;revision:string};
type SnapshotPart={id:string;partNumber:string;name:string;partType?:string;spec?:string;unit?:string;revision?:string};
type SnapshotRow={id?:string;parentPartId:string;childPartId:string;quantity:number;unit?:string;sortOrder?:number};
type Snapshot={rootPartId:string;parts:SnapshotPart[];bom:SnapshotRow[]};
type DiffRow={parentPartId?:string;childPartId?:string;parent?:{partNumber?:string;name?:string};child?:{partNumber?:string;name?:string};quantity?:number;unit?:string};
type Diff={summary:{added:number;removed:number;quantityChanged:number;moved:number;total:number};added:DiffRow[];removed:DiffRow[];quantityChanged:Array<{before:DiffRow;after:DiffRow}>;moved:Array<{childPartId?:string;child?:{partNumber?:string;name?:string};fromParentPartId?:string;toParentPartId?:string;fromParent?:{partNumber?:string;name?:string};toParent?:{partNumber?:string;name?:string};quantity?:number;unit?:string}>};
type CompareResult={from:{rootPartId:string;revisionSeq:number;revision:string};to:{rootPartId:string;revisionSeq:number;revision:string};fromSnapshot:Snapshot;toSnapshot:Snapshot;diff:Diff};
type ChangeKind="added"|"removed"|"changed"|"moved"|"same";
type Side="from"|"to";

export function BomCompareWorkspace({initialLeftRootId,initialRightRootId,onClose}:{initialLeftRootId:string;initialRightRootId?:string;onClose:()=>void}){
  const [parts,setParts]=useState<Part[]>([]),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true);
  const [leftRootId,setLeftRootId]=useState(initialLeftRootId),[rightRootId,setRightRootId]=useState(initialRightRootId||initialLeftRootId);
  const [leftRevisions,setLeftRevisions]=useState<Revision[]>([]),[rightRevisions,setRightRevisions]=useState<Revision[]>([]);
  const [leftSeq,setLeftSeq]=useState(0),[rightSeq,setRightSeq]=useState(0),[result,setResult]=useState<CompareResult|null>(null),[comparing,setComparing]=useState(false),[changesOnly,setChangesOnly]=useState(false),[aiOpen,setAiOpen]=useState(false);
  const swapPending=useRef<{leftSeq:number;rightSeq:number}|null>(null);

  const partById=useMemo(()=>new Map(parts.map(part=>[part.id,part])),[parts]);
  const sameBom=leftRootId===rightRootId;
  const leftPart=partById.get(leftRootId),rightPart=partById.get(rightRootId);

  useEffect(()=>{let active=true;fetch("/api/product-data",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"BOM 목록을 불러오지 못했습니다.");if(!active)return;setParts((data.parts??[]) as Part[]);setNotice("")}).catch(reason=>active&&setNotice(reason instanceof Error?reason.message:"BOM 목록을 불러오지 못했습니다.")).finally(()=>active&&setLoading(false));return()=>{active=false}},[]);

  const loadRevisions=async(rootId:string)=>{if(!rootId)return [] as Revision[];const response=await fetch(`/api/product-data/bom-revisions?rootPartId=${encodeURIComponent(rootId)}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Revision 이력을 불러오지 못했습니다.");return (data.revisions??[]) as Revision[]};

  useEffect(()=>{let active=true;Promise.all([loadRevisions(leftRootId),loadRevisions(rightRootId)]).then(([left,right])=>{if(!active)return;setLeftRevisions(left);setRightRevisions(right);const pending=swapPending.current;if(pending){setLeftSeq(left.some(item=>item.revisionSeq===pending.leftSeq)?pending.leftSeq:left[0]?.revisionSeq||0);setRightSeq(right.some(item=>item.revisionSeq===pending.rightSeq)?pending.rightSeq:right[0]?.revisionSeq||0);swapPending.current=null}else if(leftRootId===rightRootId){const seed=consumeBomCompareSeed(leftRootId);setLeftSeq(seed?.leftRevisionSeq||left[1]?.revisionSeq||left[0]?.revisionSeq||0);setRightSeq(seed?.rightRevisionSeq||right[0]?.revisionSeq||0)}else{setLeftSeq(left[0]?.revisionSeq||0);setRightSeq(right[0]?.revisionSeq||0)}setResult(null);setNotice("")}).catch(reason=>active&&setNotice(reason instanceof Error?reason.message:"Revision 이력을 불러오지 못했습니다."));return()=>{active=false}},[leftRootId,rightRootId]);

  const comparePair=async(fromRoot:string,from:number,toRoot:string,to:number)=>{if(!fromRoot||!toRoot||!from||!to||(fromRoot===toRoot&&from===to))return;setComparing(true);try{const params=new URLSearchParams({rootPartId:fromRoot,fromRootPartId:fromRoot,toRootPartId:toRoot,from:String(from),to:String(to)});const response=await fetch(`/api/product-data/bom-revisions?${params.toString()}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"BOM을 비교하지 못했습니다.");setResult(data as CompareResult);setNotice("")}catch(reason){setNotice(reason instanceof Error?reason.message:"BOM을 비교하지 못했습니다.")}finally{setComparing(false)}};
  useEffect(()=>{if(leftSeq&&rightSeq&&!(leftRootId===rightRootId&&leftSeq===rightSeq))void comparePair(leftRootId,leftSeq,rightRootId,rightSeq)},[leftSeq,rightSeq,leftRootId,rightRootId]);

  const swapSides=()=>{
    if(comparing||!leftRootId||!rightRootId)return;
    setAiOpen(false);setResult(null);setNotice("");
    if(leftRootId===rightRootId){const previousLeft=leftSeq;setLeftSeq(rightSeq);setRightSeq(previousLeft);return}
    swapPending.current={leftSeq:rightSeq,rightSeq:leftSeq};
    const previousLeftRoot=leftRootId;
    setLeftRootId(rightRootId);setRightRootId(previousLeftRoot);
  };

  const changeMaps=useMemo(()=>{const added=new Set<string>(),removed=new Set<string>(),changed=new Set<string>(),moved=new Set<string>();const diff=result?.diff;if(diff){for(const row of diff.added)if(row.childPartId)added.add(row.childPartId);for(const row of diff.removed)if(row.childPartId)removed.add(row.childPartId);for(const row of diff.quantityChanged)changed.add(String(row.after.childPartId||row.before.childPartId||""));for(const row of diff.moved)if(row.childPartId)moved.add(row.childPartId)}return {added,removed,changed,moved}},[result]);
  const changeKind=(partId:string,side:Side):ChangeKind=>{if(changeMaps.moved.has(partId))return "moved";if(changeMaps.changed.has(partId))return "changed";if(side==="to"&&changeMaps.added.has(partId))return "added";if(side==="from"&&changeMaps.removed.has(partId))return "removed";return "same"};

  const renderTree=(snapshot:Snapshot,side:Side)=>{const treeParts=new Map(snapshot.parts.map(part=>[part.id,part]));const children=new Map<string,SnapshotRow[]>();for(const row of snapshot.bom)children.set(row.parentPartId,[...(children.get(row.parentPartId)||[]),row]);for(const rows of children.values())rows.sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));const subtreeChanged=(partId:string,seen=new Set<string>()):boolean=>{if(seen.has(partId))return false;seen.add(partId);if(changeKind(partId,side)!=="same")return true;return (children.get(partId)||[]).some(row=>subtreeChanged(row.childPartId,new Set(seen)))};const walk=(parentId:string,depth:number,seen=new Set<string>()):ReactNode[]=>{if(seen.has(parentId)||depth>16)return [];seen.add(parentId);return (children.get(parentId)||[]).flatMap(row=>{if(changesOnly&&!subtreeChanged(row.childPartId))return [];const part=treeParts.get(row.childPartId),kind=changeKind(row.childPartId,side),hasChildren=(children.get(row.childPartId)||[]).length>0;return [<article className={`bcw-tree-row ${kind}`} key={`${side}-${row.parentPartId}-${row.childPartId}`}><span className="bcw-structure" style={{paddingLeft:`${8+depth*16}px`}}>{hasChildren?<ChevronDown size={14}/>:<i/>}</span><div className="bcw-part-cell"><b>{part?.partNumber||row.childPartId}</b><em>{part?.name||"PART"}</em></div><span className="bcw-spec" title={part?.spec||"사양 없음"}>{part?.spec||"—"}</span><strong>{row.quantity} {row.unit||part?.unit||""}</strong><mark>{kind==="same"?"—":kind==="added"?"추가":kind==="removed"?"삭제":kind==="changed"?"수량":"이동"}</mark></article>,...walk(row.childPartId,depth+1,new Set(seen))]})};const root=treeParts.get(snapshot.rootPartId);return <div className="bcw-tree"><header><b>{root?.partNumber||snapshot.rootPartId}</b><span>{root?.name||"BOM"}</span><small>{root?.spec||"사양 없음"}</small></header><div className="bcw-tree-columns"><span>구조</span><span>PART / 품명</span><span>사양</span><span>수량</span><span>변경</span></div><div>{walk(snapshot.rootPartId,0)}</div></div>};

  const revisionOption=(revisions:Revision[],value:number,onChange:(value:number)=>void)=><select value={value} onChange={event=>onChange(Number(event.target.value))}>{revisions.map(item=><option key={item.id} value={item.revisionSeq}>Rev.{item.revision}</option>)}</select>;
  const leftCurrent=leftRevisions.find(item=>item.revisionSeq===leftSeq),rightCurrent=rightRevisions.find(item=>item.revisionSeq===rightSeq);
  const leftDisplay=`${leftPart?.partNumber||"기준 BOM"} / ${leftCurrent?`Rev.${leftCurrent.revision}`:"Revision 선택"}`;
  const rightDisplay=`${rightPart?.partNumber||"비교 BOM"} / ${rightCurrent?`Rev.${rightCurrent.revision}`:"Revision 선택"}`;

  const resultContext=useMemo<ContextItem[]>(()=>{if(!result)return [];const leftCode=partById.get(result.from.rootPartId)?.partNumber||result.from.rootPartId,rightCode=partById.get(result.to.rootPartId)?.partNumber||result.to.rootPartId,summary=result.diff.summary;const details=[...result.diff.added.map(row=>`추가 ${row.child?.partNumber||row.childPartId}`),...result.diff.removed.map(row=>`삭제 ${row.child?.partNumber||row.childPartId}`),...result.diff.quantityChanged.map(row=>`수량 ${row.after.child?.partNumber||row.after.childPartId} ${row.before.quantity}→${row.after.quantity}`),...result.diff.moved.map(row=>`이동 ${row.child?.partNumber||row.childPartId}`)].join(" | ");const common=[`추가 ${summary.added}`,`삭제 ${summary.removed}`,`수량 변경 ${summary.quantityChanged}`,`위치 변경 ${summary.moved}`,details?`변경 상세 ${details}`:""].filter(Boolean).join(" · ");return [{id:`${result.from.rootPartId}:${result.from.revisionSeq}`,kind:"BOM",title:`${leftCode} / Rev.${result.from.revision}`,meta:`기준 BOM · ${common}`},{id:`${result.to.rootPartId}:${result.to.revisionSeq}`,kind:"BOM",title:`${rightCode} / Rev.${result.to.revision}`,meta:`비교 BOM · ${common}`} ]},[result,partById]);
  const aiKey=result?`${result.from.rootPartId}:${result.from.revisionSeq}|${result.to.rootPartId}:${result.to.revisionSeq}`.length+result.from.revisionSeq*1000+result.to.revisionSeq:0;

  return <>
    <section className="bcw-shell">
      <header className="bcw-head"><div><small>BOM COMPARE</small><h1>BOM 비교</h1><p>{sameBom?"동일 BOM의 선택 Revision을 넓은 화면에서 비교합니다.":"선택한 두 BOM의 Revision을 기준/비교 방향으로 비교합니다."}</p></div><div className="bcw-head-actions"><button disabled={!result} onClick={()=>setAiOpen(true)}><Sparkles size={17}/>AI 대화</button><button onClick={onClose}><X size={18}/>닫기</button></div></header>
      {notice&&<p className="bcw-notice">{notice}</p>}
      <main className="bcw-main">
        <div className="bcw-targets"><section><small>기준 BOM</small><b>{leftPart?`${leftPart.partNumber} · ${leftPart.name}`:leftRootId}</b>{revisionOption(leftRevisions,leftSeq,setLeftSeq)}</section><button type="button" onClick={swapSides} disabled={comparing||!leftSeq||!rightSeq} title="기준 BOM과 비교 BOM 전환" aria-label="기준 BOM과 비교 BOM 전환" style={{width:28,height:28,border:"1px solid var(--line)",borderRadius:6,background:"#fff",color:"#71808a",display:"grid",placeItems:"center",padding:0,cursor:comparing?"wait":"pointer"}}><GitCompareArrows size={17}/></button><section><small>비교 BOM</small><b>{rightPart?`${rightPart.partNumber} · ${rightPart.name}`:rightRootId}</b>{revisionOption(rightRevisions,rightSeq,setRightSeq)}</section></div>
        {!result?<div className="bcw-empty"><GitCompareArrows size={30}/><b>{loading?"BOM 데이터를 불러오는 중…":sameBom&&leftSeq===rightSeq?"서로 다른 Revision을 선택해 주세요.":"비교할 Revision을 선택해 주세요."}</b></div>:<><div className="bcw-summary"><article className="added"><span>추가</span><b>{result.diff.summary.added}</b></article><article className="removed"><span>삭제</span><b>{result.diff.summary.removed}</b></article><article className="changed"><span>수량 변경</span><b>{result.diff.summary.quantityChanged}</b></article><article className="moved"><span>위치 변경</span><b>{result.diff.summary.moved}</b></article></div><div className="bcw-toolbar"><label><input type="checkbox" checked={changesOnly} onChange={event=>setChangesOnly(event.target.checked)}/>변경 항목만 보기</label><span>{comparing?"비교 중…":`${leftDisplay} ↔ ${rightDisplay}`}</span></div><div className="bcw-trees"><section><header><b>{leftDisplay}</b><span>기준</span></header>{renderTree(result.fromSnapshot,"from")}</section><section><header><b>{rightDisplay}</b><span>비교</span></header>{renderTree(result.toSnapshot,"to")}</section></div></>}
      </main>
    </section>
    {aiOpen&&<aside className="wv2-panel wide"><div className="wv2-resize"/><header><div><small>BOM COMPARE</small><h2>AI 대화</h2><span>{leftDisplay} ↔ {rightDisplay}</span></div><div><button onClick={()=>setAiOpen(false)} aria-label="AI 대화 닫기"><X size={19}/></button></div></header><section className="wv2-panel-body bcw-ai-panel-body"><div className="bcw-ai-context"><b>선택 정보</b><article><span>{leftDisplay}</span></article><article><span>{rightDisplay}</span></article></div><ConnectedAiPanel project={null} draftRequest={{key:aiKey,source:"BOM 비교",prompt:"",contextItems:resultContext}}/></section></aside>}
  </>;
}
