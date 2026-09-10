"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Factory,RefreshCw,Upload} from 'lucide-react';
import {V2ViewTabs} from './v2-ui-foundation';
import CustomerDataWorkspace from './customer-data-workspace';
import type {V2Project} from './project-workspaces';
import type {WorkspaceFilterConfig} from './workspace-filter-panel';
import type {CustomerDataList} from '../../lib/customer-data-contract';
import './production-workspace.css';

type Data=CustomerDataList&{
  nodes:{id:string;code:string;name:string;kind:string;level:number}[];
  assignments:{recordId:string;wbsCode:string;confirmedBy:string;confirmedAt:number}[];
  proposals:{recordId:string;codes:string[];reason:string}[];
};
const tabs=[{value:'customer',label:'고객 Data'},{value:'review',label:'AI Data Review'},{value:'pbom',label:'PBOM'},{value:'trr',label:'TRR / 요구사항'},{value:'readiness',label:'Process Readiness'}];
export default function ProductionWorkspace({project,onOpenFilter}:{project:V2Project;onOpenFilter:(config:WorkspaceFilterConfig)=>void}) {
  const [data,setData]=useState<Data|null>(null),[stage,setStage]=useState(''),[tab,setTab]=useState('customer');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
  const [draft,setDraft]=useState<Record<string,string[]>>({});
  const fileInput=useRef<HTMLInputElement>(null);
  const url=`/api/projects/${encodeURIComponent(project.id)}`;
  const load=useCallback(async(signal?:AbortSignal)=>{
    const response=await fetch(`${url}/production`,{cache:'no-store',signal});const result=await response.json();
    if(!response.ok)throw new Error(result.error||'생산 자료를 불러오지 못했습니다.');
    if(!signal?.aborted){setData(result);setDraft({});}
  },[url]);
  useEffect(()=>{const controller=new AbortController();setError('');void load(controller.signal).catch(reason=>{if(!controller.signal.aborted)setError(reason.message)});return()=>controller.abort()},[load,reload]);
  const changed=useCallback(()=>setReload(value=>value+1),[]);
  async function importZip(file:File) {
    setBusy(true);setError('');setNotice('최초 접수 자료를 등록 중입니다. 완료까지 이 화면을 유지하세요.');
    try{
      if(file.size>50*1024*1024)throw new Error('ZIP 파일은 50MB 이하로 선택하세요.');
      const form=new FormData();form.set('file',file);
      const response=await fetch(`${url}/customer-data/import`,{method:'POST',body:form});const result=await response.json();
      if(!response.ok)throw new Error(result.error||'등록에 실패했습니다. 같은 ZIP으로 다시 시도하면 기존 파일은 건너뜁니다.');
      setNotice(`최초 접수 ${result.total}개 · 신규 ${result.imported}개 · 기존 ${result.skipped}개. 변경 패키지와 검증 정답은 등록하지 않았습니다.`);
      changed();
    }catch(reason){setError(reason instanceof Error?reason.message:'등록에 실패했습니다.');setNotice('일부 자료가 등록되었을 수 있습니다. 같은 ZIP으로 재시도할 수 있습니다.');changed();}
    finally{setBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function assign(recordId:string,codes:string[]) {
    setBusy(true);setError('');
    try{const response=await fetch(`${url}/production`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({recordId,codes})});const result=await response.json();if(!response.ok)throw new Error(result.error);await load();setNotice('공정 할당을 저장했습니다. 작업용 문서 승인은 별도로 진행합니다.');}
    catch(reason){setError(reason instanceof Error?reason.message:'할당에 실패했습니다.');}finally{setBusy(false);}
  }
  const inStage=(code:string)=>!stage||code===stage||code.startsWith(`${stage}.`);
  const applies=(code:string)=>inStage(code)||Boolean(stage&&stage.startsWith(`${code}.`));
  const records=(data?.records??[]).filter(record=>!stage||data?.assignments.some(a=>a.recordId===record.id&&applies(a.wbsCode)));
  const reviewRecords=(data?.records??[]).filter(record=>!stage||data?.assignments.some(a=>a.recordId===record.id&&applies(a.wbsCode))||data?.proposals.find(p=>p.recordId===record.id)?.codes.some(applies));
  const nodes=data?.nodes.filter(node=>node.kind==='summary')??[];
  const selectedName=nodes.find(node=>node.code===stage)?.name||'프로젝트 전체';
  return <div className="production-layout">
    <aside className="production-stages" aria-label="생산 공정"><button aria-pressed={!stage} onClick={()=>setStage('')}>전체 자료<small>{data?.records.length??0}개 원본</small></button>
      {nodes.map(node=><button key={node.id} aria-pressed={stage===node.code} onClick={()=>setStage(node.code)} style={{marginLeft:node.level>1?12:0}}>{node.name}<small>{node.level===1?'생산 단계':'Sub ASSY'}</small></button>)}
    </aside>
    <section className="production-body"><header className="wv2-page-title"><div><small>PRODUCTION · {project.code}</small><h1><Factory size={20}/> 생산 작업공간</h1><p>{selectedName}</p></div><button disabled={busy} onClick={changed}><RefreshCw size={18}/>새로고침</button></header>
      {error&&<p role="alert" className="wv2-form-error">{error}</p>}{notice&&<p role="status" className="wv2-template-notice">{notice}</p>}
      {!data&&!error&&<p>생산 자료를 불러오는 중…</p>}
      {data&&<><div className="production-cards">
        <button onClick={()=>setTab('review')}>AI Data Review<strong>{reviewRecords.filter(r=>!data.assignments.some(a=>a.recordId===r.id)).length}개 할당 검토</strong><small>현재는 파일명·템플릿 매핑 제안</small></button>
        <button onClick={()=>setTab('pbom')}>PBOM<strong>{records.filter(r=>r.documentType==='bom').length}개 원본</strong><small>구조화 PBOM 생성 전</small></button>
        <button onClick={()=>setTab('trr')}>TRR / 요구사항<strong>{records.filter(r=>['specification','requirement','report'].includes(r.documentType)).length}개 근거 자료</strong><small>TRR 분석·작성 전</small></button>
        <button onClick={()=>setTab('readiness')}>Process Readiness<strong>{records.length}개 연결 자료</strong><small>실물 자재·작업 준비 확인 전</small></button>
      </div>
      <V2ViewTabs value={tab} onChange={setTab} items={tabs}/>
      {tab==='customer'&&<><div className="cswind-data-card"><p>TC800 V4 ZIP에서 최초 도면 24개·부품 목록 1개·사양서 5개를 등록합니다. 같은 파일은 중복 등록하지 않습니다.</p><input ref={fileInput} type="file" accept=".zip" aria-label="TC800 V4 ZIP 선택" disabled={busy||!data.canReview} onChange={e=>{const file=e.target.files?.[0];if(file)void importZip(file)}}/><span><Upload size={18}/> 등록 자료는 전체에서 확인 후 공정에 할당하세요.</span></div>
      {!busy&&<CustomerDataWorkspace key={`${project.id}:${reload}:${stage}`} project={project} onOpenFilter={onOpenFilter} embedded recordIds={stage?records.map(r=>r.id):undefined} onChanged={changed}/>}</>}
      {tab==='review'&&<><p>AI 문서 내용 분석은 아직 연결되지 않았습니다. 아래는 TC800 파일명과 ASSY 코드에 따른 할당 제안입니다. 원본을 확인한 뒤 확정하세요.</p>
        <table className="production-table"><thead><tr><th>원본 자료·근거</th><th>적용 공정 / ASSY</th><th>확정</th></tr></thead><tbody>{reviewRecords.map(record=>{
          const proposal=data.proposals.find(p=>p.recordId===record.id);
          const existing=data.assignments.filter(a=>a.recordId===record.id).map(a=>a.wbsCode);
          const codes=draft[record.id]??(existing.length?existing:proposal?.codes??[]);
          return <tr key={record.id}><td><a href={`${url}/customer-data/${record.id}`}>{record.fileName}</a><p>{proposal?.reason}</p><small>{existing.length?'할당 확정됨':'할당 검토 대기'}</small></td><td><select multiple aria-label={`${record.fileName} 공정 할당`} disabled={busy||!data.canReview} value={codes} onChange={e=>setDraft(value=>({...value,[record.id]:Array.from(e.target.selectedOptions,option=>option.value)}))}>{nodes.map(node=><option key={node.id} value={node.code}>{node.name}</option>)}</select><small>Ctrl 키로 여러 공정 선택</small></td><td><button disabled={busy||!data.canReview} onClick={()=>void assign(record.id,codes)}>할당 확정</button>{existing.length>0&&<button disabled={busy||!data.canReview} onClick={()=>void assign(record.id,[])}>할당 해제</button>}</td></tr>;
        })}</tbody></table>{!reviewRecords.length&&<p>검토할 자료가 없습니다. 전체 → 고객 Data에서 자료를 등록하세요.</p>}</>}
      {(tab==='pbom'||tab==='trr')&&<><p>{tab==='pbom'?'BOM 근거 원본과 ASSY 구성입니다. 부품·수량의 구조화 PBOM은 아직 생성되지 않았습니다.':'기술검토의 근거 자료입니다. 요구사항 추출과 TRR 보고서는 아직 생성되지 않았습니다.'}</p>
        {tab==='pbom'&&<ul>{nodes.filter(n=>inStage(n.code)&&n.code.split('.')[0]!=='1'&&n.code.split('.')[0]!=='6').map(n=><li key={n.id}>{n.name}</li>)}</ul>}
        <ul>{records.filter(r=>tab==='pbom'?['bom','drawing'].includes(r.documentType):['specification','requirement','report'].includes(r.documentType)).map(r=><li key={r.id}><a href={`${url}/customer-data/${r.id}`}>{r.fileName}</a> · {r.reviewStatus==='reviewed'?'원본 검토 완료':'검토 대기'}</li>)}</ul></>}
      {tab==='readiness'&&<><p>자료 연결 현황입니다. 문서 업로드나 할당만으로 자재 입고·작업·검사 완료 처리하지 않습니다.</p><table className="production-table"><thead><tr><th>공정 / ASSY</th><th>연결 원본</th><th>작업·검사·자재 준비</th></tr></thead><tbody>{nodes.filter(n=>inStage(n.code)).map(node=><tr key={node.id}><td>{node.name}</td><td>{new Set(data.assignments.filter(a=>a.wbsCode===node.code||a.wbsCode.startsWith(`${node.code}.`)||node.code.startsWith(`${a.wbsCode}.`)).map(a=>a.recordId)).size}개</td><td>담당자 확인 필요</td></tr>)}</tbody></table></>}
      </>}
    </section>
  </div>;
}
