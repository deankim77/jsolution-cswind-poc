"use client";
import {useEffect,useRef,useState} from 'react';
import {X,Save} from 'lucide-react';
import {DRAWING_AVAILABILITY_LABELS,DRAWING_AVAILABILITY,WEIGHT_SOURCES,validateBomFacts,type BomFact,type BomRow} from '../../lib/pbom-contract';

export default function PbomEditDialog({row,rows,onSave,onClose}:{row:BomRow;rows:BomRow[];onSave:(id:string,fact:BomFact)=>void|Promise<void>;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [form,setForm]=useState<BomFact>(()=>({...row.bom}));
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close()},[]);
 const change=<K extends keyof BomFact>(key:K,value:BomFact[K])=>setForm(f=>({...f,[key]:value}));
 const save=async()=>{if(saving)return;setError('');setSaving(true);try{validateBomFacts(rows.map(r=>r.id===row.id?{...r,bom:form}:r));await onSave(row.id,form);onClose()}catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다. 다시 시도하세요.')}finally{setSaving(false)}};
 const isDescendant=(candidate:BomRow)=>{const seen=new Set<string>();let parent=candidate.bom.parentId;while(parent&&!seen.has(parent)){if(parent===row.id)return true;seen.add(parent);parent=rows.find(r=>r.id===parent)?.bom.parentId??null}return false};
 return <dialog ref={dialog} className="wv2-module-dialog pbom-edit-dialog" aria-labelledby="pbom-edit-title" onCancel={e=>{e.preventDefault();if(!saving)onClose()}}>
 <header><div><small>PBOM</small><h2 id="pbom-edit-title">부품 정보 수정</h2></div><button type="button" disabled={saving} onClick={onClose} aria-label="수정 취소 및 닫기"><X size={18}/></button></header>
 <form onSubmit={e=>{e.preventDefault();void save()}}>
 <fieldset disabled={saving} className="pbom-edit-fields">
 {(['section','itemDescription','position','customerItemNumber','drawingNumber','componentRevision','unit','weightUnit'] as const).map((key,index)=><label key={key}><span>{['Section','품명','Pos.','고객 Item No.','Drawing No.','CompRev','수량 단위','중량 단위'][index]}</span><input autoFocus={key==='itemDescription'} required={key==='itemDescription'} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}
 <label><span>상위 ASSY</span><select value={form.parentId??''} onChange={e=>change('parentId',e.target.value||null)}><option value="">문서 최상위 ASSY</option>{rows.filter(r=>r.id!==row.id&&r.recordId===row.recordId&&r.bom.partType==='ASSEMBLY'&&!isDescendant(r)).map(r=><option key={r.id} value={r.id}>{r.bom.itemDescription}</option>)}</select></label>
 <label><span>품목 역할</span><select value={form.partType} onChange={e=>change('partType',e.target.value as BomFact['partType'])}><option value="ASSEMBLY">ASSY</option><option value="PART">부품</option></select></label>
 <label><span>Qty Per Unit</span><input type="number" min="0" step="any" value={form.quantity??''} onChange={e=>change('quantity',e.target.value===''?null:Number(e.target.value))}/></label>
 <label><span>직접 표기 중량</span><input type="number" min="0" step="any" value={form.weight??''} onChange={e=>change('weight',e.target.value===''?null:Number(e.target.value))}/></label>
 <label><span>중량 근거</span><select value={form.weightSource} onChange={e=>change('weightSource',e.target.value as BomFact['weightSource'])}>{WEIGHT_SOURCES.map(v=><option key={v}>{v}</option>)}</select></label>
 <label><span>도면 확보 상태</span><select value={form.drawingAvailability} onChange={e=>change('drawingAvailability',e.target.value as BomFact['drawingAvailability'])}>{DRAWING_AVAILABILITY.map(v=><option key={v} value={v}>{DRAWING_AVAILABILITY_LABELS[v]}</option>)}</select></label>
 <label className="pbom-edit-complete"><input type="checkbox" checked={form.childrenComplete} onChange={e=>change('childrenComplete',e.target.checked)}/>하위 부품 목록 전체 확인</label>
 </fieldset>
 {error&&<p role="alert" className="wv2-form-error">{error}</p>}
 <footer><button type="button" disabled={saving} onClick={onClose}>취소</button><button type="submit" className="primary" disabled={saving}><Save size={18}/>{saving?'저장 중…':'SAVE'}</button></footer>
 </form></dialog>;
}
