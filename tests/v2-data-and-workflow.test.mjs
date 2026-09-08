import assert from "node:assert/strict";
import {readdir,readFile} from "node:fs/promises";
import test from "node:test";
import {csmDefinition,csmDemo} from "../scripts/demo-data/csm-new-car-r14.mjs";
import {cimDefinition,cimDemo} from "../scripts/demo-data/cim-e2e-pilot.mjs";


test("CIM is the primary first-phase customer demo dataset",()=>{
  const summaries=cimDefinition.wbs.filter(task=>task.kind==="summary");
  const activities=cimDefinition.wbs.filter(task=>/^P\d+-A\d{2}$/.test(task.id));
  const areas=new Set(activities.map(task=>task.requirementArea));
  assert.equal(summaries.length,10);
  assert.equal(activities.length,40);
  assert.equal(areas.size,12);
  assert.equal(activities.filter(task=>task.sourceStatus==="completed").length,15);
  assert.equal(activities.filter(task=>task.sourceStatus==="active").length,6);
  assert.equal(activities.filter(task=>task.sourceStatus==="review").length,1);
  assert.equal(activities.filter(task=>task.sourceStatus==="planned").length,18);
  assert.equal(cimDemo.projectCode,"CIM-2026-PILOT-DEMO");
  assert.ok(cimDemo.description.includes("1차 구축 메인"));
  assert.deepEqual(cimDemo.requirementBaseline,{total:142,existingLineItems:113,additionalReviewItems:29,meetingDecisionItems:22,priorEstimateBasis:136});
  assert.match(cimDemo.demoPositioning,/PMS \+ 경량 PLM.*편의성 중심/);
  assert.equal(cimDemo.demoFocus.length,4);
  assert.equal(cimDemo.scopeBoundary.length,4);
  assert.ok(activities.every(task=>task.plannedStart&&task.plannedEnd&&task.plannedStart<=task.plannedEnd));
  assert.ok(activities.every(task=>task.deliverables?.length&&task.deliverables.every(output=>output.required)));
});

test("CSM R14 demo dataset preserves customer process counts",()=>{
  const summaries=csmDefinition.wbs.filter(task=>task.kind==="summary");
  const activities=csmDefinition.wbs.filter(task=>/^G\d-A\d{2}$/.test(task.id));
  const reviews=csmDefinition.wbs.filter(task=>task.taskType==="gate");
  assert.equal(summaries.length,6);
  assert.equal(activities.length,50);
  assert.equal(reviews.length,6);
  assert.equal(activities.filter(task=>task.sourceStatus==="completed").length,35);
  assert.equal(activities.filter(task=>task.sourceStatus==="active").length,15);
  assert.equal(csmDemo.projectCode,"CSM-DL3-PE2-DEMO");
  assert.ok(activities.every(task=>task.plannedStart&&task.plannedEnd&&task.plannedStart<=task.plannedEnd));
  assert.ok(activities.every(task=>task.deliverables?.length&&task.deliverables.every(output=>output.required)));
});

test("schedule recovery changes remain approval gated",async()=>{
  const source=await readFile("app/v2/advanced-gantt-view.tsx","utf8");
  for(const token of ["AI 일정 회복안","승인 전에는 현재 일정이 변경되지 않습니다.","승인 후 적용","buildRecoveryProposal","applyProposal"])assert.ok(source.includes(token),token);
  assert.ok(source.indexOf("buildRecoveryProposal")<source.indexOf("applyProposal"));
});

test("critical path uses one business-day CPM axis with FS lag",async()=>{
  const source=await readFile("app/v2/advanced-gantt-view.tsx","utf8");
  for(const token of ["isBusinessDay","businessDistance","lagByTask","child.lag","nextBusinessDate(predecessor.plannedEnd)"])assert.ok(source.includes(token),token);
  assert.ok(!source.includes("Math.round((start-scheduleOrigin)/DAY)"));
});

test("dependency and critical lines share thin center-bottom to center-top routing",async()=>{
  const [source,styles]=await Promise.all([
    readFile("app/v2/advanced-gantt-view.tsx","utf8"),
    readFile("app/v2/work-view-v2.css","utf8"),
  ]);
  for(const token of ["ResizeObserver","minBarWidth","centerX","midY:(y1+y2)/2","predecessor.taskType===\"gate\"?35:32","task.taskType===\"gate\"?9:12"])assert.ok(source.includes(token),token);
  for(const token of ["stroke-width:1.25","stroke-linecap:round","stroke-linejoin:round"])assert.ok(styles.includes(token),token);
  for(const token of ["#e85d83","#f8cdd8","#d94f73","#f5afc2"])assert.ok(styles.includes(token),token);
});

test("dependency lines stay hidden until dependency or critical path is selected",async()=>{
  const source=await readFile("app/v2/advanced-gantt-view.tsx","utf8");
  assert.ok(source.includes("[showDependencies,setShowDependencies]=useState(false)"));
  assert.ok(source.includes("(showDependencies||showCritical)&&<svg"));
  assert.ok(source.includes("if(showCritical&&!critical)return[]"));
});

test("MY AI HOME group editor keeps group creation on one compact row",async()=>{
  const [source,styles]=await Promise.all([
    readFile("app/v2/connected-ai-workspaces.tsx","utf8"),
    readFile("app/v2/work-view-v2.css","utf8"),
  ]);
  for(const token of ["새 그룹 이름","그룹 이름 변경","event.key===\"Escape\"","<Plus size={18}/>"])assert.ok(source.includes(token),token);
  for(const token of ["conversationCount","<small>{conversationCount}개</small>"])assert.ok(source.includes(token),token);
  for(const token of ["grid-template-columns:minmax(0,1fr) 66px","min-width:66px","justify-content:space-between","border-radius:999px"])assert.ok(styles.includes(token),token);
  assert.ok(!source.includes('<Plus size={18}/>추가</button></header>'));
});

test("authenticated identity and WBS status authorization are enforced",async()=>{
  const [context,status]=await Promise.all([
    readFile("db/request-context.ts","utf8"),
    readFile("app/api/projects/[projectId]/wbs/status/route.ts","utf8"),
  ]);
  assert.ok(context.includes("oai-authenticated-user-email"));
  for(const token of ["resolveRequestContext","requireProjectAccess","canManageProject","assigneeUserId!==context.userId"])assert.ok(status.includes(token),token);
  assert.ok(status.includes('requestedStatus==="in_progress"?"active"'));
});

test("new projects use the company business calendar",async()=>{
  const source=await readFile("app/api/projects/route.ts","utf8");
  for(const token of ["working_days AS workingDays","calendar_holidays","endFromBusinessDuration","nextBusinessDay"])assert.ok(source.includes(token),token);
});

test("all V2 mutation routes enforce tenant and project authorization",async()=>{
  const files=[
    "app/api/ai/conversations/delete/route.ts",
    "app/api/projects/[projectId]/issues/attachments/route.ts",
    "app/api/projects/[projectId]/route.ts",
    "app/api/projects/[projectId]/wbs/schedule/route.ts",
    "app/api/projects/roles/sync/route.ts",
  ];
  const sources=await Promise.all(files.map(path=>readFile(path,"utf8")));
  for(const [index,source] of sources.entries()){
    assert.ok(source.includes("resolveRequestContext"),files[index]);
    assert.ok(!source.includes('const COMPANY_ID="company-jsolution"'),files[index]);
    assert.ok(!source.includes('const FALLBACK_USER_ID="user-dean"'),files[index]);
  }
  for(const index of [1,2,3,4])assert.ok(sources[index].includes("requireProjectAccess"),files[index]);
  for(const index of [2,3,4])assert.ok(sources[index].includes("canManageProject"),files[index]);
});

test("AI conversations retain the originating workspace label",async()=>{
  const [panel,gantt]=await Promise.all([
    readFile("app/v2/connected-ai-workspaces.tsx","utf8"),
    readFile("app/v2/advanced-gantt-view.tsx","utf8"),
  ]);
  assert.ok(panel.includes("source?:string"));
  assert.ok(panel.includes('source:draftRequest.source||"V2 우측 AI"'));
  assert.ok(panel.includes("source:selected.source"));
  assert.ok(gantt.includes('source:"일정 · WBS"'));
});

test("dashboard and MY WORK share the authenticated request context",async()=>{
  const files=["app/api/dashboard/route.ts","app/api/my-work/route.ts"];
  const sources=await Promise.all(files.map(path=>readFile(path,"utf8")));
  for(const [index,source] of sources.entries()){
    assert.ok(source.includes("resolveRequestContext"),files[index]);
    assert.ok(source.includes("context.userId"),files[index]);
    assert.ok(!source.includes('email:"dean@jjjsolution.com"'),files[index]);
  }
});


test("CIM demo scope separates current convenience from requirement and quote decisions",async()=>{
  const [scope,acceptance]=await Promise.all([
    readFile("docs/CIM-DEMO-SCOPE-2026-08-21.md","utf8"),
    readFile("docs/DEAN-V2-ACCEPTANCE-2026-08-18.md","utf8"),
  ]);
  for(const token of ["최종 통합 요구사항 142건","추가검토 29건","확정 대상은 22건","PMS + 경량 PLM","3.3억"])assert.ok(scope.includes(token),token);
  for(const token of ["완성 기능으로 표현하지 않음","CIM-10","고객 최종 통합 요구사항 기준: 142건"])assert.ok(acceptance.includes(token),token);
});

test("CIM seed synchronizes an existing demo project instead of exiting early",async()=>{
  const source=await readFile("scripts/seed-cim-demo.mjs","utf8");
  assert.ok(source.includes("기존 CIM 프로젝트를 최종 142건 데모 기준으로 동기화"));
  assert.ok(source.includes("const project=existing||await post"));
  assert.ok(source.includes("/wbs`,{method:\"PUT\""));
  assert.ok(!source.includes("process.exit(0)"));
  assert.ok(source.includes("task.predecessorCode||source.predecessorId"));
});

test("CIM rebalance restores missing dependencies before schedule correction",async()=>{
  const source=await readFile("scripts/rebalance-cim-demo.mjs","utf8");
  for(const token of ["preservedRelationships","generatedRelationships","sourcePredecessor","relationshipByCode","x-demo-seed"])assert.ok(source.includes(token),token);
  assert.ok(!source.includes("선행 Task 관계가 없어 일정 보정을 중단했습니다"));
});

test("WBS save enforces FS minimum start without pulling a later plan forward",async()=>{
  const [route,app]=await Promise.all([readFile("app/api/projects/[projectId]/wbs/route.ts","utf8"),readFile("app/v2/NewWorkViewApp.tsx","utf8")]);
  for(const source of [route,app])for(const token of ["plannedStart","dependencyStart","plannedStart>dependencyStart?plannedStart:dependencyStart"])assert.ok(source.includes(token),token);
  for(const token of ["nextBusinessDate","endFromDuration","autoScheduledCount","FS_NEXT_BUSINESS_DAY","predecessor?.plannedEnd"])assert.ok(route.includes(token),token);
});

test("CIM sample deliverables are packaged for idempotent upload",async()=>{
  const [source,files]=await Promise.all([
    readFile("scripts/upload-cim-sample-deliverables.mjs","utf8"),
    readdir("scripts/demo-files/cim"),
  ]);
  assert.equal(files.filter(name=>name.endsWith(".docx")).length,8);
  for(const token of ["CIM-2026-PILOT-DEMO","library.versions","동일 샘플 등록됨","new File([bytes]"])assert.ok(source.includes(token),token);
  for(const name of files.filter(name=>name.endsWith(".docx"))){
    const bytes=await readFile(`scripts/demo-files/cim/${name}`);
    assert.equal(bytes.subarray(0,2).toString(),"PK",name);
  }
});

test("demo directory provides Korean users, diverse avatars, and compact project roles",async()=>{
  const source=await readFile("scripts/seed-demo-directory.mjs","utf8");
  for(const token of ["프로젝트사업본부","기술개발본부","운영품질본부","디지털혁신실","김도윤","홍채원","avatar-12","--clear"])assert.ok(source.includes(token),token);
  assert.equal((source.match(/\[\"[^\"]+\",\"DEMO_[A-Z_]+\",\"avatar-\d{2}\"\]/g)||[]).length,20);
  assert.deepEqual(cimDefinition.roles,["PM","PL","기획","개발","구매","생산","품질"]);
  assert.deepEqual(csmDefinition.roles,["PM","PL","기획","개발","구매","생산","품질"]);
});

test("user avatars persist and appear in user and project member workspaces",async()=>{
  const [master,settings,members,session]=await Promise.all([
    readFile("app/api/system/master-data/route.ts","utf8"),readFile("app/v2/system-settings-suite.tsx","utf8"),
    readFile("app/v2/project-members-dialog.tsx","utf8"),readFile("app/api/session/route.ts","utf8"),
  ]);
  for(const token of ["avatar_key","avatarKey","ALTER TABLE users ADD COLUMN avatar_key"])assert.ok(master.includes(token),token);
  for(const token of ["USER_AVATAR_KEYS","wv2-avatar-picker","UserAvatar"])assert.ok(settings.includes(token),token);
  assert.ok(members.includes("UserAvatar"));assert.ok(session.includes("avatarKey"));
});

test("WBS duration supports continuous keyboard entry",async()=>{
  const source=await readFile("app/v2/advanced-wbs-editor.tsx","utf8");
  for(const token of ["durationRefs","onDurationKey","ArrowUp","ArrowDown","pendingDurationFocus","onKeyDown={event=>onDurationKey(event,index)}"])assert.ok(source.includes(token),token);
});

test("existing demos migrate from long team roles to compact roles",async()=>{
  const [sync,cim,csm]=await Promise.all([readFile("app/api/projects/roles/sync/route.ts","utf8"),readFile("scripts/seed-cim-demo.mjs","utf8"),readFile("scripts/seed-csm-demo.mjs","utf8")]);
  for(const token of ["replaceUnused","removed=obsolete.length","DELETE FROM project_roles"])assert.ok(sync.includes(token),token);
  assert.ok(cim.includes("replaceUnused:true"));assert.ok(csm.includes("replaceUnused:true"));assert.ok(!csm.includes("process.exit(0)"));
});

test("local first-run grants the initial active user a real system admin role",async()=>{
  const [context,master]=await Promise.all([readFile("db/request-context.ts","utf8"),readFile("app/api/system/master-data/route.ts","utf8")]);
  assert.ok(!context.includes("r.status='active'"));
  for(const token of ["system-role-admin","SYSTEM_ADMIN","INSERT OR IGNORE INTO user_roles","localhost","if(!assigned)"])assert.ok(master.includes(token),token);
});

test("active WBS reseeding is restricted to local admin demo projects",async()=>{
  const [route,cim,csm]=await Promise.all([readFile("app/api/projects/[projectId]/wbs/route.ts","utf8"),readFile("scripts/seed-cim-demo.mjs","utf8"),readFile("scripts/seed-csm-demo.mjs","utf8")]);
  for(const token of ["x-demo-seed","jsolution-local-demo","localhost","project.code.endsWith(\"-DEMO\")","SYSTEM_ADMIN","demoSeed"])assert.ok(route.includes(token),token);
  assert.ok(cim.includes('headers:{"x-demo-seed":"jsolution-local-demo"}'));assert.ok(csm.includes('headers:{"x-demo-seed":"jsolution-local-demo"}'));
});
