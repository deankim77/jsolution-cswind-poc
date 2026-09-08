"use client";

import {useEffect} from "react";
import {Search,X} from "lucide-react";

export type FilterOption={value:string;label:string;meta?:string};
export type FilterGroup={key:string;label:string;options:FilterOption[];selected:string[];onToggle:(value:string)=>void};
type Props={eyebrow:string;title?:string;logic:"AND"|"OR";onLogic:(logic:"AND"|"OR")=>void;projects:FilterOption[];projectId:string;projectSearch:string;onProjectSearch:(value:string)=>void;onProject:(value:string)=>void;groups:FilterGroup[];resultCount:number;onReset:()=>void;onApply:()=>void;onClose:()=>void};

export default function ProjectModuleFilterDrawer({eyebrow,title="상세 필터",logic,onLogic,projects,projectId,projectSearch,onProjectSearch,onProject,groups,resultCount,onReset,onApply,onClose}:Props){
  const q=projectSearch.trim().toLowerCase();
  const visibleProjects=projects.filter(p=>!q||`${p.label} ${p.meta||""}`.toLowerCase().includes(q));

  useEffect(()=>{
    const bodyOverflow=document.body.style.overflow;
    const htmlOverflow=document.documentElement.style.overflow;
    document.body.style.overflow="hidden";
    document.documentElement.style.overflow="hidden";
    return()=>{
      document.body.style.overflow=bodyOverflow;
      document.documentElement.style.overflow=htmlOverflow;
    };
  },[]);

  return <div className="filter-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside className="advanced-filter project-advanced-filter" style={{overflow:"hidden"}} aria-label={`${eyebrow} 상세 필터`}>
      <header className="filter-head compact-filter-head">
        <div><span>{eyebrow}</span><strong>{title}</strong><p>여러 조건을 조합해 필요한 데이터만 확인하세요.</p></div>
        <div className="compact-filter-actions">
          <div className="compact-filter-logic">
            <small>조건 결합</small>
            <button className={logic==="AND"?"active":""} onClick={()=>onLogic("AND")}>AND</button>
            <button className={logic==="OR"?"active":""} onClick={()=>onLogic("OR")}>OR</button>
          </div>
          <button className="compact-filter-close" onClick={onClose} aria-label="필터 닫기"><X size={18}/></button>
        </div>
      </header>

      <div className="filter-scroll">
        <section className="filter-section">
          <div className="filter-section-title"><strong>프로젝트</strong><span>프로젝트명 검색</span></div>
          <label className="filter-search"><Search size={15}/><input value={projectSearch} onChange={e=>onProjectSearch(e.target.value)} placeholder="프로젝트명 검색..."/></label>
          <div className="filter-option-list">
            {visibleProjects.map(p=><button key={p.value} className={projectId===p.value?"active":""} onClick={()=>onProject(p.value)}><span>{p.label}</span>{p.meta&&<small>{p.meta}</small>}</button>)}
            {!visibleProjects.length&&<p style={{margin:"12px",color:"#9aa3ac",fontSize:"11px",textAlign:"center"}}>검색 결과가 없습니다.</p>}
          </div>
        </section>

        {groups.map(group=><section className="filter-section" key={group.key}>
          <div className="filter-section-title"><strong>{group.label}</strong><span>복수 선택</span></div>
          <div className="filter-chip-grid">
            {group.options.map(option=><button key={option.value} className={group.selected.includes(option.value)?"active":""} onClick={()=>group.onToggle(option.value)}>{option.label}</button>)}
          </div>
        </section>)}

        <div className="filter-preview"><span>현재 조건 적용 시</span><strong>{resultCount}건</strong></div>
      </div>

      <footer className="filter-actions">
        <button onClick={onReset}>초기화</button>
        <button className="apply" onClick={onApply}>필터 적용</button>
      </footer>
    </aside>
  </div>;
}
