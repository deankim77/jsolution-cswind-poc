"use client";
import {useState} from 'react';
import {Trash2} from 'lucide-react';
import {readApiJson} from '../../lib/read-api-json';
export default function CustomerDataDeleteButton({projectId,ids,disabled=false,onDeleted}:{projectId:string;ids:string[];disabled?:boolean;onDeleted:()=>void}){
 const [busy,setBusy]=useState(false);
 async function remove(){if(busy||!ids.length)return;setBusy(true);try{
  const url=`/api/projects/${projectId}/customer-data`;
  const send=async(method:string,body:unknown)=>{const r=await fetch(url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await readApiJson(r);if(!r.ok)throw Error(d.error);return d;};
  await send('POST',{action:'check-delete',ids});
  if(!window.confirm('원본과 AI 분석 결과를 삭제하시겠습니까?'))return;
  const result=await send('DELETE',{ids});onDeleted();window.dispatchEvent(new CustomEvent('v2-deliverables-updated',{detail:{projectId}}));
  if(result.cleanupPending)window.alert('목록과 분석 결과는 삭제됐지만 원본 파일 정리가 지연되었습니다. 관리자에게 확인해 주세요.');
 }catch(e){window.alert((e as Error).message)}finally{setBusy(false)}}
 return <button disabled={disabled||busy||!ids.length} onClick={()=>void remove()}><Trash2 size={18}/>{busy?'처리 중…':'삭제'}</button>;
}
