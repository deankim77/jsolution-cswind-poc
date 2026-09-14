"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {readApiJson} from '../../lib/read-api-json';
import {suppliedDecision,type SuppliedData,type SuppliedFact,type SuppliedChoice} from '../../lib/customer-supplied-contract';
import {suppliedBomRows} from '../../lib/supplied-bom-rows';
import type {ProjectPbom,BomRow} from '../../lib/pbom-contract';
import CustomerSuppliedTable from './customer-supplied-table';
import PbomTable from './pbom-table';
import ReviewDecisionActions from './review-decision-actions';
import './customer-supplied.css';
export default function CustomerSuppliedReview({projectId,recordId,version,facts,area,disabled,onApplied,documentName,actionContainer,renderSource}:{projectId:string;recordId:string;version:number;facts:SuppliedFact[];area:'summary'|'supplied'|'bom';disabled:boolean;onApplied:()=>void;documentName:string;actionContainer?:HTMLElement|null;renderSource?:(ids:string[])=>React.ReactNode}){
 const [data,setData]=useState<SuppliedData|null>(null),[pbom,setPbom]=useState<ProjectPbom|null>(null),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const c=new AbortController();setSelected([]);setError('');setData(null);setPbom(null);Promise.all([fetch(`/api/projects/${projectId}/customer-supplied`,{signal:c.signal,cache:'no-store'}),...(area==='bom'?[fetch(`/api/projects/${projectId}/pbom`,{signal:c.signal,cache:'no-store'})]:[])]).then(async responses=>{const values=await Promise.all(responses.map(async r=>{const d=await readApiJson(r);if(!r.ok)throw Error(d.error);return d}));if(c.signal.aborted)return;setData(values[0] as SuppliedData);if(values[1])setPbom(values[1] as ProjectPbom)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[projectId,recordId,version,reload,area]);
 const matchingPart=(f:SuppliedFact)=>{const target=f.replacementChain.at(-1)||f.itemNumber;const parts=data?.parts.filter(p=>p.customerNumbers.includes(target)&&data.edges.some(e=>e.childPartId===p.id))??[];return parts.length===1?parts[0]:undefined};
 const eligible=area==='bom'?facts.filter(f=>matchingPart(f)):facts;
 const locked=disabled||busy||!data?.canReview;
 const confirmedCount=new Set(data?.entries.filter(e=>e.recordId===recordId&&(area!=='bom'||e.bomApplied)).map(e=>e.itemId)).size;
 const submit=async(action:'confirm'|'cancel')=>{if(!data||area==='summary'||busy)return;setBusy(true);setError('');try{const choices:SuppliedChoice[]=selected.map(itemId=>({itemId,partId:matchingPart(facts.find(f=>f.id===itemId)!)?.id}));const r=await fetch(`/api/projects/${projectId}/customer-supplied`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,recordId,version,area,customerConfirmed:true,fingerprint:data.fingerprint,choices})}),d=await readApiJson(r);if(!r.ok)throw Error(d.error);setSelected([]);onApplied();setReload(n=>n+1);setNotice(action==='cancel'?'확정을 취소했습니다.':`${d.changed}건 확정했습니다.`)}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const actions=area==='summary'?null:<ReviewDecisionActions documentName={documentName} areaLabel={area==='bom'?'관련부품 사급수량':'사급품'} selectedCount={selected.length} totalCount={eligible.length} confirmedCount={confirmedCount} selectionDisabled={locked||!eligible.length} confirmDisabled={locked||!selected.length} cancelDisabled={locked||!confirmedCount} onSelectAll={checked=>setSelected(checked?eligible.map(f=>f.id):[])} onConfirm={()=>void submit('confirm')} onCancel={()=>void submit('cancel')}/>;
 const reviewRows=suppliedBomRows(facts,pbom?.rows??[],data?.parts??[]);
 const quantity=(row:BomRow)=>{const f=facts.find(f=>f.id===row.id)!;return f.change==='removed'?'삭제':f.quantity??'—'};
 return <section className="supplied-review">
 {actions&&(actionContainer?createPortal(actions,actionContainer):actions)}
 {error&&<p role="alert" className="wv2-form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {area==='bom'?<>{pbom&&<PbomTable variant="supplied" rows={reviewRows} renderSource={renderSource} renderCell={(key,row,fallback)=>row.partId?fallback:key==='item'?row.bom.customerItemNumber:key==='description'?row.bom.itemDescription:key==='status'?'미연결':'—'} extraColumn={{label:'사급수량',render:quantity}}/>}</>:<CustomerSuppliedTable rows={facts.map(f=>({...f,changeLabel:data?suppliedDecision(f,data.entries):'조회 중'}))} selected={selected} onSelect={area==='summary'?undefined:setSelected} disabled={locked}/>}
 </section>;
}
