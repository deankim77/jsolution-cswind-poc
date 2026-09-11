import {randomUUID} from 'node:crypto';
import {createCustomerDataRepository,type CustomerDataScope} from '../db/repositories/customer-data-repository';
import {createCustomerReviewService} from './customer-review-service';
import {CustomerDataError} from '../lib/customer-data-contract';
import {isAnalysisPending,type CustomerAnalysisJob} from '../lib/customer-analysis-job';

type Entry={companyId:string;projectId:string;job:CustomerAnalysisJob};
// Runtime work belongs to the Node server, never to a browser request or component.
// Completed drafts are persisted by the existing review service. Restarted servers
// discard unfinished jobs; they never automatically retry a possibly billed request.
const runtime=globalThis as typeof globalThis&{__customerAnalysisJobs?:Map<string,Entry>};
const jobs=runtime.__customerAnalysisJobs??=new Map<string,Entry>();
const key=(scope:CustomerDataScope,id:string)=>JSON.stringify([scope.companyId,scope.projectId,id]);
export function createCustomerAnalysisJobs(raw=createCustomerDataRepository(),review=createCustomerReviewService(),store=jobs){
 const clean=()=>{for(const [id,entry] of store)if(entry.job.finishedAt&&Date.now()-entry.job.finishedAt>30*60*1000)store.delete(id);};
 return {
  async list(scope:CustomerDataScope){
   await raw.access(scope);clean();
   return [...store.values()].filter(e=>e.companyId===scope.companyId&&e.projectId===scope.projectId).map(e=>({...e.job}));
  },
  async start(scope:CustomerDataScope,recordId:unknown,message:unknown){
   if(typeof recordId!=='string'||!recordId||typeof message!=='string'||!message.trim()||message.length>8000)throw new CustomerDataError('원본 문서와 분석 요청을 확인하세요.');
   const permission=await raw.access(scope);
   if(!permission.canReview)throw new CustomerDataError('PM 또는 PL만 분석할 수 있습니다.',403);
   await raw.get(scope,recordId);clean();
   const jobKey=key(scope,recordId),existing=store.get(jobKey);
   if(existing&&isAnalysisPending(existing.job))return {...existing.job};
   if([...store.values()].filter(e=>isAnalysisPending(e.job)).length>=2)throw new CustomerDataError('현재 다른 문서를 분석 중입니다. 진행 중인 분석이 끝나면 다시 요청하세요.',429);
   const job:CustomerAnalysisJob={id:randomUUID(),recordId,status:'queued',startedAt:Date.now()};
   store.set(jobKey,{companyId:scope.companyId,projectId:scope.projectId,job});
   console.info('Customer analysis job',JSON.stringify({event:'accepted',jobId:job.id,projectId:scope.projectId,recordId}));
   setTimeout(()=>{
    job.status='running';
    void review.analyze(scope,recordId,[recordId],message).then(()=>{
     job.status='completed';job.finishedAt=Date.now();
     console.info('Customer analysis job',JSON.stringify({event:'saved',jobId:job.id,recordId,elapsedMs:job.finishedAt-job.startedAt}));
    }).catch(reason=>{
     job.status='failed';job.finishedAt=Date.now();
     job.error=reason instanceof CustomerDataError?reason.message:'AI 분석 처리에 실패했습니다. 서버의 분석 로그를 확인하세요.';
     console.error('Customer analysis job',JSON.stringify({event:'failed',jobId:job.id,recordId,elapsedMs:job.finishedAt-job.startedAt,errorType:reason instanceof Error?reason.name:'unknown',status:reason instanceof CustomerDataError?reason.status:500}));
    });
   },0);
   return {...job};
  }
 };
}
