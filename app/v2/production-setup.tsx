"use client";
import { useState } from 'react';
import { Factory } from 'lucide-react';
import type { V2Project } from './project-workspaces';
import './production-workspace.css';

export function ProductionSetup({ onInstalled, onCreated }: { onInstalled?: () => void; onCreated?: (project: V2Project) => void }) {
  const [busy,setBusy] = useState('');
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [startDate,setStartDate] = useState(new Date().toISOString().slice(0,10));
  async function run(action: 'template'|'demo') {
    setBusy(action); setError(''); setMessage('');
    try {
      const response = await fetch('/api/production/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,startDate})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '생산 템플릿을 등록하지 못했습니다.');
      setMessage(action==='template'?'TC800 생산 템플릿이 준비되었습니다.':`${result.project.code} · ${result.project.reused?'기존 시연 프로젝트를 열었습니다.':'시연 프로젝트를 생성했습니다.'}`);
      onInstalled?.();
      if (result.project) onCreated?.(result.project);
    } catch (reason) {setError(reason instanceof Error ? reason.message : '등록에 실패했습니다.');}
    finally {setBusy('');}
  }
  return <section className="production-setup cswind-data-card"><h2><Factory size={18}/> TC800 생산 표준</h2>
    <p>P1 생산준비 · P2 MAST · P3 SLEWING · P4 JIB · P5 CJH · P6 FAT 및 출하</p>
    <p>4개 Main ASSY, 12개 Sub ASSY의 표준 WBS와 산출물 계획을 등록합니다. 기존 템플릿과 시연 프로젝트는 덮어쓰지 않습니다.</p>
    <div className="cswind-data-actions"><button type="button" disabled={Boolean(busy)} onClick={()=>void run('template')}>{busy==='template'?'등록 중…':'TC800 생산 템플릿 등록'}</button>
    {onCreated&&<><label>시연 시작일 <input type="date" value={startDate} disabled={Boolean(busy)} onChange={e=>setStartDate(e.target.value)}/></label><button type="button" className="primary" disabled={Boolean(busy)||!startDate} onClick={()=>void run('demo')}>{busy==='demo'?'생성 중…':'템플릿으로 T800 시연 프로젝트 만들기'}</button></>}</div>
    <p>관리자용 초기 등록 · 일정은 시연용 가정, 작업 실적은 0%로 시작합니다.</p>
    {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="wv2-form-error">{error}</p>}
  </section>;
}
