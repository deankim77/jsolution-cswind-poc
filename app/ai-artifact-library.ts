import type { AiArtifactType } from "./ai-artifact-download";

export type StoredAiArtifactResult={
  id:string;
  title:string;
  summary:string;
  location:"personal"|"project";
  project:string;
  source:string;
  createdAt:string;
  author:string;
  artifactType:AiArtifactType;
  artifactContent:string;
  fileBase:string;
  conversationId?:string;
  conversationTitle?:string;
};

const STORAGE_KEY="jsolution-ai-analysis-results";
const DIRTY_KEY="jsolution-ai-analysis-dirty";
const CHANGE_EVENT="jsolution-ai-analysis-results-changed";

function normalizedContent(value:string){return value.replace(/\s+/g," ").trim();}
function contentSignature(type:AiArtifactType,value:string){return `${type}:${normalizedContent(value).slice(0,420)}`;}

export function saveAiArtifactResult(input:{
  type:AiArtifactType;
  content:string;
  fileBase:string;
  title:string;
  project?:string;
  source?:string;
  conversationId?:string;
  conversationTitle?:string;
}){
  if(typeof window==="undefined")return;
  try{
    const stored=window.localStorage.getItem(STORAGE_KEY);
    const current=stored?JSON.parse(stored) as StoredAiArtifactResult[]:[];
    const signature=contentSignature(input.type,input.content);
    const duplicateIndex=current.findIndex(item=>item.artifactType&&contentSignature(item.artifactType,String(item.artifactContent||item.summary||""))===signature);
    if(duplicateIndex>=0){
      const existing=current[duplicateIndex];
      const merged:StoredAiArtifactResult={
        ...existing,
        title:existing.title||`${input.title} · ${input.type.toUpperCase()}`,
        project:existing.project&&existing.project!=="개인 업무"?existing.project:(input.project||existing.project||"개인 업무"),
        source:input.source||existing.source,
        artifactContent:input.content||existing.artifactContent,
        fileBase:input.fileBase||existing.fileBase,
        conversationId:existing.conversationId||input.conversationId,
        conversationTitle:existing.conversationTitle||input.conversationTitle,
      };
      const next=[merged,...current.filter((_,index)=>index!==duplicateIndex)];
      window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return;
    }
    const result:StoredAiArtifactResult={
      id:`AI-DOC-${Date.now()}`,
      title:`${input.title} · ${input.type.toUpperCase()}`,
      summary:normalizedContent(input.content).slice(0,260),
      location:"personal",
      project:input.project||"개인 업무",
      source:input.source||`AI 대화 · ${input.type.toUpperCase()} 생성`,
      createdAt:"방금 전",
      author:"Dean Kim",
      artifactType:input.type,
      artifactContent:input.content,
      fileBase:input.fileBase,
      conversationId:input.conversationId,
      conversationTitle:input.conversationTitle,
    };
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify([result,...current]));
    window.localStorage.setItem(DIRTY_KEY,"1");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }catch{/* 결과물 보관 실패가 AI 대화나 다운로드를 막지 않도록 한다. */}
}
