export type CustomerAnalysisJob={
 id:string;recordId:string;status:'queued'|'running'|'completed'|'failed';
 startedAt:number;finishedAt?:number;error?:string;
};
export const isAnalysisPending=(job?:CustomerAnalysisJob)=>job?.status==='queued'||job?.status==='running';

export const analysisJobLabel=(job?:CustomerAnalysisJob)=>job?({queued:'분석 대기 중',running:'AI 분석 중',completed:'AI 분석 완료',failed:'AI 분석 실패'}[job.status]):'';
