"use client";
import {useEffect,useRef} from 'react';
import {Check} from 'lucide-react';

type Props = {
 selectedCount:number; totalCount:number;
 selectionDisabled:boolean; confirmDisabled:boolean; cancelDisabled:boolean;
 onSelectAll:(checked:boolean)=>void; onConfirm:()=>void; onCancel:()=>void;
};
/** Common decision controls for PBOM, TRR, readiness and work review. */
export default function ReviewDecisionActions({selectedCount,totalCount,selectionDisabled,confirmDisabled,cancelDisabled,onSelectAll,onConfirm,onCancel}:Props){
 const checkbox=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(checkbox.current)checkbox.current.indeterminate=selectedCount>0&&selectedCount<totalCount},[selectedCount,totalCount]);
 return <div className="review-decision-actions" role="group" aria-label="검토 및 확정">
  <label className="review-select-all"><input ref={checkbox} type="checkbox" checked={totalCount>0&&selectedCount===totalCount} disabled={selectionDisabled} onChange={e=>onSelectAll(e.target.checked)}/>전체 검토</label>
  <button type="button" className="wv2-panel-save" disabled={confirmDisabled} onClick={onConfirm}><Check size={18}/>선택 {selectedCount}개 확정</button>
  <button type="button" disabled={cancelDisabled} onClick={onCancel}>확정 취소 반영</button>
 </div>;
}
