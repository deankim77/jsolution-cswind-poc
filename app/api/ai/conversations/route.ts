/* eslint-disable @typescript-eslint/no-explicit-any */
import { getChatGPTUser } from "../../../chatgpt-auth";
import { buildAiGovernancePrompt } from "../ai-governance";
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";
import {getStorageAdapter} from "../../../../lib/storage-adapter";
import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";

const MAX_CONTEXT_FILE_BYTES = 12 * 1024 * 1024;
const MAX_CONTEXT_FILES = 5;
const MAX_HISTORY_MESSAGES = 6;
const MAX_OUTPUT_TOKENS = 500;
const PROMPT_CACHE_KEY = "jsolution-ai-pms-governance-v4-fast";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: () => Promise<{ results?: any[] }>;
  first: <T = any>() => Promise<T | null>;
  run: () => Promise<unknown>;
};
type D1 = {
  prepare: (sql: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<unknown>;
};
type R2Object = { body: ReadableStream };
type R2Bucket = { get: (key: string) => Promise<R2Object | null> };
type ContextItem={id?:string;kind?:string;title?:string;meta?:string;fileName?:string;revision?:number;fileAttached?:boolean};
type ContextFile={deliverableId:string;title:string;fileName:string;contentType?:string;revision:number;bytes:number;fileData:string};
type OpenAIResponse={id?:string;output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>;error?:{message?:string}};

function parseArray<T>(value:unknown):T[]{
  if(Array.isArray(value))return value as T[];
  if(typeof value!=="string"||!value.trim())return [];
  try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed as T[]:[];}catch{return [];}
}

async function runtime(): Promise<{DB:D1;FILES?:R2Bucket}> {
  return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};
}

function aiConnectionMessage(detail:string){
  if(/api key|authentication|unauthorized|401/i.test(detail))return "OpenAI 인증 설정을 확인해 주세요.";
  if(/quota|billing|rate limit|429/i.test(detail))return "OpenAI 사용 한도 또는 요청 제한을 확인해 주세요.";
  if(/model|not found|404/i.test(detail))return "OpenAI 모델 설정을 확인해 주세요.";
  return "AI 서비스 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

async function ensureAiWorkspace(db: D1) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_conversations (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      user_id text NOT NULL,
      title text NOT NULL,
      source text NOT NULL,
      context_type text NOT NULL,
      context_title text NOT NULL,
      context_items text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_messages (
      id text PRIMARY KEY NOT NULL,
      conversation_id text NOT NULL,
      role text NOT NULL,
      content text NOT NULL,
      citations text,
      created_at integer NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx ON ai_conversations (company_id, user_id, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx ON ai_messages (conversation_id, created_at)"),
  ]);
  const columns=await db.prepare("PRAGMA table_info(ai_conversations)").all();
  if(!(columns.results??[]).some((column:any)=>column.name==="group_name"))try{await db.prepare("ALTER TABLE ai_conversations ADD COLUMN group_name text").run()}catch{/* concurrent first migration already added the column */}
}

function bytesToBase64(bytes:Uint8Array){let binary="";const chunk=0x8000;for(let offset=0;offset<bytes.length;offset+=chunk){binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+chunk,bytes.length)));}return btoa(binary);}
function toFileDataUrl(file:ContextFile){const mime=file.contentType?.trim()||"application/octet-stream";return `data:${mime};base64,${file.fileData}`;}
function projectNameFromContext(contextTitle:string){const title=(contextTitle||"").trim();if(!title)return "";return title.split(" · 선택 문맥")[0].split(" · 원본 파일")[0].trim();}

async function findDeliverableVersion(db:D1,item:ContextItem,projectName:string,companyId:string){
  if(item.id&&!item.id.startsWith("panel-")){
    const exact=await db.prepare(`SELECT d.id AS deliverableId,d.name AS title,v.file_key AS fileKey,v.file_name AS fileName,v.file_size AS fileSize,v.content_type AS contentType,v.revision FROM deliverables d JOIN projects p ON p.id=d.project_id JOIN deliverable_versions v ON v.deliverable_id=d.id WHERE d.id=? AND p.company_id=? AND v.deleted_at IS NULL ORDER BY v.revision DESC LIMIT 1`).bind(item.id,companyId).first<any>();if(exact)return exact;
  }
  const title=item.title?.trim();if(!title)return null;
  if(projectName){const scoped=await db.prepare(`SELECT d.id AS deliverableId,d.name AS title,v.file_key AS fileKey,v.file_name AS fileName,v.file_size AS fileSize,v.content_type AS contentType,v.revision FROM deliverables d JOIN projects p ON p.id=d.project_id JOIN deliverable_versions v ON v.deliverable_id=d.id WHERE p.company_id=? AND p.name=? AND d.name=? AND v.deleted_at IS NULL ORDER BY v.revision DESC LIMIT 1`).bind(companyId,projectName,title).first<any>();if(scoped)return scoped;}
  return db.prepare(`SELECT d.id AS deliverableId,d.name AS title,v.file_key AS fileKey,v.file_name AS fileName,v.file_size AS fileSize,v.content_type AS contentType,v.revision FROM deliverables d JOIN projects p ON p.id=d.project_id JOIN deliverable_versions v ON v.deliverable_id=d.id WHERE p.company_id=? AND d.name=? AND v.deleted_at IS NULL ORDER BY v.created_at DESC,v.revision DESC LIMIT 1`).bind(companyId,title).first<any>();
}

async function resolveContextFiles(db:D1,files:R2Bucket|undefined,items:ContextItem[],projectName:string,companyId:string){
  if(!files)return [] as ContextFile[];
  const deliverables=items.filter(item=>item.kind==="산출물"||item.kind==="문서").slice(0,MAX_CONTEXT_FILES),resolved:ContextFile[]=[];
  for(const item of deliverables){const version=await findDeliverableVersion(db,item,projectName,companyId);if(!version?.fileKey||Number(version.fileSize||0)>MAX_CONTEXT_FILE_BYTES)continue;const object=await files.get(String(version.fileKey));if(!object)continue;const buffer=await new Response(object.body).arrayBuffer();if(!buffer.byteLength||buffer.byteLength>MAX_CONTEXT_FILE_BYTES)continue;resolved.push({deliverableId:String(version.deliverableId),title:String(version.title||item.title||"산출물"),fileName:String(version.fileName||"document"),contentType:version.contentType?String(version.contentType):undefined,revision:Number(version.revision||0),bytes:buffer.byteLength,fileData:bytesToBase64(new Uint8Array(buffer))});}
  return resolved;
}

function systemPrompt(contextTitle:string,items:ContextItem[],files:ContextFile[]){return buildAiGovernancePrompt({scopeLabel:"대화 문맥",scopeValue:contextTitle||"MY AI 대화",items,files,followUp:true});}
function outputText(data:OpenAIResponse){if(data.output_text?.trim())return data.output_text.trim();return (data.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==="output_text"&&item.text).map(item=>item.text!.trim()).filter(Boolean).join("\n").trim();}
async function generateOpenAI(contextTitle:string,items:ContextItem[],files:ContextFile[],history:any[],message:string){
  const apiKey=process.env.OPENAI_API_KEY?.trim();if(!apiKey)throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  const model=process.env.OPENAI_MODEL?.trim()||"gpt-5-mini",userContent:any[]=[{type:"input_text",text:message}];
  for(const file of files)userContent.push({type:"input_file",filename:file.fileName,file_data:toFileDataUrl(file)});
  const input:any[]=[{role:"developer",content:systemPrompt(contextTitle,items,files)},...(history||[]).map((row:any)=>({role:row.role==="assistant"?"assistant":"user",content:String(row.content||"")})),{role:"user",content:userContent}];
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,input,store:false,reasoning:{effort:"minimal"},max_output_tokens:MAX_OUTPUT_TOKENS,prompt_cache_key:PROMPT_CACHE_KEY})});
  const data=await response.json() as OpenAIResponse;if(!response.ok)throw new Error(data.error?.message||`OpenAI API 오류 (${response.status})`);const answer=outputText(data);if(!answer)throw new Error("OpenAI 응답 내용이 비어 있습니다.");return {answer,model};
}

export async function GET(request: Request) {
  const authenticated=await getChatGPTUser();const {DB:db}=await runtime();await ensureAiWorkspace(db);let context;try{context=await resolveRequestContext(request,db,{email:authenticated?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}const conversationId=new URL(request.url).searchParams.get("id");
  if(conversationId){const conversation=await db.prepare(`SELECT id,title,source,context_type AS contextType,context_title AS contextTitle,context_items AS contextItems,group_name AS groupName,created_at AS createdAt,updated_at AS updatedAt FROM ai_conversations WHERE id=? AND company_id=? AND user_id=?`).bind(conversationId,context.companyId,context.userId).first<any>();if(!conversation)return Response.json({error:"대화를 찾을 수 없습니다."},{status:404});const messages=await db.prepare(`SELECT id,role,content,citations,created_at AS createdAt FROM ai_messages WHERE conversation_id=? ORDER BY created_at ASC,id ASC`).bind(conversationId).all();return Response.json({conversation:{...conversation,contextItems:parseArray<ContextItem>(conversation.contextItems)},messages:(messages.results??[]).map((row:any)=>({...row,citations:parseArray<unknown>(row.citations)}))});}
  const result=await db.prepare(`SELECT id,title,source,context_type AS contextType,context_title AS contextTitle,context_items AS contextItems,group_name AS groupName,created_at AS createdAt,updated_at AS updatedAt FROM ai_conversations WHERE company_id=? AND user_id=? ORDER BY updated_at DESC LIMIT 100`).bind(context.companyId,context.userId).all();return Response.json({conversations:(result.results??[]).map((row:any)=>({...row,contextItems:parseArray<ContextItem>(row.contextItems)}))});
}

export async function POST(request: Request) {
  const authenticated=await getChatGPTUser();
  const input=await request.json() as {id?:string;title?:string;source?:string;contextType?:string;contextTitle?:string;contextItems?:ContextItem[];message?:string};const message=input.message?.trim();if(!message)return Response.json({error:"대화 내용을 입력해 주세요."},{status:400});
  const {DB:db,FILES}=await runtime();await ensureAiWorkspace(db);let context;try{context=await resolveRequestContext(request,db,{email:authenticated?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}const now=Math.floor(Date.now()/1000),id=input.id||crypto.randomUUID();const existing=await db.prepare("SELECT id,title,context_title AS contextTitle,context_items AS contextItems FROM ai_conversations WHERE id=? AND company_id=? AND user_id=?").bind(id,context.companyId,context.userId).first<any>();
  const existingItems=existing?parseArray<ContextItem>(existing.contextItems):[],items=(input.contextItems?.length?input.contextItems:existingItems),contextTitle=input.contextTitle||existing?.contextTitle||"MY AI 대화";
  const historyResult=existing?await db.prepare(`SELECT role,content FROM ai_messages WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT ${MAX_HISTORY_MESSAGES}`).bind(id).all():{results:[] as any[]};const history=[...(historyResult.results||[])].reverse().filter(row=>!/OpenAI (파일 분석|응답|연결)/.test(String(row.content||"")));const projectName=projectNameFromContext(contextTitle),contextFiles=await resolveContextFiles(db,FILES,items,projectName,context.companyId);const persistedItems=items.map(item=>{const file=contextFiles.find(candidate=>candidate.deliverableId===item.id||candidate.title===item.title);return file?{...item,id:file.deliverableId,fileName:file.fileName,revision:file.revision,fileAttached:true}:item});
  const statements:D1Statement[]=[];
  if(!existing){statements.push(db.prepare(`INSERT INTO ai_conversations (id,company_id,user_id,title,source,context_type,context_title,context_items,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,context.companyId,context.userId,input.title||message.slice(0,42),input.source||"MY AI HOME",input.contextType||"workspace",contextTitle,JSON.stringify(persistedItems),now,now));}
  else{statements.push(db.prepare(`UPDATE ai_conversations SET title=?,source=?,context_type=?,context_title=?,context_items=?,updated_at=? WHERE id=? AND company_id=? AND user_id=?`).bind(input.title||existing.title||message.slice(0,42),input.source||"MY AI HOME",input.contextType||"workspace",contextTitle,JSON.stringify(persistedItems),now,id,context.companyId,context.userId));}
  statements.push(db.prepare(`INSERT INTO ai_messages (id,conversation_id,role,content,citations,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,"user",message,JSON.stringify(persistedItems),now));await db.batch(statements);
  if(!existing)return Response.json({id,updatedAt:now,contextFiles:contextFiles.map(file=>({deliverableId:file.deliverableId,fileName:file.fileName,revision:file.revision,contentType:file.contentType||""}))},{status:201});
  try{
    let analyzedFiles=contextFiles,warning="";
    let generated:Awaited<ReturnType<typeof generateOpenAI>>;
    try{generated=await generateOpenAI(contextTitle,persistedItems,contextFiles,history,message);}
    catch(fileError){
      if(!contextFiles.length)throw fileError;
      analyzedFiles=[];
      warning="원본 파일 직접 분석을 사용할 수 없어 등록된 문서·업무 문맥을 기준으로 답변했습니다.";
      generated=await generateOpenAI(contextTitle,persistedItems,[],history,`${message}\n\n[시스템 참고: 원본 파일을 직접 읽을 수 없습니다. 선택된 문서명과 저장된 프로젝트·WBS 문맥만 사용하고, 확인하지 못한 파일 내용은 추정하지 마세요.]`);
    }
    const citations=analyzedFiles.map(file=>({type:"deliverable_file",deliverableId:file.deliverableId,fileName:file.fileName,revision:file.revision}));
    await db.batch([db.prepare(`INSERT INTO ai_messages (id,conversation_id,role,content,citations,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,"assistant",generated.answer,JSON.stringify(citations),now+1),db.prepare("UPDATE ai_conversations SET updated_at=? WHERE id=? AND company_id=? AND user_id=?").bind(now+1,id,context.companyId,context.userId)]);
    return Response.json({id,updatedAt:now+1,answer:generated.answer,warning,fileFallback:Boolean(warning),model:generated.model,contextFiles:citations});
  }
  catch(error){const detail=error instanceof Error?error.message:"AI 응답을 생성하지 못했습니다.";const notice=`${aiConnectionMessage(detail)} 질문은 저장되었습니다.`;await db.batch([db.prepare(`INSERT INTO ai_messages (id,conversation_id,role,content,citations,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,"assistant",notice,"[]",now+1)]);return Response.json({id,updatedAt:now+1,answer:notice,error:detail,saved:true,contextFiles:0},{status:200});}
}


export async function PATCH(request:Request){
  const authenticated=await getChatGPTUser();const input=await request.json() as {id?:string;title?:string;groupName?:string};if(!input.id)return Response.json({error:"대화를 선택해 주세요."},{status:400});
  const {DB:db}=await runtime();await ensureAiWorkspace(db);let context;try{context=await resolveRequestContext(request,db,{email:authenticated?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const current=await db.prepare("SELECT id,title,group_name AS groupName FROM ai_conversations WHERE id=? AND company_id=? AND user_id=?").bind(input.id,context.companyId,context.userId).first<any>();if(!current)return Response.json({error:"대화를 찾을 수 없습니다."},{status:404});
  await db.prepare("UPDATE ai_conversations SET title=?,group_name=?,updated_at=? WHERE id=? AND company_id=? AND user_id=?").bind(input.title?.trim()||current.title,input.groupName?.trim()||null,Math.floor(Date.now()/1000),input.id,context.companyId,context.userId).run();
  return Response.json({ok:true});
}

export async function DELETE(request:Request){
  const authenticated=await getChatGPTUser();const id=new URL(request.url).searchParams.get("id");if(!id)return Response.json({error:"삭제할 대화를 선택해 주세요."},{status:400});
  const {DB:db}=await runtime();await ensureAiWorkspace(db);let context;try{context=await resolveRequestContext(request,db,{email:authenticated?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const owned=await db.prepare("SELECT id FROM ai_conversations WHERE id=? AND company_id=? AND user_id=?").bind(id,context.companyId,context.userId).first();if(!owned)return Response.json({error:"대화를 찾을 수 없습니다."},{status:404});
  await db.batch([db.prepare("DELETE FROM ai_messages WHERE conversation_id=?").bind(id),db.prepare("DELETE FROM ai_conversations WHERE id=? AND company_id=? AND user_id=?").bind(id,context.companyId,context.userId)]);
  return Response.json({ok:true});
}
