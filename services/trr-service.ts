import {createHash,randomUUID} from 'node:crypto';
import {createTrrRepository} from '../db/repositories/trr-repository';
import {createCustomerDataRepository,type CustomerDataScope} from '../db/repositories/customer-data-repository';
import {createCustomerReviewRepository} from '../db/repositories/customer-review-repository';
import {getStorageAdapter} from '../lib/storage-adapter';
import {CustomerDataError} from '../lib/customer-data-contract';
import {trrChangeSummary,trrVersionLabel,type TrrSource} from '../lib/trr-contract';
import {validateReviewDraft} from '../lib/customer-review-contract';
import {createTrrDocx,previewTrr} from './trr-document';

export function createTrrService(repo=createTrrRepository(),raw=createCustomerDataRepository(),storage=getStorageAdapter(),reviews=createCustomerReviewRepository()){
 return {
  async list(s:CustomerDataScope){const state=await repo.list(s);return {canGenerate:state.canGenerate,appliedSources:state.versions[0]?.document.sources.map(src=>({id:src.id,reviewVersion:src.reviewVersion,factCount:src.facts.length}))??[],job:state.job?{status:state.job.status==='running'&&state.job.updatedAt<Math.floor(Date.now()/1000)-600?'failed':state.job.status,error:state.job.status==='running'&&state.job.updatedAt<Math.floor(Date.now()/1000)-600?'Word 생성이 중단되었습니다. AI Data Review에서 다시 반영해 주세요.':state.job.error,updatedAt:state.job.updatedAt}:null,versions:state.versions.map(v=>({id:v.id,version:v.version,summary:v.summary,createdAt:v.createdAt,createdBy:v.createdBy,sourceCount:v.document.sources.length}))};},
  async generate(s:CustomerDataScope,input:{recordId:string;version:number;itemIds?:string[];action?:'confirm'|'cancel';wordVersion?:number}){
   const permission=await raw.access(s);if(!permission.canReview)throw new CustomerDataError('PM 또는 PL만 TRR에 반영할 수 있습니다.',403);
   if(!input||typeof input.recordId!=='string'||!input.recordId||!Number.isInteger(input.version))throw new CustomerDataError('검토한 문서와 분석 버전을 선택하세요.');
   if(input.action!==undefined&&!['confirm','cancel'].includes(input.action))throw new CustomerDataError('TRR 반영 동작을 확인하세요.');
   if(input.itemIds!==undefined&&(!Array.isArray(input.itemIds)||!input.itemIds.length||input.itemIds.some(id=>typeof id!=='string')||new Set(input.itemIds).size!==input.itemIds.length))throw new CustomerDataError('확정할 TRR 항목을 선택하세요.');
   const record=await raw.get(s,input.recordId);
   if(!['ttr','bom','input'].includes(record.sourcePurpose??'input'))throw new CustomerDataError('원본 자료만 반영할 수 있습니다.');
   const current=(await reviews.list(s)).reviews.find(r=>r.recordId===record.id);
   if(!current||current.version!==input.version)throw new CustomerDataError('분석 결과가 변경되었습니다. 최신 내용을 다시 확인하세요.',409);
   const draft=validateReviewDraft(current.draft,[record.id]),items=draft.items.filter(i=>i.area==='trr');
   if(!items.length)throw new CustomerDataError('TRR 추출 내용을 먼저 확인하세요.');
   if(input.itemIds?.some(id=>!items.some(item=>item.id===id)))throw new CustomerDataError('선택 항목이 최신 분석에 없습니다.',409);
   const token=await repo.claim(s);if(!token)throw new CustomerDataError('다른 Word 반영 작업이 진행 중입니다. 완료 후 다시 반영하세요.',409);
   let fileKey:string|undefined;
   try{
    const state=await repo.list(s),latest=state.versions[0];
    if(input.wordVersion!==undefined&&input.wordVersion!==(latest?.version??0))throw new CustomerDataError('Word 버전이 변경되었습니다. 새로고침 후 다시 반영하세요.',409);
    const previous=latest?.document.sources.find(src=>src.rawDataId===record.rawDataId);
    const chosen=input.itemIds?items.filter(item=>input.itemIds!.includes(item.id)):items;
    const newFacts=chosen.map(i=>({id:i.id,kind:i.trrKind,section:i.trrSection!,title:i.title,detail:i.detail,reference:i.source}));
    const retained=input.itemIds?(previous?.facts??[]).filter(old=>!newFacts.some(next=>(previous?.reviewVersion===current.version&&next.id===old.id)||(next.section===old.section&&next.title===old.title))):[];
    const source:TrrSource={id:record.id,rawDataId:record.rawDataId,fileName:record.fileName,checksum:record.checksum,revision:record.revision,reviewVersion:current.version,kind:items.every(i=>i.trrKind==='historical')?'historical':'current',summary:draft.summary,facts:[...retained,...newFacts]};
    if(input.itemIds&&!items.every(item=>source.facts.some(f=>f.section===item.trrSection&&f.title===item.title&&f.detail===item.detail&&f.reference===item.source)))source.reviewVersion=undefined;
    // Replace this document's reviewed snapshot; preserve other sources and old Word versions.
    if(input.action==='cancel'&&!previous)throw new CustomerDataError('이 문서에 확정된 TRR 항목이 없습니다.');
    const sources=[...(latest?.document.sources??[]).filter(src=>src.rawDataId!==source.rawDataId),...(input.action==='cancel'?[]:[source])].sort((a,b)=>a.rawDataId.localeCompare(b.rawDataId));
    const fingerprint=createHash('sha256').update(JSON.stringify(sources)).digest('hex');
    if(latest?.fingerprint===fingerprint){await repo.finish(s,token,null);return {version:latest.version,duplicate:true};}
    const document={projectName:await repo.projectName(s),version:(latest?.version??0)+1,sources};
    const summary=record.fileName+' · 분석 v'+current.version+(input.action==='cancel'?' 확정 취소 · ':' 선택 확정 · ')+trrChangeSummary(latest?.document.sources??[],sources),id=randomUUID();
    fileKey=`trr/${s.companyId}/${s.projectId}/${id}.docx`;
    await repo.heartbeat(s,token);
    const bytes=createTrrDocx(document);await storage.put(fileKey,new Uint8Array(bytes).buffer,{httpMetadata:{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}});
    const saved=await repo.save(s,token,{id,fingerprint,summary,document,fileKey});
    if(saved.duplicate)await storage.delete(fileKey);
    fileKey=undefined;await repo.finish(s,token,null);
    return {version:saved.row.version,duplicate:saved.duplicate};
   }catch(reason){if(fileKey)await storage.delete(fileKey).catch(()=>{});const error=reason instanceof Error?reason.message:'Word 생성에 실패했습니다.';await repo.finish(s,token,error);throw reason;}
  },
  async preview(s:CustomerDataScope,id:string){const v=await repo.get(s,id);return previewTrr(v.document,trrVersionLabel(v.version));},
  async download(s:CustomerDataScope,id:string){const v=await repo.get(s,id),file=await storage.get(v.fileKey);if(!file)throw new CustomerDataError('TRR 파일을 찾을 수 없습니다.',404);return {body:file.body,name:`J_SOLUTION_TRR_${trrVersionLabel(v.version)}.docx`};},
  async comparison(s:CustomerDataScope,ids:unknown){
   if(!Array.isArray(ids)||ids.length<2||ids.length>5||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw new CustomerDataError('비교할 TRR 버전을 2~5개 선택해 주세요.');
   const versions=await Promise.all(ids.map(id=>repo.get(s,id)));versions.sort((a,b)=>a.version-b.version);
   const text=JSON.stringify(versions.map(v=>({id:v.id,version:trrVersionLabel(v.version),summary:v.summary,document:v.document})));
   if(text.length>500000)throw new CustomerDataError('비교 자료가 큽니다. 선택 버전을 줄여 주세요.',413);
   return {text,items:versions.map(v=>({id:v.id,projectId:s.projectId,kind:'TRR 버전',title:`${v.document.projectName} TRR ${trrVersionLabel(v.version)}`}))};
  },
 };
}
