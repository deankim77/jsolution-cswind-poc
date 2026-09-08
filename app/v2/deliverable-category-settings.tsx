"use client";

import {FileStack,Plus,Search,Trash2} from "lucide-react";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {SystemSettingsPanel} from "./system-settings-panel";
import "./deliverable-category-settings.css";

type Row={id:string;code:string;label:string;groupCode:string;sortOrder?:number;enabled?:boolean|number;version?:number};
type EditRow={id?:string;code:string;level1:string;level2:string;level3:string;sortOrder:number;enabled:boolean;version?:number};
const splitLabel=(label:string)=>{const parts=String(label||"").split(" > ");return {level1:parts[0]||"",level2:parts[1]||"",level3:parts.slice(2).join(" > ")||""}};

export function DeliverableCategorySettings(){
  const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState(""),[query,setQuery]=useState(""),[statusFilter,setStatusFilter]=useState("all"),[editing,setEditing]=useState<EditRow|null>(null);
  const load=()=>{setLoading(true);fetch("/api/deliverable-standards",{cache:"no-store"}).catch(()=>undefined).finally(()=>fetch("/api/system/master-data",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"산출물 카테고리를 불러오지 못했습니다.");setRows((data.codes??[]).filter((item:Row)=>item.groupCode==="DELIVERABLE_STANDARD"));setNotice("")}).catch(reason=>setNotice(reason instanceof Error?reason.message:"산출물 카테고리를 불러오지 못했습니다.")).finally(()=>setLoading(false)))};
  useEffect(()=>{void load()},[]);

  const hierarchy=useMemo(()=>rows.map(row=>({...row,...splitLabel(row.label)})),[rows]);
  const level1Options=useMemo(()=>Array.from(new Set(hierarchy.map(row=>row.level1).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ko")),[hierarchy]);
  const level2Options=useMemo(()=>{if(!editing?.level1)return[];return Array.from(new Set(hierarchy.filter(row=>row.level1===editing.level1).map(row=>row.level2).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ko"))},[hierarchy,editing?.level1]);
  const visible=useMemo(()=>{const key=query.trim().toLowerCase();return hierarchy.filter(row=>{const enabled=row.enabled!==0&&row.enabled!==false;if(statusFilter==="active"&&!enabled)return false;if(statusFilter==="inactive"&&enabled)return false;return !key||`${row.code} ${row.level1} ${row.level2} ${row.level3}`.toLowerCase().includes(key)}).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)||a.level1.localeCompare(b.level1,"ko")||a.level2.localeCompare(b.level2,"ko")||a.level3.localeCompare(b.level3,"ko"))},[hierarchy,query,statusFilter]);

  const begin=(row?:Row)=>{if(row){const levels=splitLabel(row.label);setEditing({id:row.id,code:row.code,...levels,sortOrder:Number(row.sortOrder||0),enabled:row.enabled!==0&&row.enabled!==false,version:row.version})}else{const firstLevel=level1Options[0]||"";const firstLevel2=hierarchy.find(item=>item.level1===firstLevel)?.level2||"";setEditing({code:"",level1:firstLevel,level2:firstLevel2,level3:"",sortOrder:rows.length*10,enabled:true,version:1})}};
  const save=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!editing)return;if(!editing.code.trim()||!editing.level1.trim()||!editing.level2.trim()||!editing.level3.trim()){setNotice("코드와 1·2·3레벨을 모두 선택·입력해 주세요.");return}const label=[editing.level1,editing.level2,editing.level3].join(" > ");const payload={id:editing.id,entity:"code",code:editing.code.trim().toUpperCase(),groupCode:"DELIVERABLE_STANDARD",label,version:editing.version||1,sortOrder:Number(editing.sortOrder||0),enabled:editing.enabled};const response=await fetch("/api/system/master-data",{method:editing.id?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok){setNotice(result.error||"저장하지 못했습니다.");return}setEditing(null);void load()};
  const remove=async(row:Row)=>{if(!window.confirm(`'${splitLabel(row.label).level3||row.code}' 산출물을 삭제할까요?`))return;const response=await fetch("/api/system/master-data",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({entity:"code",id:row.id})});const result=await response.json();if(!response.ok){setNotice(result.error||"사용 중인 항목은 삭제할 수 없습니다.");return}void load()};

  return <section className="wv2-deliverable-category-settings">
    <header><div><small>DELIVERABLE MASTER</small><h2>산출물 카테고리 관리</h2><p>업무영역과 문서분류를 선택하고, 실제 표준 산출물은 3레벨 표시명으로 관리합니다.</p></div><button className="primary" onClick={()=>begin()}><Plus size={18}/>산출물 추가</button></header>
    <div className="toolbar"><label><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="표시명 · 문서분류 · 업무영역 · 코드 검색"/></label><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="all">전체 상태</option><option value="active">사용</option><option value="inactive">사용 안 함</option></select><span>{visible.length}개 항목</span></div>
    {notice&&!editing&&<p className="notice">{notice}</p>}
    {loading?<div className="empty"><b>산출물 카테고리를 불러오는 중…</b></div>:<div className="table"><header><span>표시명</span><span>2레벨 문서분류</span><span>1레벨 업무영역</span><span>코드</span><span>상태</span><span/></header>{visible.map(row=><article key={row.id}><button onClick={()=>begin(row)}><b>{row.level3}</b></button><span>{row.level2}</span><span>{row.level1}</span><code>{row.code}</code><i className={row.enabled===0||row.enabled===false?"off":"on"}>{row.enabled===0||row.enabled===false?"사용 안 함":"사용"}</i><div><button onClick={()=>begin(row)}>수정</button><button className="danger" onClick={()=>void remove(row)}><Trash2 size={17}/></button></div></article>)}{!visible.length&&<div className="empty"><FileStack size={28}/><b>등록된 산출물 카테고리가 없습니다.</b></div>}</div>}
    {editing&&<SystemSettingsPanel kicker="DELIVERABLE MASTER" title={editing.id?"산출물 카테고리 수정":"산출물 카테고리 추가"} description="1·2레벨은 기존 분류에서 선택하고 3레벨 표준 산출물을 등록합니다." onClose={()=>setEditing(null)} onSubmit={save} submitLabel={editing.id?"변경 저장":"등록"}>
      <label><span>1레벨 업무영역 *</span><select required value={editing.level1} onChange={event=>{const level1=event.target.value;const level2=hierarchy.find(item=>item.level1===level1)?.level2||"";setEditing({...editing,level1,level2})}}><option value="">업무영역 선택</option>{level1Options.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>2레벨 문서분류 *</span><select required value={editing.level2} disabled={!editing.level1} onChange={event=>setEditing({...editing,level2:event.target.value})}><option value="">문서분류 선택</option>{level2Options.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>3레벨 표준 산출물 *</span><input required value={editing.level3} placeholder="예: 착수보고서" onChange={event=>setEditing({...editing,level3:event.target.value})}/></label>
      <div className="two"><label><span>산출물 코드 *</span><input required value={editing.code} onChange={event=>setEditing({...editing,code:event.target.value.toUpperCase().replace(/\s+/g,"_")})}/></label><label><span>사용 여부</span><select value={editing.enabled?"active":"inactive"} onChange={event=>setEditing({...editing,enabled:event.target.value==="active"})}><option value="active">사용</option><option value="inactive">사용 안 함</option></select></label></div>
      <label><span>정렬 순서</span><input type="number" value={editing.sortOrder} onChange={event=>setEditing({...editing,sortOrder:Number(event.target.value)})}/></label>
      {notice&&<p className="wv2-module-notice">{notice}</p>}
    </SystemSettingsPanel>}
  </section>;
}
