"use client";
import {useEffect,useRef,useState} from 'react';
import {LockKeyhole,Save,Undo2,X} from 'lucide-react';
import type {ReviewArea} from '../../lib/customer-review-contract';
import {bulkFields,bulkCell,updateBulkCell,parseGridClipboard,type BulkState,type BulkRow} from '../../lib/production-bulk-edit';
import './production-bulk-dialog.css';
type Cells=Record<string,Record<string,string>>;
export default function ProductionBulkDialog({projectId,projectName,area,onClose,onSaved,sources}:{sources:Record<string,string>;projectId:string;projectName:string;area:ReviewArea;onClose:()=>void;onSaved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),inputs=useRef(new Map<string,HTMLInputElement|HTMLTextAreaElement>());
 const [state,setState]=useState<BulkState|null>(null),[cells,setCells]=useState<Cells>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const url=`/api/projects/${projectId}/production-bulk`,columns=bulkFields[area],editing=Boolean(state?.lock?.mine),rows=state?.rows??[];
 const accept=(next:BulkState)=>{setState(next);setCells(Object.fromEntries(next.rows.map(row=>[row.id,Object.fromEntries(columns.map(([key])=>[key,bulkCell(row,area,key)]))])));};
 useEffect(()=>{const c=new AbortController();dialog.current?.showModal();fetch(`${url}?area=${area}`,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(!c.signal.aborted)accept(d)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>{c.abort();dialog.current?.close()}},[url,area]);
 const request=async(action:string,payload={})=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({area,action,token:state?.lock?.token,...payload})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
 const reload=async()=>{const r=await fetch(`${url}?area=${area}`);const d=await r.json();if(!r.ok)throw Error(d.error);accept(d);};
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const cancel=async()=>{await request('cancel');setState(s=>s?{...s,lock:null}:s);await reload();setNotice('편집을 취소했습니다.');};
 const close=()=>{if(busy)return;if(editing){if(!window.confirm('체크아웃을 취소하고 입력한 변경을 버릴까요?'))return;void run(async()=>{await request('cancel');onClose()});}else onClose();};
 const put=(id:string,key:string,value:string)=>setCells(current=>({...current,[id]:{...current[id],[key]:value}}));
 const focus=(r:number,c:number)=>{inputs.current.get(`${Math.max(0,Math.min(rows.length-1,r))}:${Math.max(0,Math.min(columns.length-1,c))}`)?.focus();};
 const keyDown=(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>,r:number,c:number)=>{
 if(e.nativeEvent.isComposing)return;
 if(e.key==='Enter'&&e.altKey&&e.currentTarget instanceof HTMLTextAreaElement){e.preventDefault();const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;put(rows[r].id,columns[c][0],el.value.slice(0,start)+'\n'+el.value.slice(end));return;}
 if(e.key==='Enter'){e.preventDefault();focus(r+(e.shiftKey?-1:1),c);}
 else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();focus(r+(e.key==='ArrowUp'?-1:1),c);}
 else if(e.key==='Tab'){e.preventDefault();const next=r*columns.length+c+(e.shiftKey?-1:1);if(next>=0&&next<rows.length*columns.length)focus(Math.floor(next/columns.length),next%columns.length);}
 else if(e.key==='ArrowLeft'&&e.currentTarget.selectionStart===0){e.preventDefault();focus(r,c-1);}
 else if(e.key==='ArrowRight'&&e.currentTarget.selectionEnd===e.currentTarget.value.length){e.preventDefault();focus(r,c+1);}
 else if(e.key==='F2'){e.preventDefault();e.currentTarget.setSelectionRange(e.currentTarget.value.length,e.currentTarget.value.length);}
 };
 const paste=(e:React.ClipboardEvent,r:number,c:number)=>{if(!editing||busy)return;const text=e.clipboardData.getData('text/plain');if(!/[\t\r\n]/.test(text))return;e.preventDefault();try{const grid=parseGridClipboard(text);if(r+grid.length>rows.length||grid.some(line=>c+line.length>columns.length))throw Error('붙여넣을 범위가 현재 편집 표를 벗어납니다.');setCells(old=>{const next={...old};grid.forEach((line,ri)=>{const id=rows[r+ri].id;next[id]={...next[id]};line.forEach((value,ci)=>{next[id][columns[c+ci][0]]=value})});return next});setError('');}catch(e){setError((e as Error).message)}};
 const changed=rows.filter(row=>columns.some(([key])=>cells[row.id]?.[key]!==bulkCell(row,area,key))).length;
 return <dialog ref={dialog} className="wv2-module-dialog production-bulk-dialog" onCancel={e=>{e.preventDefault();close()}} aria-labelledby="production-bulk-title">
 <header><div><small>{projectName}</small><h2 id="production-bulk-title">{area==='pbom'?'PBOM':'AI 추출사항'} 전체수정</h2></div><button type="button" disabled={busy} onClick={close} aria-label="닫기"><X size={18}/></button></header>
 <div className="wv2-toolbar production-bulk-toolbar">
 <button type="button" disabled={busy||!state?.canEdit||Boolean(state?.lock)||!rows.length} onClick={()=>void run(async()=>{accept(await request('checkout'));setNotice('체크아웃했습니다. 셀을 수정하세요.');})}><LockKeyhole size={18}/>체크아웃</button>
 <button type="button" className="wv2-panel-save" disabled={busy||!editing} onClick={()=>void run(async()=>{const edited=rows.map(row=>columns.reduce<BulkRow>((next,[key])=>updateBulkCell(next,area,key,cells[row.id]?.[key]??''),row));const result=await request('checkin',{rows:edited});setState(s=>s?{...s,lock:null}:s);onSaved();await reload();setNotice(`${result.changed}개 행을 저장하고 체크인했습니다.`);})}><Save size={18}/>체크인</button>
 <button type="button" disabled={busy||!editing} onClick={()=>{if(window.confirm('입력한 변경을 버리고 체크아웃을 취소할까요?'))void run(cancel)}}><Undo2 size={18}/>편집 취소</button>
 <button type="button" disabled={busy} onClick={close}><X size={18}/>닫기</button>
 <span>{rows.length}개 행 · 변경 {changed}개{busy?' · 처리 중…':editing?' · 편집 중':state?.lock?' · 다른 사용자 편집 중':' · 조회'}</span>
 </div>
 {error&&<p role="alert" className="wv2-form-error">{error}</p>}{notice&&<p role="status" className="production-help">{notice}</p>}
 <p className="production-help">Enter ↓ · Shift+Enter ↑ · Tab → · 방향키 이동 · F2 내용 편집 · Alt+Enter 줄바꿈 · 엑셀 여러 셀 붙여넣기</p>
 <div className="production-bulk-scroll"><table className="production-table production-bulk-grid"><thead><tr><th>No.</th><th>원본 자료</th>{area==='pbom'&&<><th>품번</th><th>LEVEL</th></>}{columns.map(([key,label])=><th key={key} className={key==='detail'?'production-bulk-detail':''}>{label}</th>)}</tr></thead><tbody>{rows.map((row,r)=><tr key={row.id}><td title={row.item.source}>{r+1}</td><td title={row.item.source}>{sources[row.recordId]||row.item.source}</td>{area==='pbom'&&<><td>{row.partNumber}</td><td>{row.level}</td></>}{columns.map(([key,label],c)=>{
 const common={value:cells[row.id]?.[key]??'',readOnly:!editing||busy,'aria-label':`${r+1}행 ${label}`,onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>put(row.id,key,e.target.value),onKeyDown:(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>keyDown(e,r,c),onPaste:(e:React.ClipboardEvent)=>paste(e,r,c),onFocus:(e:React.FocusEvent<HTMLInputElement|HTMLTextAreaElement>)=>e.currentTarget.select()};
 return <td key={key} className={cells[row.id]?.[key]!==bulkCell(row,area,key)?'production-bulk-changed':''}>{key==='detail'?<textarea {...common} ref={el=>{if(el)inputs.current.set(`${r}:${c}`,el);else inputs.current.delete(`${r}:${c}`)}}/>:<input {...common} ref={el=>{if(el)inputs.current.set(`${r}:${c}`,el);else inputs.current.delete(`${r}:${c}`)}}/>}</td>})}</tr>)}{!rows.length&&<tr><td colSpan={columns.length+(area==='pbom'?4:2)}>{state?'편집할 승인 항목이 없습니다.':'불러오는 중…'}</td></tr>}</tbody></table></div>
 </dialog>;
}
