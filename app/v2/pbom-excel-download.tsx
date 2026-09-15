"use client";
import {FileSpreadsheet} from 'lucide-react';
import './table-view-controls.css';

export function PbomExcelDownload({projectId,disabled=false}:{projectId:string;disabled?:boolean}){
 const label=<><FileSpreadsheet size={18}/>엑셀 다운로드</>;
 return disabled?<button type="button" className="table-view-action pbom-excel-download" disabled title="BOM을 불러오고 편집을 완료한 뒤 다운로드하세요.">{label}</button>:<a className="table-view-action pbom-excel-download" href={`/api/projects/${encodeURIComponent(projectId)}/pbom/export`} download title="저장된 전체 BOM과 검토 결과를 엑셀로 다운로드">{label}</a>;
}
