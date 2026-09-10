"use client";
import {useEffect,useRef,useState} from 'react';
import {Check,Undo2} from 'lucide-react';

type Props = {
 selectedCount:number; totalCount:number; confirmedCount:number; documentName:string; areaLabel:string;
 selectionDisabled:boolean; confirmDisabled:boolean; cancelDisabled:boolean;
 onSelectAll:(checked:boolean)=>void; onConfirm:()=>void; onCancel:()=>void;
};
/** Common decision controls for PBOM, TRR, readiness and work review. */
export default function ReviewDecisionActions({selectedCount,totalCount,confirmedCount,documentName,areaLabel,selectionDisabled,confirmDisabled,cancelDisabled,onSelectAll,onConfirm,onCancel}:Props){
 const [cancelOpen,setCancelOpen]=useState(false);
 const checkbox=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(checkbox.current)checkbox.current.indeterminate=selectedCount>0&&selectedCount<totalCount},[selectedCount,totalCount]);
 return <div className="review-decision-actions" role="group" aria-label="검토 및 확정">
  <label className="review-select-all"><input ref={checkbox} type="checkbox" checked={totalCount>0&&selectedCount===totalCount} disabled={selectionDisabled} onChange={e=>onSelectAll(e.target.checked)}/>전체 검토</label>
  <button type="button" className="wv2-panel-save" disabled={confirmDisabled} onClick={onConfirm}><Check size={18}/>선택 {selectedCount}개 확정</button>
  <button type="button" className={confirmedCount?"review-withdraw-action":""} disabled={cancelDisabled} onClick={()=>setCancelOpen(true)}><Undo2 size={18}/>확정 취소 반영</button>
  {cancelOpen&&<CancelReviewDialog documentName={documentName} areaLabel={areaLabel} count={confirmedCount} disabled={cancelDisabled} onClose={()=>setCancelOpen(false)} onConfirm={()=>{setCancelOpen(false);onCancel()}}/>}
 </div>;
}

function CancelReviewDialog({documentName,areaLabel,count,disabled,onClose,onConfirm}:{documentName:string;areaLabel:string;count:number;disabled:boolean;onClose:()=>void;onConfirm:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close()},[]);
 return <dialog ref={dialog} className="wv2-module-dialog review-withdraw-dialog" aria-labelledby="review-withdraw-title" aria-describedby="review-withdraw-description" onCancel={e=>{e.preventDefault();onClose()}}>
  <header><h2 id="review-withdraw-title">확정 취소 확인</h2></header>
  <p className="review-withdraw-document">{documentName}</p>
  <p id="review-withdraw-description">이 문서의 {areaLabel} {count}건을 확정 취소할까요?</p>
  <p>원본·분석 초안·이력은 유지됩니다.</p>
  <footer><button type="button" autoFocus onClick={onClose}>돌아가기</button><button type="button" className="review-withdraw-action" disabled={disabled} onClick={onConfirm}>확정 취소 반영</button></footer>
 </dialog>;
}
