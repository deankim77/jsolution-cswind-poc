"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import PbomTable,{type ColumnKey} from './pbom-table';
import type {ProjectPbom} from '../../lib/pbom-contract';
import './production-workspace.css';
import {PencilLine,Save,Undo2,X} from 'lucide-react';
import type {ReviewArea} from '../../lib/customer-review-contract';
import {bulkFields,bulkCell,updateBulkCell,parseGridClipboard,type BulkState,type BulkRow} from '../../lib/production-bulk-edit';
import './production-bulk-dialog.css';
type Cells=Record<string,Record<string,string>>;
export default function ProductionBulkDialog({projectId,projectName,area,onClose,onSaved,sources}:{sources:Record<string,string>;projectId:string;projectName:string;area:ReviewArea;onClose:()=>void;onSaved:()=>void}){
 const baseline=useRef<Cells>({});
 const inputs=useRef(new Map<string,HTMLInputElement|HTMLTextAreaElement>());
 const [pbom,setPbom]=useState<ProjectPbom|null>(null),[toolbar,setToolbar]=useState<HTMLDivElement|null>(null);
 const [state,setState]=useState<BulkState|null>(null),[cells,setCells]=useState<Cells>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const url=`/api/projects/${projectId}/production-bulk`,columns=bulkFields[area],editing=Boolean(state?.lock?.mine),rows=state?.rows??[];
 const editorRows=area==='pbom'?(pbom?.rows??[]).flatMap(p=>{const row=rows.find(r=>r.id===p.confirmationId||(r.recordId===p.recordId&&r.item.id===p.sourceItemId));return row?[row]:[]}):rows;
 const accept=(next:BulkState,view=pbom)=>{setState(next);const values=Object.fromEntries(next.rows.map(row=>[row.id,Object.fromEntries(columns.map(([key])=>[key,bulkCell(row,area,key)]))]));
  if(area==='pbom')for(const p of view?.rows??[]){const row=next.rows.find(r=>r.id===p.confirmationId||(r.recordId===p.recordId&&r.item.id===p.sourceItemId));if(row)for(const [key] of columns)values[row.id][key]=bulkCell({...row,item:{...row.item,bom:p.bom}},area,key);}
  baseline.current=values;setCells(values);
 };
 const load=async(signal?:AbortSignal)=>{
  const response=await fetch(`${url}?area=${area}`,{signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error);
  let view=pbom;if(area==='pbom'){const result=await fetch(`/api/projects/${projectId}/pbom`,{signal,cache:'no-store'});const value=await result.json();if(!result.ok)throw Error(value.error);setPbom(value);view=value;}
  if(!signal?.aborted)accept(data,view);
 };
 useEffect(()=>{const c=new AbortController();void load(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[url,area]);
 useEffect(()=>{if(!editing)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[editing]);
 const request=async(action:string,payload={})=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({area,action,token:state?.lock?.token,...payload})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
 const reload=()=>load();
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const cancel=async()=>{await request('cancel');setState(s=>s?{...s,lock:null}:s);await reload();setNotice('편집을 취소했습니다.');};
 const close=()=>{if(busy)return;if(editing){if(!window.confirm('체크아웃을 취소하고 입력한 변경을 버릴까요?'))return;void run(async()=>{await request('cancel');onClose()});}else onClose();};
 const put=(id:string,key:string,value:string)=>setCells(current=>({...current,[id]:{...current[id],[key]:value}}));
 const mountedCells=()=>[...inputs.current.entries()].filter(([,el])=>el.isConnected&&el.offsetParent!==null).map(([id,el])=>({id,el,r:Number(id.split(':')[0]),c:Number(id.split(':')[1])})).sort((a,b)=>a.r-b.r||a.c-b.c);
 const keyDown=(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>,r:number,c:number)=>{
 if(e.nativeEvent.isComposing)return;
 if(e.key==='Enter'&&e.altKey&&e.currentTarget instanceof HTMLTextAreaElement){e.preventDefault();const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;put(editorRows[r].id,columns[c][0],el.value.slice(0,start)+'\n'+el.value.slice(end));return;}
 const available=mountedCells();let target:typeof available[number]|undefined;
 if(e.key==='Enter'||e.key==='ArrowUp'||e.key==='ArrowDown'){const up=e.key==='ArrowUp'||(e.key==='Enter'&&e.shiftKey);target=up?available.filter(v=>v.c===c&&v.r<r).at(-1):available.find(v=>v.c===c&&v.r>r);e.preventDefault();}
 else if(e.key==='Tab'){const index=available.findIndex(v=>v.r===r&&v.c===c);target=available[index+(e.shiftKey?-1:1)];if(target)e.preventDefault();}
 else if(e.key==='ArrowLeft'&&e.currentTarget.selectionStart===0){target=available.filter(v=>v.r===r&&v.c<c).at(-1);if(target)e.preventDefault();}
 else if(e.key==='ArrowRight'&&e.currentTarget.selectionEnd===e.currentTarget.value.length){target=available.find(v=>v.r===r&&v.c>c);if(target)e.preventDefault();}
 else if(e.key==='F2'){e.preventDefault();e.currentTarget.setSelectionRange(e.currentTarget.value.length,e.currentTarget.value.length);}
 target?.el.focus();
 };
 const paste=(e:React.ClipboardEvent,r:number,c:number)=>{if(!editing||busy)return;const text=e.clipboardData.getData('text/plain');if(!/[\t\r\n]/.test(text))return;e.preventDefault();try{const grid=parseGridClipboard(text),available=mountedCells(),rowIds=[...new Set(available.map(v=>v.r))].filter(id=>id>=r),columnIds=available.filter(v=>v.r===r&&v.c>=c).map(v=>v.c);if(grid.length>rowIds.length||grid.some(line=>line.length>columnIds.length))throw Error('붙여넣을 범위가 현재 편집 표를 벗어납니다.');setCells(old=>{const next={...old};grid.forEach((line,ri)=>{const id=editorRows[rowIds[ri]].id;next[id]={...next[id]};line.forEach((value,ci)=>{next[id][columns[columnIds[ci]][0]]=value})});return next});setError('');}catch(e){setError((e as Error).message)}};
 const changed=rows.filter(row=>columns.some(([key])=>cells[row.id]?.[key]!==baseline.current[row.id]?.[key])).length;
 const renderInput=(row:BulkRow,key:string,label:string)=>{
 const r=editorRows.findIndex(value=>value.id===row.id),c=columns.findIndex(([field])=>field===key);
 if(r<0||c<0)return null;
 const common={value:cells[row.id]?.[key]??'',readOnly:!editing||busy,'aria-label':`${r+1}행 ${label}`,onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>put(row.id,key,e.target.value),onKeyDown:(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>keyDown(e,r,c),onPaste:(e:React.ClipboardEvent)=>paste(e,r,c),onFocus:(e:React.FocusEvent<HTMLInputElement|HTMLTextAreaElement>)=>e.currentTarget.select(),className:cells[row.id]?.[key]!==baseline.current[row.id]?.[key]?'production-bulk-changed':undefined};
 const ref=(el:HTMLInputElement|HTMLTextAreaElement|null)=>{if(el)inputs.current.set(`${r}:${c}`,el);else inputs.current.delete(`${r}:${c}`)};
 return key==='detail'?<textarea {...common} rows={1} ref={ref}/>:<input {...common} ref={ref}/>;
 };
 const fields:Partial<Record<ColumnKey,string>>={description:'itemDescription',position:'position',item:'customerItemNumber',drawing:'drawingNumber',revision:'componentRevision',quantity:'quantity',unit:'unit',weight:'weight'};
 return <main className="production-bulk-window" aria-labelledby="production-bulk-title">
 <header className="production-bulk-heading"><h2 id="production-bulk-title">{area==='pbom'?'PBOM':'AI 추출사항'} 전체수정</h2><span>{projectName}</span></header>
 <div className="production-bulk-toolbar">
 <div className="production-bulk-view-controls pbom-toolbar-slot" ref={setToolbar}/>
 <span className="production-bulk-status" role="status">{area==='pbom'?pbom?.rows.length??0:rows.length}개 행 · 변경 {changed}개{busy?' · 처리 중…':editing?' · 편집 중':state?.lock?' · 다른 사용자 편집 중':' · 조회'}</span>
 <button type="button" className={!editing?"production-bulk-primary":undefined} title="편집 모드로 전환하고 다른 사용자의 동시 수정을 잠급니다." disabled={busy||!state?.canEdit||Boolean(state?.lock)||!editorRows.length} onClick={()=>void run(async()=>{await request('checkout');await reload();setNotice('');})}><PencilLine size={18}/>편집 모드(체크아웃)</button>
 <button type="button" className={editing?"production-bulk-primary":undefined} title="변경 내용을 저장하고 편집을 완료합니다." disabled={busy||!editing} onClick={()=>void run(async()=>{const edited=rows.map(row=>columns.reduce<BulkRow>((next,[key])=>cells[row.id]?.[key]===baseline.current[row.id]?.[key]?next:updateBulkCell(next,area,key,cells[row.id]?.[key]??''),row));const result=await request('checkin',{rows:edited});setState(s=>s?{...s,lock:null}:s);onSaved();await reload();setNotice(`${result.changed}개 행 저장 완료`);})}><Save size={18}/>편집 완료(체크인)</button>
 <button type="button" disabled={busy||!editing} onClick={()=>{if(window.confirm('입력한 변경을 버리고 체크아웃을 취소할까요?'))void run(cancel)}}><Undo2 size={18}/>편집 취소</button>
 <button type="button" disabled={busy} onClick={close}><X size={18}/>닫기</button>
 </div>
 {error&&<p role="alert" className="wv2-form-error">{error}</p>}{notice&&<p role="status" className="production-bulk-notice">{notice}</p>}
 <div className="production-bulk-body">
 {area==='pbom'?<PbomTable compact rows={pbom?.rows??[]} root={pbom?.root} toolbarContainer={toolbar} renderSource={ids=>ids.map(id=>sources[id]||id).join(', ')} renderCell={(key,row,fallback:ReactNode)=>{
  const original=rows.find(r=>r.id===row.confirmationId||(r.recordId===row.recordId&&r.item.id===row.sourceItemId)),field=fields[key];
  return editing&&original&&field?renderInput(original,field,key):fallback;
 }}/>:<div className="production-bulk-scroll"><table className="production-table production-bulk-grid"><colgroup><col style={{width:52}}/>{columns.map(([key])=><col key={key} style={{width:key==='detail'?undefined:key==='useTargets'?110:key==='itemName'?180:140}}/>)}</colgroup><thead><tr><th scope="col">순번</th>{columns.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead><tbody>{editorRows.map((row,index)=><tr key={row.id}><td className="production-bulk-sequence">{index+1}</td>{columns.map(([key,label])=><td key={key}>{renderInput(row,key,label)}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={columns.length+1}>{state?'편집할 승인 항목이 없습니다.':'불러오는 중…'}</td></tr>}</tbody></table></div>}
 </div>
 </main>;
}
