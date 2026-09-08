"use client";

import {useEffect,useMemo,useState} from "react";
import {Box,GitCompareArrows,Plus,RefreshCw,Search,X} from "lucide-react";
import {useAiContextSelection} from "./ai-context-selection";
import {PartDetailPanelHost} from "./part-detail-panel";
import "./part-bom-workspace.css";
import "./part-bom-part-create-settings.css";
import "./part-bom-ai-selection.css";

type Part={id:string;partNumber:string;name:string;partType:string;spec?:string;unit:string;revision:string;status:string;standardCost:number;rollupCost:number};
type BomRow={id:string;parentPartId:string;childPartId:string};
type Data={parts:Part[];bom:BomRow[]};
type ItemRole="TOP_ITEM"|"ASSEMBLY"|"PART";
type PartCategory={id:string;code:string;name:string;isActive:number;sortOrder:number};
type PartNumberSetting={prefix:string;separator:string;digits:number;nextSequence:number;allowManual:number};
type PartForm={itemRole:ItemRole;categoryId:string;numberMode:"auto"|"manual";partNumber:string;name:string;spec:string;unit:string};

const ITEM_ROLES=[
  {value:"TOP_ITEM",label:"Top Item",hint:"독립 개발 · 관리 대상"},
  {value:"ASSEMBLY",label:"Assembly",hint:"하위 구조를 가질 수 있는 품목"},
  {value:"PART",label:"Part",hint:"기본 단품 · 구성품"},
] as const;
const normalizedRole=(value:string):ItemRole=>value==="TOP_ITEM"||value==="PRODUCT"?"TOP_ITEM":value==="ASSEMBLY"||value==="SUB_ASSEMBLY"?"ASSEMBLY":"PART";
const roleMeta=(value:string)=>ITEM_ROLES.find(item=>item.value===normalizedRole(value))||ITEM_ROLES[2];
const emptyPartForm=():PartForm=>({itemRole:"PART",categoryId:"",numberMode:"auto",partNumber:"",name:"",spec:"",unit:"EA"});

export function PartLibraryWorkspace({onOpenBomCompare}:{onOpenBomCompare?:(leftRootId:string,rightRootId?:string)=>void}){
  const selection=useAiContextSelection("PART · BOM");
  const [data,setData]=useState<Data>({parts:[],bom:[]});
  const [loading,setLoading]=useState(true),[notice,setNotice]=useState("");
  const [query,setQuery]=useState("");
  const [partCreateOpen,setPartCreateOpen]=useState(false),[partSaving,setPartSaving]=useState(false),[partForm,setPartForm]=useState<PartForm>(emptyPartForm());
  const [partCategories,setPartCategories]=useState<PartCategory[]>([]),[partNumberSetting,setPartNumberSetting]=useState<PartNumberSetting|null>(null);

  const load=async()=>{setLoading(true);try{const response=await fetch("/api/product-data",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"PART/BOM 데이터를 불러오지 못했습니다.");setData({parts:result.parts??[],bom:result.bom??[]});setNotice("")}catch(reason){setNotice(reason instanceof Error?reason.message:"PART/BOM 데이터를 불러오지 못했습니다.")}finally{setLoading(false)}};
  const loadPartSettings=async()=>{try{const response=await fetch("/api/product-data/parts",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"PART 기준정보를 불러오지 못했습니다.");setPartCategories(result.categories??[]);setPartNumberSetting(result.numberSetting??null)}catch(reason){setNotice(reason instanceof Error?reason.message:"PART 기준정보를 불러오지 못했습니다.")}};
  useEffect(()=>{void load();void loadPartSettings()},[]);
  useEffect(()=>{const refresh=()=>void load();window.addEventListener("v2-part-updated",refresh);window.addEventListener("jsolution:product-data-refresh",refresh);return()=>{window.removeEventListener("v2-part-updated",refresh);window.removeEventListener("jsolution:product-data-refresh",refresh)}},[]);

  const visibleParts=useMemo(()=>{const key=query.trim().toLowerCase().replace(/\s+/g,"");return data.parts.filter(item=>!key||`${item.partNumber}${item.name}${item.spec||""}${item.partType}${roleMeta(item.partType).label}`.toLowerCase().replace(/\s+/g,"").includes(key))},[data.parts,query]);
  const hasChildren=(partId:string)=>data.bom.some(row=>row.parentPartId===partId);
  const contextFor=(part:Part)=>({id:part.id,kind:hasChildren(part.id)?"BOM":"PART",title:`${part.partNumber} · ${part.name}`,meta:[part.spec?`사양 ${part.spec}`:"",`Rev.${part.revision}`].filter(Boolean).join(" · ")});
  const allVisibleSelected=Boolean(visibleParts.length)&&visibleParts.every(part=>selection.has(contextFor(part)));
  const selectedBomIds=selection.selected.filter(item=>item.kind==="BOM"&&hasChildren(item.id)).map(item=>item.id);
  const autoNumberPreview=partNumberSetting?`${partNumberSetting.prefix}${partNumberSetting.separator}${String(partNumberSetting.nextSequence).padStart(partNumberSetting.digits,"0")}`:"P-000001";
  const allowManual=Number(partNumberSetting?.allowManual??1)===1;

  const post=async(path:string,body:Record<string,unknown>)=>{const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error||"요청을 처리하지 못했습니다.");return result};
  const createPart=async()=>{if(partSaving||!partForm.name.trim()||(partForm.numberMode==="manual"&&!partForm.partNumber.trim()))return;setPartSaving(true);setNotice("");try{const result=await post("/api/product-data/parts",partForm);setPartCreateOpen(false);setPartForm(emptyPartForm());await Promise.all([load(),loadPartSettings()]);setNotice(`${result.partNumber} · ${roleMeta(result.itemRole).label}을 생성했습니다.`)}catch(reason){setNotice(reason instanceof Error?reason.message:"PART를 생성하지 못했습니다.")}finally{setPartSaving(false)}};

  return <>
    <section className="pbw-shell pbw-library-only">
      <header className="pbw-head"><div><small>PLM CORE · PART / BOM</small><h1>PART · BOM</h1><p>PART Master를 기준으로 품목을 관리하며, BOM은 별도의 중앙 편집 탭에서 작업합니다.</p></div><div className="pbw-head-actions"><button onClick={()=>void load()}><RefreshCw size={18}/>새로고침</button><button className="primary" onClick={()=>{setPartForm(emptyPartForm());setPartCreateOpen(true)}}><Plus size={18}/>PART 생성</button></div></header>
      {notice&&<p className="pbw-notice">{notice}</p>}
      <div className="pbw-library">
        <div className="pbw-toolbar"><label><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="PART Code · 품명 · 사양 검색"/></label><div className="pbw-toolbar-right"><button disabled={selectedBomIds.length!==2} onClick={()=>selectedBomIds.length===2&&onOpenBomCompare?.(selectedBomIds[0],selectedBomIds[1])}><GitCompareArrows size={18}/>BOM 비교{selectedBomIds.length===2?" (2)":""}</button><span>{visibleParts.length}개 PART</span></div></div>
        <div className="pbw-part-table"><header><label className="pbw-ai-select-head" title="전체 PART/BOM 선택"><input type="checkbox" checked={allVisibleSelected} onChange={()=>allVisibleSelected?selection.clear():visibleParts.forEach(part=>{const context=contextFor(part);if(!selection.has(context))selection.toggle(context)})}/></label><span>PART Code</span><span>품명</span><span>Item Role</span><span>Revision</span><span>사양</span><span>단위</span><span>BOM</span></header>{visibleParts.map(part=>{const meta=roleMeta(part.partType),structured=hasChildren(part.id),context=contextFor(part);return <article key={part.id} className="pbw-part-detail-row" title="PART 상세 정보 열기" onClick={event=>{const target=event.target as HTMLElement;if(target.closest("button,input,label,a,select,textarea"))return;window.dispatchEvent(new CustomEvent("v2-open-part-detail",{detail:{partId:part.id,tab:"info"}}))}}><label className="pbw-ai-select" title="AI 자료로 선택"><input type="checkbox" checked={selection.has(context)} onChange={()=>selection.toggle(context)}/></label><b>{part.partNumber}</b><span>{part.name}</span><em>{meta.label}<small>{meta.hint}</small></em><span>Rev.{part.revision}</span><span>{part.spec||"—"}</span><span>{part.unit}</span><span className="pbw-bom-cell"><button type="button">BOM 열기</button><small>{structured?"구조 있음":"구조 없음"}</small></span></article>})}{loading&&<p className="pbw-empty">PART 데이터를 불러오는 중…</p>}</div>
      </div>

      {partCreateOpen&&<div className="pbw-create-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!partSaving)setPartCreateOpen(false)}}><aside className="pbw-create-panel"><header><div><small>PART MASTER</small><h2>PART 생성</h2><p>품번은 Identity로 관리하고 Item Role과 부품 유형은 참조 속성으로 지정합니다.</p></div><button onClick={()=>!partSaving&&setPartCreateOpen(false)} aria-label="닫기"><X size={19}/></button></header><div className="pbw-create-body"><section><label className="pbw-create-label">Item Role</label><div className="pbw-role-options">{ITEM_ROLES.map(role=><button type="button" key={role.value} className={partForm.itemRole===role.value?"active":""} onClick={()=>setPartForm(current=>({...current,itemRole:role.value}))}><b>{role.label}</b><span>{role.hint}</span></button>)}</div><small className="pbw-create-help">Item Role은 품번과 분리됩니다. 역할이 바뀌어도 PART Code는 유지됩니다.</small></section><section><label className="pbw-create-label">PART Code</label><div className="pbw-number-mode"><button type="button" className={partForm.numberMode==="auto"?"active":""} onClick={()=>setPartForm(current=>({...current,numberMode:"auto",partNumber:""}))}>자동채번</button><button type="button" disabled={!allowManual} className={partForm.numberMode==="manual"?"active":""} onClick={()=>allowManual&&setPartForm(current=>({...current,numberMode:"manual"}))}>직접입력</button></div>{partForm.numberMode==="manual"?<input value={partForm.partNumber} onChange={event=>setPartForm(current=>({...current,partNumber:event.target.value}))} placeholder="기존 PART Code 입력"/>:<div className="pbw-auto-number"><b>{autoNumberPreview}</b><span>Role · 부품 유형 · BOM Level · Revision과 무관한 공통 순차번호</span></div>}</section><label><span>품명 *</span><input autoFocus value={partForm.name} onChange={event=>setPartForm(current=>({...current,name:event.target.value}))} placeholder="품명을 입력해 주세요"/></label><label><span>부품 유형</span><select className="pbw-create-select" value={partForm.categoryId} onChange={event=>setPartForm(current=>({...current,categoryId:event.target.value}))}><option value="">선택 안 함</option>{partCategories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select><small className="pbw-create-help">회사 기준정보에서 관리되는 참조 속성입니다. BOM 구조와 Item Role에는 영향을 주지 않습니다.</small></label><label><span>사양</span><input value={partForm.spec} onChange={event=>setPartForm(current=>({...current,spec:event.target.value}))} placeholder="규격 · 재질 · 사양"/></label><label className="short"><span>단위</span><input value={partForm.unit} onChange={event=>setPartForm(current=>({...current,unit:event.target.value}))} placeholder="EA"/></label></div><footer><button onClick={()=>setPartCreateOpen(false)} disabled={partSaving}>취소</button><button className="primary" onClick={()=>void createPart()} disabled={partSaving||!partForm.name.trim()||(partForm.numberMode==="manual"&&!partForm.partNumber.trim())}>{partSaving?"생성 중…":"PART 생성"}</button></footer></aside></div>}
    </section>
    <PartDetailPanelHost onOpenBomCompare={onOpenBomCompare}/>
  </>;
}
