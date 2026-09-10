import {createCustomerDataRepository,type CustomerDataScope} from '../db/repositories/customer-data-repository';
import {createCustomerReviewRepository} from '../db/repositories/customer-review-repository';
import {getStorageAdapter} from '../lib/storage-adapter';
import {CustomerDataError} from '../lib/customer-data-contract';
import {validateReviewDraft} from '../lib/customer-review-contract';
import {requestCustomerReview,type ReviewFile} from './customer-review-provider';
export function customerFileMime(name:string){const ext=name.toLowerCase().split('.').pop();return ({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',txt:'text/plain',csv:'text/plain',md:'text/plain'} as Record<string,string>)[ext||'']||'application/octet-stream';}
export function createCustomerReviewService(raw=createCustomerDataRepository(),reviews=createCustomerReviewRepository(),storage=getStorageAdapter(),provider=requestCustomerReview){return {
 list:(s:CustomerDataScope)=>reviews.list(s),
 async analyze(s:CustomerDataScope,recordId:string,ids:string[],message:string){
 const permission=await raw.access(s);if(!permission.canReview)throw new CustomerDataError('PM 또는 PL만 분석할 수 있습니다.',403);
 if(typeof recordId!=='string'||!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||!ids.includes(recordId)||!ids.length||ids.length>5||typeof message!=='string'||!message.trim()||message.length>8000)throw new CustomerDataError('기준 문서 포함 1~5개와 질문을 선택하세요.');
 const unique=[...new Set(ids)],files:ReviewFile[]=[];let total=0;
 for(const id of unique){const record=await raw.get(s,id);const mime=customerFileMime(record.fileName);if(mime==='application/octet-stream')throw new CustomerDataError(`${record.fileName}: 현재 내용 분석은 PDF·PNG·JPEG·WebP·텍스트를 지원합니다. PDF로 변환해 등록하세요.`,422);if(record.fileSize>12*1024*1024||(total+=record.fileSize)>30*1024*1024)throw new CustomerDataError('AI 분석은 파일당 12MB, 선택 합계 30MB까지 가능합니다.',413);const obj=await storage.get(record.fileKey);if(!obj)throw new CustomerDataError('원본 파일을 찾을 수 없습니다.',404);files.push({id,fileName:record.fileName,mime,bytes:Buffer.from(await new Response(obj.body).arrayBuffer())});}
 const current=(await reviews.list(s)).reviews.find(r=>r.recordId===recordId);
 const prompt=`기준 문서 ID ${recordId}. 나머지는 비교 자료다. 문서 유형, 도면번호, 문서 표기의 Revision(모르면 빈 문자열), 변경·누락·불확실 사항을 분석한다. 부품·ASSY·수량은 pbom, 기술 요구조건은 trr, 생산준비 확인사항은 readiness, 원본의 작업·검사 기준은 work로 분류한다. 모든 항목 source에 파일명·페이지·표/주기 위치를 명시한다. 같은 항목을 수정할 때 id를 유지한다. 문서 관계는 확정하지 말고 설명한다. 다음 JSON을 완전한 최신 초안으로 반환한다: {"answer":"사용자에게 설명","draft":{"documentType":"unclassified|drawing|bom|specification|requirement|report|work_instruction|inspection|other","drawingNumber":"","revisionLabel":"","summary":"","uncertainties":[],"items":[{"id":"고유항목ID","area":"pbom|trr|readiness|work","title":"항목명","detail":"추출값·부품번호·상위ASSY·수량·단위 또는 기준 내용","source":"원본 근거 위치","recordId":"선택 원본 ID"}]}}\n현재 초안: ${JSON.stringify(current?.draft??null)}\n이전 대화: ${JSON.stringify(current?.messages.slice(-8)??[])}\n사용자 요청: ${message}`;
 const result=await provider(prompt,files);let draft;try{draft=validateReviewDraft(result.draft,unique);}catch{throw new CustomerDataError('AI 결과의 항목·근거 형식이 올바르지 않아 저장하지 않았습니다.',422);}
 const answer=String(result.answer||'분석 초안을 갱신했습니다. 근거를 확인한 후 확정하세요.');
 const review=await reviews.save(s,recordId,current?.version??0,draft,[...(current?.messages??[]),{role:'user',content:message},{role:'assistant',content:answer}]);
 return {answer,review};
 },
 async save(s:CustomerDataScope,id:string,input:any){await raw.get(s,id);const current=(await reviews.list(s)).reviews.find(r=>r.recordId===id);if(!current)throw new CustomerDataError('먼저 AI 분석을 실행하세요.');const allowed=(await raw.list(s)).records.map(r=>r.id);let draft;try{draft=validateReviewDraft(input.draft,allowed);}catch(e){throw new CustomerDataError((e as Error).message);}return reviews.save(s,id,input.version,draft,current.messages);},
 async confirm(s:CustomerDataScope,id:string,input:any){await raw.get(s,id);if(!Number.isInteger(input.version)||!Array.isArray(input.itemIds)||input.itemIds.some((x:unknown)=>typeof x!=='string'))throw new CustomerDataError('확정 요청을 확인하세요.');return reviews.confirm(s,id,input.version,input.itemIds);}
};}
