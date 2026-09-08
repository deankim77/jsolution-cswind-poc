/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";
import type {RuntimeD1} from "../../../../db/project-data-foundation";
import {getStorageAdapter} from "../../../../lib/storage-adapter";
import {getLegacyDbCompat} from "../../../../db/postgres-d1-compat";

type R2Object={body:ReadableStream};
type R2Bucket={get:(key:string)=>Promise<R2Object|null>};
type RuntimeEnv={DB:RuntimeD1;FILES?:R2Bucket};
type Input={projectId?:string;deliverableId?:string;versionId?:string;versionIds?:string[];message?:string};
const MAX_FILE_BYTES=12*1024*1024;
const MAX_TOTAL_BYTES=24*1024*1024;
const MAX_REVISIONS=4;

async function runtime(){return {DB:getLegacyDbCompat() as unknown as RuntimeD1,FILES:getStorageAdapter() as unknown as R2Bucket} satisfies RuntimeEnv;}
function bytesToBase64(bytes:Uint8Array){let binary="";const chunk=0x8000;for(let offset=0;offset<bytes.length;offset+=chunk)binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+chunk,bytes.length)));return btoa(binary);}
function outputText(data:any){if(data.output_text?.trim())return data.output_text.trim();return (data.output||[]).flatMap((item:any)=>item.content||[]).filter((item:any)=>item.type==="output_text"&&item.text).map((item:any)=>String(item.text).trim()).filter(Boolean).join("\n").trim();}

export async function POST(request:Request){
  const {DB:db,FILES}=await runtime();
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as Input,projectId=input.projectId?.trim(),deliverableId=input.deliverableId?.trim(),message=input.message?.trim();
  const requested=[...(Array.isArray(input.versionIds)?input.versionIds:[]),...(input.versionId?[input.versionId]:[])].map(value=>String(value||"").trim()).filter(Boolean);
  const versionIds=[...new Set(requested)].slice(0,MAX_REVISIONS);
  if(!projectId||!deliverableId||!versionIds.length||!message)return Response.json({error:"프로젝트, 문서, Revision, 질문 정보가 필요합니다."},{status:400});
  if(!FILES)return Response.json({error:"파일 저장소가 연결되지 않았습니다."},{status:503});
  const placeholders=versionIds.map(()=>"?").join(",");
  const rows=await db.prepare(`SELECT p.name AS projectName,d.name AS documentName,v.id AS versionId,v.revision,v.file_key AS fileKey,v.file_name AS fileName,v.file_size AS fileSize,v.content_type AS contentType,v.note FROM deliverable_versions v JOIN deliverables d ON d.id=v.deliverable_id JOIN projects p ON p.id=d.project_id WHERE p.company_id=? AND p.id=? AND d.id=? AND v.id IN (${placeholders}) AND v.deleted_at IS NULL ORDER BY v.revision ASC`).bind(context.companyId,projectId,deliverableId,...versionIds).all();
  const selected=(rows.results??[]) as any[];
  if(selected.length!==versionIds.length)return Response.json({error:"선택한 문서 Revision 중 일부를 찾을 수 없습니다."},{status:404});
  if(selected.some(row=>Number(row.fileSize||0)>MAX_FILE_BYTES))return Response.json({error:"AI 분석 가능한 개별 파일 크기(12MB)를 초과한 Revision이 있습니다."},{status:413});
  const contents:any[]=[];let totalBytes=0;
  for(const row of selected){const object=await FILES.get(String(row.fileKey));if(!object)return Response.json({error:`Rev.${String(row.revision).padStart(2,"0")} 원본 파일을 찾을 수 없습니다.`},{status:404});const buffer=await new Response(object.body).arrayBuffer();if(!buffer.byteLength)return Response.json({error:`Rev.${String(row.revision).padStart(2,"0")} 원본 파일이 비어 있습니다.`},{status:400});if(buffer.byteLength>MAX_FILE_BYTES)return Response.json({error:"AI 분석 가능한 개별 파일 크기(12MB)를 초과했습니다."},{status:413});totalBytes+=buffer.byteLength;if(totalBytes>MAX_TOTAL_BYTES)return Response.json({error:"선택한 Revision 파일의 합계가 AI 분석 한도(24MB)를 초과했습니다."},{status:413});const mime=String(row.contentType||"application/octet-stream");contents.push({type:"input_text",text:`[Rev.${String(row.revision).padStart(2,"0")}] 파일: ${row.fileName} / 변경 메모: ${row.note||"없음"}`},{type:"input_file",filename:`Rev.${String(row.revision).padStart(2,"0")}_${String(row.fileName||"document")}`,file_data:`data:${mime};base64,${bytesToBase64(new Uint8Array(buffer))}`});}
  const apiKey=process.env.OPENAI_API_KEY?.trim();if(!apiKey)return Response.json({error:"OPENAI_API_KEY가 설정되지 않았습니다."},{status:503});
  const model=process.env.OPENAI_MODEL?.trim()||"gpt-5-mini",first=selected[0],revisionLabel=selected.map(row=>`Rev.${String(row.revision).padStart(2,"0")}`).join(", ");
  const developer=`당신은 제조 프로젝트 문서를 검토하는 J SOLUTION AI PLM 문서 분석 도우미입니다. 반드시 첨부된 정확한 Revision 원본 파일만 근거로 답하십시오. 여러 Revision이 첨부되면 각 Revision의 차이를 명확히 구분하고, 변경점·변경 영향·검토 필요사항을 Revision 번호와 함께 표시하십시오. 파일에서 확인되지 않는 내용은 추측하지 말고 확인되지 않는다고 명시하십시오. 프로젝트: ${first.projectName}. 문서: ${first.documentName}. 선택 Revision: ${revisionLabel}. 답변은 한국어로 간결하고 실무적으로 작성하십시오.`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,store:false,reasoning:{effort:"minimal"},max_output_tokens:1000,input:[{role:"developer",content:developer},{role:"user",content:[{type:"input_text",text:message},...contents]}]})});
  const data=await response.json() as any;if(!response.ok)return Response.json({error:data.error?.message||`OpenAI API 오류 (${response.status})`},{status:502});const answer=outputText(data);if(!answer)return Response.json({error:"AI 응답 내용이 비어 있습니다."},{status:502});
  return Response.json({ok:true,answer,revisions:selected.map(row=>({id:row.versionId,revision:Number(row.revision),fileName:String(row.fileName||"")})),model});
}
