"use client";
import {customerReceiptId,type CustomerDataRecord} from '../../lib/customer-data-contract';
export default function CustomerSourceLink({record}:{record:CustomerDataRecord}) {
 return <button type="button" title={`${customerReceiptId(record)} · ${record.fileName} · 접수 버전 ${record.revision}`} onClick={event=>{event.stopPropagation();window.open(`/api/projects/${encodeURIComponent(record.projectId)}/customer-data/${encodeURIComponent(record.id)}?preview=1&popup=1`,'_blank','popup,width=1200,height=900,noopener,noreferrer')}}>{customerReceiptId(record)}</button>;
}
