"use client";
import {useEffect,useState} from 'react';
import ProductionBulkDialog from '../v2/production-bulk-dialog';
import type {ReviewArea} from '../../lib/customer-review-contract';
import {customerReceiptId} from '../../lib/customer-data-contract';
export default function ProductionEditorPage(){
 const [context,setContext]=useState<{projectId:string;projectName:string;area:ReviewArea}|null>(null),[sources,setSources]=useState<Record<string,string>>({});
 useEffect(()=>{const query=new URLSearchParams(window.location.search),projectId=query.get('projectId'),area=query.get('area');if(!projectId||(area!=='pbom'&&area!=='extract'))return;setContext({projectId,area,projectName:query.get('name')||''});document.title=`${area==='pbom'?'PBOM':'AI 추출사항'} 전체수정`;const abort=new AbortController();fetch(`/api/projects/${encodeURIComponent(projectId)}/customer-data`,{signal:abort.signal}).then(r=>r.ok?r.json():null).then(data=>{if(data?.records)setSources(Object.fromEntries(data.records.map((r:Parameters<typeof customerReceiptId>[0])=>[r.id,customerReceiptId(r)])))}).catch(()=>{});return()=>abort.abort()},[]);
 return context?<ProductionBulkDialog {...context} sources={sources} onClose={()=>window.close()} onSaved={()=>window.opener?.postMessage({type:'production-bulk-saved',projectId:context.projectId},window.location.origin)}/>:<p>편집 화면을 불러오는 중…</p>;
}
