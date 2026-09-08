import {readFile} from "node:fs/promises";

const required={
  "app/v2/advanced-gantt-view.tsx":["Critical Path","후속 자동조정","initializeBaseline","/schedule","gate-marker","nextBusinessDate","durationDays","businessDistance","lagByTask","child.lag","[showDependencies,setShowDependencies]=useState(false)","showDependencies||showCritical","ResizeObserver","minBarWidth","centerX","midY:(y1+y2)/2","predecessor.taskType===\"gate\"?35:32","task.taskType===\"gate\"?9:12","AI 일정 회복안","승인 후 적용","buildRecoveryProposal"],
  "app/v2/advanced-wbs-editor.tsx":["WBS 계획 편집","DELIVERABLE_CATEGORY","산출물 지정","완료 승인","completionCriteria"],
  "app/v2/connected-ai-workspaces.tsx":["wv2-ai-group-manager","새 그룹 이름","그룹 이름 변경","event.key===\"Escape\"","<Plus size={18}/>","conversationCount","<small>{conversationCount}개</small>"],
  "app/api/projects/[projectId]/wbs/route.ts":["nextBusinessDate","endFromDuration","autoScheduledCount","FS_NEXT_BUSINESS_DAY"],
  "app/api/projects/route.ts":["working_days AS workingDays","calendar_holidays","endFromBusinessDuration","nextBusinessDay"],
  "app/v2/ai-context-selection.tsx":["v2-ai-context-selection","/api/state","선택 항목 AI에 추가"],
  "app/v2/document-preview-workspace.tsx":["v2-document-preview-tabs","v2-open-document-preview"],
  "app/api/projects/[projectId]/actuals/route.ts":["담당자 본인만","TASK_COMPLETION_","requireProjectAccess(db,context,projectId,true)","task.taskType===\"gate\"","approved"],
  "db/request-context.ts":["resolveRequestContext","requireProjectAccess","canManageProject","oai-authenticated-user-email"],
  "app/api/system/settings/route.ts":["SYSTEM_ADMIN","system_settings"],
};

const failures=[];
for(const [file,tokens] of Object.entries(required)){
  const source=await readFile(file,"utf8");
  for(const token of tokens)if(!source.includes(token))failures.push(`${file}: ${token}`);
}
const combined=await Promise.all(Object.keys(required).map(file=>readFile(file,"utf8"))).then(values=>values.join("\n"));
for(const forbidden of ["company-jsolution","user-dean","dean@jjjsolution.com"])if(combined.includes(forbidden))failures.push(`고정 사용자 문맥 잔존: ${forbidden}`);
if(failures.length){console.error("V2 feature contract check failed:\n"+failures.map(item=>`- ${item}`).join("\n"));process.exit(1)}
console.log("V2 feature contract check passed.");
