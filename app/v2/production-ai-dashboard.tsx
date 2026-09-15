"use client";
import {useEffect,useState} from 'react';
import {sumAiMetrics,type AiProjectMetrics} from '../../lib/production-ai-metrics';
import {readApiJson} from '../../lib/read-api-json';
import './customer-data-workspace.css';
import './dashboard-metrics.css';
export type AiDashboardTab='customer'|'review'|'pbom'|'extract'|'ttr'|'supplied';
export default function ProductionAiDashboard({projectId,projectIds,onOpenTab,onOpenProject}:{projectId?:string;projectIds?:string[];onOpenTab?:(tab:AiDashboardTab)=>void;onOpenProject?:(id:string)=>void}){
 const [rows,setRows]=useState<AiProjectMetrics[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();setRows(null);setError('');fetch(`/api/production-ai-dashboard${projectId?`?projectId=${encodeURIComponent(projectId)}`:''}`,{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await readApiJson(r);if(!r.ok)throw Error(d.error);if(!c.signal.aborted)setRows(d.projects)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[projectId]);
 if(error)return <p role="alert" className="wv2-form-error">{error}</p>;
 if(!rows)return <p role="status">대시보드 집계 중…</p>;
 const visible=rows.filter(r=>!projectIds||projectIds.includes(r.id)),m=sumAiMetrics(visible.map(r=>r.metrics));
 const cards:{title:string;value:number;unit:string;lines:string[];tab:AiDashboardTab}[]=[
 {title:'AI 분석 대상 자료',value:m.registered,unit:'건',lines:[`분석 완료 ${m.analyzed}건`,`미분석 ${m.pending}건`],tab:'customer'},
 {title:'AI 추출 결과',value:m.bom+m.trr+m.supplied,unit:'건',lines:[`BOM 추출 ${m.bom}건`,`TRR 추출 ${m.trr}건`,`사급 목록 ${m.supplied}건`],tab:'review'},
 {title:'BOM 반영',value:m.parts.length,unit:'개',lines:[`신규 생성 부품 ${m.newParts.length}개`,`전체 사용 부품 ${m.parts.length}개`],tab:'pbom'},
 {title:'기술 요구사항 추출',value:m.technical,unit:'건',lines:[`반영 완료 ${m.technicalApplied}건`,`미반영 ${m.technicalPending}건`],tab:'extract'},
 {title:'TRR 자동생성',value:m.reports,unit:'버전',lines:[`추출 항목 ${m.trr}건`,`반영 완료 ${m.trrApplied}건`,`미반영 ${m.trrPending}건`],tab:'ttr'},
 {title:'사급품 반영',value:m.supplied,unit:'건',lines:[`반영 완료 ${m.suppliedApplied}건`,`미반영 ${m.suppliedPending}건`],tab:'supplied'},
 ];
 return <section className="wv2-project-gate-panel wv2-ai-metrics-panel"><header><div><b className="wv2-dashboard-card-title">AI 분석/추출/반영</b></div></header><div className="wv2-dashboard-metrics">{cards.map(card=>{const content=<><span>{card.title}</span><b>{card.value.toLocaleString()}<small> {card.unit}</small></b>{card.lines.map(line=><small key={line}>{line}</small>)}</>;return onOpenTab?<button type="button" key={card.tab} onClick={()=>onOpenTab(card.tab)}>{content}</button>:<article key={card.tab}>{content}</article>})}</div>{!projectId&&<div className="cswind-data-table"><table className="production-table"><thead><tr><th>프로젝트</th><th>등록 자료</th><th>분석 완료</th><th>BOM 추출</th><th>사용 부품</th><th>기술 요구사항 추출</th><th>TRR 자동생성</th><th>사급품 반영</th></tr></thead><tbody>{visible.map(p=><tr key={p.id}><td><button type="button" onClick={()=>onOpenProject?.(p.id)}>{p.name}</button></td><td>{p.metrics.registered}건</td><td>{p.metrics.analyzed}건</td><td>{p.metrics.bom}건</td><td>{p.metrics.parts.length}개</td><td>{p.metrics.technical}건</td><td>{p.metrics.reports}버전</td><td>{p.metrics.suppliedApplied}건</td></tr>)}{!visible.length&&<tr><td colSpan={8}>표시할 프로젝트가 없습니다.</td></tr>}</tbody></table></div>}</section>;
}
