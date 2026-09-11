export const TRR_SECTIONS=['일반 기술정보','자재','제작·용접·NDT','표면처리','조립','품질·검사','보관·운송·안전','변경·주의사항'] as const;
export type TrrFact={id?:string;kind?:'current'|'historical';section:typeof TRR_SECTIONS[number];title:string;detail:string;reference:string};
export type TrrSource={id:string;rawDataId:string;fileName:string;checksum:string;revision:number;reviewVersion?:number;kind:'current'|'historical';summary:string;facts:TrrFact[]};
export type TrrDocument={projectName:string;version?:number;sources:TrrSource[]};
export type TrrVersion={id:string;version:number;summary:string;createdAt:number;createdBy:string;sourceCount:number};
export type TrrStatus={status:string;error:string|null;updatedAt:number}|null;
export type TrrList={versions:TrrVersion[];job:TrrStatus;canGenerate:boolean;appliedSources?:{id:string;reviewVersion?:number;factCount:number}[]};
export const trrVersionLabel=(version:number)=>`V${String(version).padStart(3,'0')}`;
export function validateTrrExtraction(value:unknown):Pick<TrrSource,'kind'|'summary'|'facts'>{
 const v=value as Pick<TrrSource,'kind'|'summary'|'facts'>;
 if(!v||!['current','historical'].includes(v.kind)||typeof v.summary!=='string'||!v.summary.trim()||v.summary.length>500||!Array.isArray(v.facts)||v.facts.length>150||!v.facts.length)throw Error('TRR 추출 형식 또는 내용이 비어 있습니다.');
 const sectionKey=(s:string)=>s.normalize('NFKC').replace(/[\s·ㆍ・/,&＋+\-]/g,'').toUpperCase();
 const facts=v.facts.map((f,index)=>{
  if(!f||typeof f.section!=='string')throw Error(`TRR ${index+1}번 항목: section(본문 분류)이 없습니다.`);
  const section=TRR_SECTIONS.find(s=>sectionKey(s)===sectionKey(f.section));
  if(!section)throw Error(`TRR ${index+1}번 항목: section(본문 분류)이 지정된 분류와 일치하지 않습니다.`);
  for(const [field,label] of [['title','제목'],['detail','본문'],['reference','출처']] as const){
   if(typeof f[field]!=='string'||!f[field].trim())throw Error(`TRR ${index+1}번 항목: ${field}(${label})가 비어 있습니다.`);
   if(f[field].length>6000)throw Error(`TRR ${index+1}번 항목: ${field}(${label})가 6,000자를 초과합니다.`);
  }
  return {section,title:f.title.trim(),detail:f.detail.trim(),reference:f.reference.trim()};
 });
 if(JSON.stringify(v).length>150000)throw Error('TRR 추출 내용이 너무 큽니다.');
 return {kind:v.kind,summary:v.summary.trim(),facts};
}
export function trrChangeSummary(previous:TrrSource[],current:TrrSource[]){
 const added=current.filter(s=>!previous.some(p=>p.rawDataId===s.rawDataId));
 const changed=current.filter(s=>previous.some(p=>p.rawDataId===s.rawDataId&&(p.checksum!==s.checksum||JSON.stringify(p.facts)!==JSON.stringify(s.facts)||p.reviewVersion!==s.reviewVersion)));
 const removed=previous.filter(p=>!current.some(s=>s.rawDataId===p.rawDataId));
 const parts=[!previous.length?'최초 작성':'',added.length?`자료 ${added.length}건 추가`:'',changed.length?`자료 ${changed.length}건 갱신`:'',removed.length?`자료 ${removed.length}건 제외`:''].filter(Boolean);
 const topics=[...new Set([...added,...changed].flatMap(s=>s.facts.map(f=>f.section)))];
 return `${parts.join(' · ')}${topics.length?` — ${topics.join(', ')}`:''}`;
}
