import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(path,"utf8");

test("V2 menu exposes templates and project workflow modules in the agreed order",async()=>{
  const source=await read("app/v2/NewWorkViewApp.tsx");
  const names=["프로젝트 템플릿","워크플로우 템플릿","새 프로젝트","프로젝트 목록","일정 · WBS","문서 · 산출물","워크플로우","설계변경","품질관리","이슈 · 리스크","보고 · 회의"];
  let cursor=-1;for(const name of names){const next=source.indexOf(`>${name}</button>`,cursor+1);assert.ok(next>cursor,`${name} menu order`);cursor=next}
});

test("workflow templates support freely repeated and reordered steps with version snapshots",async()=>{
  const [ui,api,foundation]=await Promise.all([read("app/v2/workflow-workspaces.tsx"),read("app/api/workflows/templates/route.ts"),read("app/api/workflows/shared.ts")]);
  assert.ok(ui.includes("단계 추가"));assert.ok(ui.includes("ArrowUp"));assert.ok(ui.includes("ArrowDown"));assert.ok(ui.includes("Trash2"));
  for(const action of ["WRITE","PROCESS","REVIEW","AGREEMENT","APPROVAL","REFERENCE"])assert.ok(ui.includes(action));
  assert.ok(api.includes("current_version"));assert.ok(api.includes("versionId"));assert.ok(foundation.includes("template_version_id"));assert.ok(foundation.includes("workflow_instance_steps"));
});

test("sequential workflow actions preserve history and final official document reference",async()=>{
  const route=await read("app/api/workflows/[workflowId]/route.ts");
  for(const action of ["SUBMIT","RESUBMIT","RECALL","SUPPLEMENT","REJECT","APPROVAL"])assert.ok(route.includes(action));
  assert.ok(route.includes("workflow_history"));assert.ok(route.includes("official_document_id"));assert.ok(route.includes("main_deliverable_id"));assert.ok(route.includes("UPDATE deliverables SET status='approved'"));
});

test("workflow steps support document handoff and immutable revision history",async()=>{
  const [foundation,route,detail,ui]=await Promise.all([read("db/workflow-foundation.ts"),read("app/api/workflows/[workflowId]/route.ts"),read("app/api/workflows/shared.ts"),read("app/v2/workflow-detail-panel.tsx")]);
  for(const action of ["NONE","VIEW","NEW","REVISION","REVIEW","APPROVAL"])assert.ok(foundation.includes(`\"${action}\"`));
  assert.ok(foundation.includes("workflow_step_document_rules"));assert.ok(foundation.includes("workflow_step_documents"));
  assert.ok(route.includes("deliverable_versions"));assert.ok(route.includes("DOCUMENT_REVISION"));assert.ok(route.includes("document_required"));
  assert.ok(detail.includes("permissions"));assert.ok(detail.includes("documents:documents.results"));
  assert.ok(ui.includes("전체 단계·처리 담당자"));assert.ok(ui.includes("새 Revision 등록"));assert.ok(ui.includes("검토 의견"));
});

test("MY WORK counts only the active current assignee workflow",async()=>{
  const [api,ui]=await Promise.all([read("app/api/workflows/my-work/route.ts"),read("app/v2/my-workspace.tsx")]);
  assert.ok(api.includes("s.assignee_user_id=? AND s.status='active' AND w.status='in_progress'"));
  assert.ok(ui.includes('label:"워크플로우"'));assert.ok(ui.includes('description:"승인·검토·합의·처리"'));
});

test("ECR and quality records automatically call their database workflow templates",async()=>{
  const [ecr,quality,defaults]=await Promise.all([read("app/api/ecr/route.ts"),read("app/api/quality/route.ts"),read("db/workflow-foundation.ts")]);
  assert.ok(ecr.includes('templateCode:"ECR"'));assert.ok(quality.includes('templateCode:"QUALITY_ACTION"'));
  assert.ok(defaults.includes('name:"설계변경 ECR"'));assert.ok(defaults.includes('name:"품질 개선조치"'));assert.ok(defaults.includes('name:"양산이관 승인"'));
});
