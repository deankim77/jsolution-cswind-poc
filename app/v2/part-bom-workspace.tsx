"use client";

import {useEffect,useMemo,useState} from "react";
import {Box,Check,ChevronDown,ChevronRight,Copy,FileSearch,GitCompareArrows,Layers3,LockKeyhole,PanelRightOpen,Plus,RefreshCw,Search,TableProperties,Trash2,X} from "lucide-react";
import {useAiContextSelection} from "./ai-context-selection";
import {PartBomDndBridge} from "./part-bom-dnd-bridge";
import {PartDetailPanelHost} from "./part-detail-panel";
import "./part-bom-workspace.css";
import "./part-bom-part-create-settings.css";
import "./part-bom-editing.css";
import "./part-bom-compact.css";
import "./part-bom-dnd.css";
import "./part-bom-ai-selection.css";

type Part={id:string;partNumber:string;name:string;partType:string;spec?:string;unit:string;revision:string;status:string;standardCost:number;rollupCost:number};
type BomRow={id:string;parentPartId:string;parentNumber:string;parentName:string;childPartId:string;childNumber:string;childName:string;quantity:number;unit:string;sortOrder:number;note?:string};
type BomLock={rootPartId:string;lockedBy:string;lockedByName?:string;lockedAt:number};
type Data={parts:Part[];bom:BomRow[];bomLocks:BomLock[];currentUserId?:string;numberRule?:string};
type View="part"|"bom";
type ItemRole="TOP_ITEM"|"ASSEMBLY"|"PART";
type PartCategory={id:string;code:string;name:string;isActive:number;sortOrder:number};
type PartNumberSetting={prefix:string;separator:string;digits:number;nextSequence:number;allowManual:number};
type PartForm={itemRole:ItemRole;categoryId:string;numberMode:"auto"|"manual";partNumber:string;name:string;spec:string;unit:string};
type BomCopiedResult={id:string;partNumber:string;name:string};
type DeleteCheck={canDelete?:boolean;reason?:string};

const ITEM_ROLES=[
  {value:"TOP_ITEM",label:"Top Item",hint:"독립 개발 · 관리 대상"},
  {value:"ASSEMBLY",label:"Assembly",hint:"하위 구조를 가질 수 있는 품목"},
  {value:"PART",label:"Part",hint:"기본 단품 · 구성품"},
] as const;
const normalizedRole=(value:string):ItemRole=>value==="TOP_ITEM"||value==="PRODUCT"?"TOP_ITEM":value==="ASSEMBLY"||value==="SUB_ASSEMBLY"?"ASSEMBLY":"PART";
const roleMeta=(value:string)=>ITEM_ROLES.find(item=>item.value===normalizedRole(value))||ITEM_ROLES[2];
const lockTime=(value:number)=>value?new Date(value*1000).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}):"";
const emptyPartForm=():PartForm=>({itemRole:"PART",categoryId:"",numberMode:"auto",partNumber:"",name:"",spec:"",unit:"EA"});

export function PartBomWorkspace({onOpenBomCompare,initialRootId,onBomCopied}:{onOpenBomCompare?:(leftRootId:string,rightRootId?:string)=>void;initialRootId?:string;onBomCopied?:(result:BomCopiedResult)=>void}){
  const selection=useAiContextSelection("PART · BOM");
  const [data,setData]=useState<Data>({parts:[],bom:[],bomLocks:[]}),[loading,setLoading]=useState(true),[notice,setNotice]=useState(""),[lockBusy,setLockBusy]=useState(false);
  const [view,setView]=useState<View>(initialRootId?"bom":"part"),[query,setQuery]=useState(""),[currentId,setCurrentId]=useState(initialRootId||""),[referenceId,setReferenceId]=useState(""),[referenceOpen,setReferenceOpen]=useState(false);
  const [partCreateOpen,setPartCreateOpen]=useState(false),[partSaving,setPartSaving]=useState(false),[partForm,setPartForm]=useState<PartForm>(emptyPartForm());
  const [partCategories,setPartCategories]=useState<PartCategory[]>([]),[partNumberSetting,setPartNumberSetting]=useState<PartNumberSetting|null>(null);
  const [bomAddingId,setBomAddingId]=useState(""),[quantityBusyId,setQuantityBusyId]=useState(""),[promotionPart,setPromotionPart]=useState<Part|null>(null),[copyBusy,setCopyBusy]=useState(false),[copyConfirmOpen,setCopyConfirmOpen]=useState(false),[deleteBusy,setDeleteBusy]=useState(false);
  const load=async()=>{setLoading(true);try{const response=await fetch("/api/product-data",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"PART/BOM 데이터를 불러오지 못했습니다.");setData({...result,bomLocks:result.bomLocks??[]});setNotice("")}catch(reason){setNotice(reason instanceof Error?reason.message:"PART/BOM 데이터를 불러오지 못했습니다.")}finally{setLoading(false)}};
  const loadPartSettings=async()=>{try{const response=await fetch("/api/product-data/parts",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"PART 기준정보를 불러오지 못했습니다.");setPartCategories(result.categories??[]);setPartNumberSetting(result.numberSetting??null)}catch(reason){setNotice(reason instanceof Error?reason.message:"PART 기준정보를 불러오지 못했습니다.")}};
  useEffect(()=>{void load();void loadPartSettings()},[]);
  useEffect(()=>{if(initialRootId){setCurrentId(initialRootId);setView("bom")}},[initialRootId]);

  const visibleParts=useMemo(()=>{const key=query.trim().toLowerCase().replace(/\s+/g,"");return data.parts.filter(item=>!key||`${item.partNumber}${item.name}${item.spec||""}${item.partType}${roleMeta(item.partType).label}`.toLowerCase().replace(/\s+/g,"").includes(key))},[data.parts,query]);
  const hasChildren=(partId:string)=>data.bom.some(row=>row.parentPartId===partId);
  const contextFor=(part:Part)=>({id:part.id,kind:hasChildren(part.id)?"BOM":"PART",title:`${part.partNumber} · ${part.name}`,meta:[part.spec?`사양 ${part.spec}`:"",`Rev.${part.revision}`].filter(Boolean).join(" · ")});
  const allVisibleSelected=Boolean(visibleParts.length)&&visibleParts.every(part=>selection.has(contextFor(part)));
  const selectedBomIds=selection.selected.filter(item=>item.kind==="BOM"&&hasChildren(item.id)).map(item=>item.id);
  const bomCandidates=useMemo(()=>data.parts,[data.parts]);
  const activeId=currentId||bomCandidates[0]?.id||"";
  const activePart=data.parts.find(part=>part.id===activeId);
  const activeLock=data.bomLocks.find(lock=>lock.rootPartId===activeId);
  const isMyLock=Boolean(activeLock&&activeLock.lockedBy===data.currentUserId);
  const lockedByOther=Boolean(activeLock&&!isMyLock);
  const referenceCandidates=data.parts.filter(part=>part.id!==activeId&&hasChildren(part.id));
  const activeReferenceId=referenceId||referenceCandidates[0]?.id||"";
  const referencePart=data.parts.find(part=>part.id===activeReferenceId);
  const autoNumberPreview=partNumberSetting?`${partNumberSetting.prefix}${partNumberSetting.separator}${String(partNumberSetting.nextSequence).padStart(partNumberSetting.digits,"0")}`:"P-000001";
  const allowManual=Number(partNumberSetting?.allowManual??1)===1;

  const openBom=(part:Part)=>{setCurrentId(part.id);setView("bom");setNotice("")};
  useEffect(()=>{
    const openRequested=(event:Event)=>{const partId=(event as CustomEvent<{partId?:string}>).detail?.partId;if(!partId)return;const part=data.parts.find(item=>item.id===partId);if(part)openBom(part)};
    const updated=()=>void load();
    window.addEventListener("v2-open-part-bom",openRequested);
    window.addEventListener("v2-part-updated",updated);
    return()=>{window.removeEventListener("v2-open-part-bom",openRequested);window.removeEventListener("v2-part-updated",updated)};
  },[data.parts]);

  const post=async(path:string,body:Record<string,unknown>)=>{const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error||"요청을 처리하지 못했습니다.");return result};
  const changeLock=async(action:"checkout-bom"|"checkin-bom")=>{
    if(!activeId||lockBusy)return;
    setLockBusy(true);setNotice("");
    try{
      if(action==="checkout-bom"){
        await post("/api/product-data",{action,rootPartId:activeId});
        await post("/api/product-data/bom-revisions",{action:"ensure-baseline",rootPartId:activeId});
        await load();setNotice("BOM 편집을 시작했습니다. 다른 사용자는 현재 BOM을 조회만 할 수 있습니다.");
      }else{
        const revision=await post("/api/product-data/bom-revisions",{action:"checkin-revision",rootPartId:activeId});
        await post("/api/product-data",{action,rootPartId:activeId});
        await load();setNotice(revision.changed?`BOM 변경을 Rev.${revision.revision}으로 Check-in했습니다.`:`구조 변경이 없어 Rev.${revision.revision}을 유지하고 Check-in했습니다.`);
      }
    }catch(reason){setNotice(reason instanceof Error?reason.message:"BOM 편집 상태를 변경하지 못했습니다.")}finally{setLockBusy(false)}
  };

  const submitExistingPart=async(part:Part,promoteParent=false)=>{
    const response=await fetch("/api/product-data",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"add-bom",rootPartId:activeId,parentPartId:activeId,childPartId:part.id,quantity:1,unit:part.unit,promoteParent})});
    const result=await response.json();
    if(response.ok)return result;
    if(response.status===409&&result.error==="ROLE_PROMOTION_REQUIRED"&&!promoteParent){setPromotionPart(part);return null}
    throw new Error(result.message||result.error||"BOM에 PART를 추가하지 못했습니다.");
  };

  const addExistingPart=async(part:Part,promoteParent=false)=>{
    if(!activeId||!activePart){setNotice("BOM Root를 먼저 선택해 주세요.");return}
    if(!isMyLock){setNotice("편집 시작 후 Reuse Library의 PART를 현재 BOM에 추가할 수 있습니다.");return}
    if(part.id===activeId){setNotice("현재 BOM Root는 자기 자신을 하위 PART로 추가할 수 없습니다.");return}
    if(bomAddingId)return;
    setBomAddingId(part.id);setNotice("");
    try{const result=await submitExistingPart(part,promoteParent);if(!result)return;setPromotionPart(null);await load();setNotice(`${part.partNumber} · ${part.name}을 현재 BOM에 추가했습니다.`)}catch(reason){setNotice(reason instanceof Error?reason.message:"BOM에 PART를 추가하지 못했습니다.")}finally{setBomAddingId("")}
  };

  const saveQuantity=async(row:BomRow,value:number)=>{
    if(!isMyLock||quantityBusyId||!activeId)return;
    if(!Number.isFinite(value)||value<=0){setNotice("수량은 0보다 큰 값이어야 합니다.");return}
    if(Number(row.quantity)===value)return;
    setQuantityBusyId(row.id);setNotice("");
    try{await post("/api/product-data/bom-items",{rootPartId:activeId,bomItemId:row.id,quantity:value});await load();setNotice(`${row.childNumber} 수량을 ${value} ${row.unit}로 변경했습니다.`)}catch(reason){setNotice(reason instanceof Error?reason.message:"수량을 수정하지 못했습니다.")}finally{setQuantityBusyId("")}
  };

  const createPart=async()=>{
    if(partSaving||!partForm.name.trim()||(partForm.numberMode==="manual"&&!partForm.partNumber.trim()))return;
    setPartSaving(true);setNotice("");
    try{const result=await post("/api/product-data/parts",partForm);setPartCreateOpen(false);setPartForm(emptyPartForm());await Promise.all([load(),loadPartSettings()]);setNotice(`${result.partNumber} · ${roleMeta(result.itemRole).label}을 생성했습니다.`)}catch(reason){setNotice(reason instanceof Error?reason.message:"PART를 생성하지 못했습니다.")}finally{setPartSaving(false)}
  };

  const copyBom=async()=>{
    if(!activeId||!activePart||copyBusy)return;
    if(!hasChildren(activeId)){setNotice("복사할 하위 BOM 구조가 없습니다.");return}
    setCopyConfirmOpen(false);setCopyBusy(true);setNotice("");
    try{
      const result=await post("/api/product-data/bom-copy",{sourceRootPartId:activeId});
      setCurrentId(result.id);setReferenceId("");setReferenceOpen(false);setView("bom");
      await Promise.all([load(),loadPartSettings()]);
      onBomCopied?.({id:String(result.id),partNumber:String(result.partNumber),name:String(result.name)});
      setNotice(`${result.partNumber} · ${result.name} / Rev.${result.revision} BOM을 복사 생성했습니다.`);
    }catch(reason){setNotice(reason instanceof Error?reason.message:"BOM을 복사 생성하지 못했습니다.")}finally{setCopyBusy(false)}
  };

  const removeBom=async()=>{
    if(!activeId||!activePart||deleteBusy)return;
    setDeleteBusy(true);setNotice("");
    try{
      const checkResponse=await fetch("/api/product-data/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"check-bom",partId:activeId})});
      const check=await checkResponse.json() as DeleteCheck;
      if(!checkResponse.ok||!check.canDelete)throw new Error(check.reason||"이 BOM은 삭제할 수 없습니다.");
      if(!window.confirm(`${activePart.partNumber} · ${activePart.name}\n\n현재 BOM 구조만 삭제할까요?\nTOP/PART Master는 유지됩니다.`))return;
      const response=await fetch("/api/product-data/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete-bom",partId:activeId})});
      const result=await response.json() as DeleteCheck;
      if(!response.ok)throw new Error(result.reason||"BOM 구조를 삭제하지 못했습니다.");
      setReferenceOpen(false);setReferenceId("");
      await load();
      window.dispatchEvent(new CustomEvent("jsolution:product-data-refresh"));
      window.dispatchEvent(new CustomEvent("v2-part-updated",{detail:{partId:activeId,bomDeleted:true}}));
      setNotice(`${activePart.partNumber}의 BOM 구조를 삭제했습니다. PART Master는 유지됩니다.`);
    }catch(reason){setNotice(reason instanceof Error?reason.message:"BOM 구조를 삭제하지 못했습니다.")}finally{setDeleteBusy(false)}
  };

  const renderTree=(rootId:string,compact=false)=>{
    const visited=new Set<string>();
    const walk=(parentId:string,depth:number):React.ReactNode[]=>{
      if(visited.has(parentId)||depth>12)return [];
      visited.add(parentId);
      return data.bom.filter(row=>row.parentPartId===parentId).sort((a,b)=>a.sortOrder-b.sortOrder).flatMap(row=>{
        const part=data.parts.find(item=>item.id===row.childPartId),meta=roleMeta(part?.partType||"PART"),childHasChildren=hasChildren(row.childPartId);
        const displayRole=childHasChildren&&normalizedRole(part?.partType||"PART")==="PART"?ITEM_ROLES[1]:meta;
        const quantityNode=isMyLock&&!compact?<span className="pbw-qty-edit"><input key={`${row.id}-${row.quantity}`} type="number" min="0.001" step="any" defaultValue={row.quantity} disabled={quantityBusyId===row.id} onKeyDown={event=>{if(event.key==="Enter")(event.currentTarget as HTMLInputElement).blur()}} onBlur={event=>void saveQuantity(row,Number(event.currentTarget.value))}/><small>{row.unit}</small></span>:<span className="pbw-qty">{row.quantity} {row.unit}</span>;
        return [<div className="pbw-tree-row" key={row.id} style={{paddingLeft:`${10+depth*(compact?14:20)}px`}}><span className="pbw-tree-toggle">{childHasChildren?<ChevronDown size={15}/>:<span/>}</span><span className={`pbw-type-dot ${displayRole.value.toLowerCase()}`}/><span className="pbw-tree-main"><b>{row.childNumber}</b><em>{row.childName}</em><small>{displayRole.label}{part?.spec?` · ${part.spec}`:""}</small></span>{quantityNode}</div>,...walk(row.childPartId,depth+1)];
      });
    };
    return walk(rootId,0);
  };

  return <>
  <section className="pbw-shell">
    <header className="pbw-head"><div><small>PLM CORE · PART / BOM</small><h1>PART · BOM</h1><p>PART Master를 기준으로 제품 구조를 구성하고 기존 PART와 BOM 구조를 재사용합니다.</p></div><div className="pbw-head-actions"><button onClick={()=>void load()}><RefreshCw size={16}/>새로고침</button><button className="primary" onClick={()=>{setPartForm(emptyPartForm());setPartCreateOpen(true)}}><Plus size={16}/>PART 생성</button></div></header>
    <nav className="pbw-tabs"><button className={view==="part"?"active":""} onClick={()=>setView("part")}><TableProperties size={17}/>PART 라이브러리</button><button className={view==="bom"?"active":""} disabled={!activeId} onClick={()=>activeId&&setView("bom")}><Layers3 size={17}/>BOM 편집기</button></nav>
    {notice&&<p className="pbw-notice">{notice}</p>}

    {view==="part"&&<div className="pbw-library">
      <div className="pbw-toolbar"><label><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="PART Code · 품명 · 사양 검색"/></label><div className="pbw-toolbar-right"><button disabled={selectedBomIds.length!==2} onClick={()=>selectedBomIds.length===2&&onOpenBomCompare?.(selectedBomIds[0],selectedBomIds[1])}><GitCompareArrows size={16}/>BOM 비교{selectedBomIds.length===2?" (2)":""}</button><span>{visibleParts.length}개 PART</span></div></div>
      <div className="pbw-part-table"><header><label className="pbw-ai-select-head" title="전체 PART/BOM 선택"><input type="checkbox" checked={allVisibleSelected} onChange={()=>allVisibleSelected?selection.clear():visibleParts.forEach(part=>{const context=contextFor(part);if(!selection.has(context))selection.toggle(context)})}/></label><span>PART Code</span><span>품명</span><span>Item Role</span><span>Revision</span><span>사양</span><span>단위</span><span>BOM</span></header>{visibleParts.map(part=>{const meta=roleMeta(part.partType),structured=hasChildren(part.id),context=contextFor(part);return <article key={part.id} className="pbw-part-detail-row" title="PART 상세 정보 열기" onClick={event=>{const target=event.target as HTMLElement;if(target.closest("button,input,label,a,select,textarea"))return;window.dispatchEvent(new CustomEvent("v2-open-part-detail",{detail:{partId:part.id,tab:"info"}}))}}><label className="pbw-ai-select" title="AI 자료로 선택"><input type="checkbox" checked={selection.has(context)} onChange={()=>selection.toggle(context)}/></label><b>{part.partNumber}</b><span>{part.name}</span><em>{meta.label}<small>{meta.hint}</small></em><span>Rev.{part.revision}</span><span>{part.spec||"—"}</span><span>{part.unit}</span><span className="pbw-bom-cell"><button onClick={()=>openBom(part)}>BOM 열기</button><small>{structured?"구조 있음":"구조 없음"}</small></span></article>})}{loading&&<p className="pbw-empty">PART 데이터를 불러오는 중…</p>}</div>
    </div>}

    {view==="bom"&&<div className="pbw-bom-screen">
      <div className="pbw-bom-command"><div><select value={activeId} disabled={isMyLock} onChange={event=>setCurrentId(event.target.value)}>{bomCandidates.map(part=><option key={part.id} value={part.id}>{part.partNumber} · {part.name} · {roleMeta(part.partType).label}</option>)}</select><span className={`mode ${isMyLock?"editing":lockedByOther?"locked":""}`}>{isMyLock?<><Check size={14}/>편집 중 · {lockTime(activeLock?.lockedAt||0)}</>:lockedByOther?<><LockKeyhole size={14}/>{activeLock?.lockedByName||"다른 사용자"} 편집 중</>:<><LockKeyhole size={14}/>조회 모드</>}</span></div><div><button disabled={copyBusy||deleteBusy||!activeId||!hasChildren(activeId)} onClick={()=>setCopyConfirmOpen(true)}><Copy size={15}/>{copyBusy?"복사 생성 중…":"BOM 복사 생성"}</button><button onClick={()=>setReferenceOpen(value=>!value)} className={referenceOpen?"active":""}><PanelRightOpen size={15}/>Reference BOM</button>{isMyLock?<button className="primary" disabled={lockBusy||deleteBusy} onClick={()=>void changeLock("checkin-bom")}><Check size={15}/>{lockBusy?"처리 중":"Check-in"}</button>:<button className="primary" disabled={lockBusy||deleteBusy||lockedByOther||!activeId} onClick={()=>void changeLock("checkout-bom")}><LockKeyhole size={15}/>{lockedByOther?"편집 중":lockBusy?"처리 중":"편집 시작"}</button>}<button className="danger" disabled={deleteBusy||!activeId||!hasChildren(activeId)} onClick={()=>void removeBom()}><Trash2 size={15}/>{deleteBusy?"확인 중…":"BOM 삭제"}</button></div></div>
      <div className={`pbw-editor-grid ${referenceOpen?"with-reference":""}`}>
        <aside className="pbw-reuse"><header><div><small>REUSE LIBRARY</small><b>PART / BOM 찾기</b></div><FileSearch size={19}/></header><label><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="코드·품명 검색"/></label><nav><button className="active">PART</button><button>BOM</button></nav><div className="pbw-reuse-list">{visibleParts.slice(0,30).map(part=>{const meta=roleMeta(part.partType),displayRole=hasChildren(part.id)&&normalizedRole(part.partType)==="PART"?ITEM_ROLES[1]:meta,isRoot=part.id===activeId,isAdding=bomAddingId===part.id;return <button key={part.id} className={`${isMyLock?"editable":""} ${isRoot?"current-root":""} ${isAdding?"adding":""}`} onClick={()=>void addExistingPart(part)} title={isRoot?"현재 BOM Root":isMyLock?"현재 BOM에 추가":"편집 시작 후 추가 가능"}><span className={`pbw-part-icon ${displayRole.value.toLowerCase()}`}><Box size={15}/></span><span><b>{part.partNumber}</b><em>{part.name}</em><small>{displayRole.label}{isRoot?" · Current Root":""}</small></span>{isAdding?<span className="pbw-reuse-adding">추가 중</span>:isMyLock&&!isRoot?<Plus size={15}/>:<ChevronRight size={15}/>}</button>})}</div></aside>
        <main className="pbw-current"><header><div><small>CURRENT BOM</small><h2>{activePart?`${activePart.partNumber} · ${activePart.name}`:"BOM을 선택해 주세요"}</h2><span>{isMyLock?"내가 편집 중입니다.":lockedByOther?`${activeLock?.lockedByName||"다른 사용자"}님이 편집 중입니다. 현재는 조회만 가능합니다.`:"현재 BOM은 조회 상태입니다."}</span></div><strong>{activePart?`Rev.${activePart.revision}`:"—"}</strong></header><div className="pbw-tree-head"><span>구조 / PART</span><span>수량</span></div><div className="pbw-tree-root"><Layers3 size={18}/><span><b>{activePart?.partNumber||"—"}</b><em>{activePart?.name||"BOM 없음"}</em><small>{activePart?roleMeta(activePart.partType).label:""}</small></span></div><div className="pbw-tree-body">{activeId&&renderTree(activeId)}{activeId&&!hasChildren(activeId)&&<p className="pbw-empty">현재 PART를 Root로 열었습니다. 아직 하위 구조가 없습니다.</p>}</div></main>
        {referenceOpen&&<aside className="pbw-reference"><header><div><small>REFERENCE BOM · READ ONLY</small><b>다른 BOM에서 가져오기</b></div><button onClick={()=>setReferenceOpen(false)}>×</button></header><select value={activeReferenceId} onChange={event=>setReferenceId(event.target.value)}><option value="">참조 BOM 선택</option>{referenceCandidates.map(part=><option key={part.id} value={part.id}>{part.partNumber} · {part.name}</option>)}</select><div className="pbw-reference-root"><Layers3 size={17}/><span><b>{referencePart?.partNumber||"—"}</b><em>{referencePart?.name||"참조 BOM을 선택해 주세요"}</em></span></div><div className="pbw-reference-tree">{activeReferenceId&&renderTree(activeReferenceId,true)}</div><footer>Assembly / Part Drag & Drop은 편집 기능 단계에서 연결합니다.</footer></aside>}
      </div>
    </div>}

    {partCreateOpen&&<div className="pbw-create-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!partSaving)setPartCreateOpen(false)}}><aside className="pbw-create-panel"><header><div><small>PART MASTER</small><h2>PART 생성</h2><p>품번은 Identity로 관리하고 Item Role과 부품 유형은 참조 속성으로 지정합니다.</p></div><button onClick={()=>!partSaving&&setPartCreateOpen(false)} aria-label="닫기"><X size={19}/></button></header><div className="pbw-create-body"><section><label className="pbw-create-label">Item Role</label><div className="pbw-role-options">{ITEM_ROLES.map(role=><button type="button" key={role.value} className={partForm.itemRole===role.value?"active":""} onClick={()=>setPartForm(current=>({...current,itemRole:role.value}))}><b>{role.label}</b><span>{role.hint}</span></button>)}</div><small className="pbw-create-help">Item Role은 품번과 분리됩니다. 역할이 바뀌어도 PART Code는 유지됩니다.</small></section><section><label className="pbw-create-label">PART Code</label><div className="pbw-number-mode"><button type="button" className={partForm.numberMode==="auto"?"active":""} onClick={()=>setPartForm(current=>({...current,numberMode:"auto",partNumber:""}))}>자동채번</button><button type="button" disabled={!allowManual} className={partForm.numberMode==="manual"?"active":""} onClick={()=>allowManual&&setPartForm(current=>({...current,numberMode:"manual"}))}>직접입력</button></div>{partForm.numberMode==="manual"?<input value={partForm.partNumber} onChange={event=>setPartForm(current=>({...current,partNumber:event.target.value}))} placeholder="기존 PART Code 입력"/>:<div className="pbw-auto-number"><b>{autoNumberPreview}</b><span>Role · 부품 유형 · BOM Level · Revision과 무관한 공통 순차번호</span></div>}</section><label><span>품명 *</span><input autoFocus value={partForm.name} onChange={event=>setPartForm(current=>({...current,name:event.target.value}))} placeholder="품명을 입력해 주세요"/></label><label><span>부품 유형</span><select className="pbw-create-select" value={partForm.categoryId} onChange={event=>setPartForm(current=>({...current,categoryId:event.target.value}))}><option value="">선택 안 함</option>{partCategories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select><small className="pbw-create-help">회사 기준정보에서 관리되는 참조 속성입니다. BOM 구조와 Item Role에는 영향을 주지 않습니다.</small></label><label><span>사양</span><input value={partForm.spec} onChange={event=>setPartForm(current=>({...current,spec:event.target.value}))} placeholder="규격 · 재질 · 사양"/></label><label className="short"><span>단위</span><input value={partForm.unit} onChange={event=>setPartForm(current=>({...current,unit:event.target.value}))} placeholder="EA"/></label></div><footer><button onClick={()=>setPartCreateOpen(false)} disabled={partSaving}>취소</button><button className="primary" onClick={()=>void createPart()} disabled={partSaving||!partForm.name.trim()||(partForm.numberMode==="manual"&&!partForm.partNumber.trim())}>{partSaving?"생성 중…":"PART 생성"}</button></footer></aside></div>}
    {copyConfirmOpen&&activePart&&<div className="pbw-role-confirm-backdrop"><section className="pbw-role-confirm"><header><small>BOM COPY</small><h3>BOM 복사 생성</h3></header><main><b>{activePart.partNumber} · {activePart.name}</b> BOM을 복사 생성할까요?<br/><br/>새 TOP 품번: 자동채번 ({autoNumberPreview} 예정)<br/>새 품명: {activePart.name} COPY<br/>초기 Revision: Rev.A<br/>하위 구조와 수량은 현재 BOM과 동일하게 복사됩니다.</main><footer><button onClick={()=>setCopyConfirmOpen(false)} disabled={copyBusy}>취소</button><button className="primary" onClick={()=>void copyBom()} disabled={copyBusy}>{copyBusy?"복사 생성 중…":"복사 생성"}</button></footer></section></div>}
    {promotionPart&&activePart&&<div className="pbw-role-confirm-backdrop"><section className="pbw-role-confirm"><header><small>ITEM ROLE</small><h3>Assembly 역할로 변경</h3></header><main><b>{activePart.partNumber} · {activePart.name}</b>은 현재 Part 역할입니다.<br/>하위 구조를 만들기 위해 Assembly 역할로 변경하고 <b>{promotionPart.partNumber} · {promotionPart.name}</b>을 추가할까요?</main><footer><button onClick={()=>setPromotionPart(null)}>취소</button><button className="primary" onClick={()=>void addExistingPart(promotionPart,true)}>변경 후 추가</button></footer></section></div>}
  </section>
  <PartBomDndBridge active/>
  <PartDetailPanelHost onOpenBomCompare={onOpenBomCompare}/>
  </>;
}