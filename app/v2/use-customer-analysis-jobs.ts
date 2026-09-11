"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {isAnalysisPending,type CustomerAnalysisJob} from '../../lib/customer-analysis-job';

export function useCustomerAnalysisJobs(url:string,onCompleted:()=>void){
 const [jobs,setJobs]=useState<CustomerAnalysisJob[]>([]),[pollError,setPollError]=useState('');
 const submitting=useRef(new Set<string>()),seen=useRef(new Set<string>()),activeUrl=useRef(url);
 activeUrl.current=url;
 useEffect(()=>{
  let disposed=false;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  seen.current.clear();submitting.current.clear();setJobs([]);setPollError('');
  const poll=async()=>{
   const polledAt=Date.now();
   try{
    const response=await fetch(`${url}/analysis-jobs`,{signal:controller.signal,cache:'no-store'}),data=await response.json();
    if(!response.ok)throw Error(data.error||'분석 상태를 불러오지 못했습니다.');
    if(disposed)return;
    setPollError('');
    setJobs(previous=>{
     const fresh=data.jobs as CustomerAnalysisJob[];
     const retained=previous.filter(j=>submitting.current.has(j.recordId)||j.startedAt>=polledAt||(j.id.startsWith('submitting:')&&j.status==='failed'));
     const missing=previous.filter(j=>!retained.includes(j)&&isAnalysisPending(j)&&!fresh.some(n=>n.recordId===j.recordId)).map(j=>({...j,status:'failed' as const,error:'진행 중인 분석을 찾을 수 없습니다. 서버 재시작 여부를 확인하고 다시 분석하세요.'}));
     return [...fresh.filter(j=>!retained.some(n=>n.recordId===j.recordId)),...retained,...missing];
    });
    let completed=false;
    for(const job of data.jobs as CustomerAnalysisJob[])if(job.status==='completed'&&!seen.current.has(job.id)){seen.current.add(job.id);completed=true;}
    if(completed)onCompleted();
   }catch(reason){if(!disposed)setPollError(reason instanceof Error?reason.message:'분석 상태 조회 실패');}
   finally{if(!disposed)timer=setTimeout(poll,3000);}
  };
  void poll();
  return()=>{disposed=true;controller.abort();clearTimeout(timer);};
 },[url,onCompleted]);
 const start=useCallback(async(recordId:string,message:string)=>{
  if(submitting.current.has(recordId))return;
  submitting.current.add(recordId);
  const pending:CustomerAnalysisJob={id:`submitting:${recordId}`,recordId,status:'queued',startedAt:Date.now()};
  setJobs(values=>[...values.filter(j=>j.recordId!==recordId),pending]);
  try{
   const response=await fetch(`${url}/analysis-jobs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recordId,message})}),data=await response.json();
   if(!response.ok)throw Error(data.error||'분석을 시작하지 못했습니다.');
   if(activeUrl.current===url)setJobs(values=>[...values.filter(j=>j.recordId!==recordId),data.job]);
  }catch(reason){
   if(activeUrl.current===url)setJobs(values=>[...values.filter(j=>j.recordId!==recordId),{...pending,status:'failed',error:reason instanceof Error?reason.message:'분석 요청 실패'}]);
  }finally{if(activeUrl.current===url)submitting.current.delete(recordId);}
 },[url]);
 return {jobs,start,pollError,isPending:(id:string)=>submitting.current.has(id)||isAnalysisPending(jobs.find(j=>j.recordId===id))};
}
