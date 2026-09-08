import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(path,"utf8");

test("selected work is attached to AI context without auto sending a fixed question",async()=>{
  const [app,panel]=await Promise.all([read("app/v2/NewWorkViewApp.tsx"),read("app/v2/connected-ai-workspaces.tsx")]);
  assert.doesNotMatch(app,/선택한 업무 자료의 현재 상태, 상호 영향/);
  assert.match(app,/source:"V2 선택 업무"/);
  assert.doesNotMatch(panel,/void send\(draftRequest\.prompt/);
  assert.match(panel,/질문을 입력해 주세요/);
});

test("calendar navigation and Kanban delay markers are present",async()=>{
  const app=await read("app/v2/NewWorkViewApp.tsx");
  assert.match(app,/wv2-calendar-toolbar/);
  assert.match(app,/이전 달/);assert.match(app,/다음 달/);assert.match(app,/>오늘</);
  assert.match(app,/D\+\{delayed\}/);assert.match(app,/className=\{delayed\?"delayed"/);
});

test("deliverables support ad-hoc drag and drop with constrained AI category suggestion",async()=>{
  const [app,route,master]=await Promise.all([read("app/v2/NewWorkViewApp.tsx"),read("app/api/projects/[projectId]/deliverables/route.ts"),read("app/api/system/master-data/route.ts")]);
  assert.match(app,/산출물 추가/);assert.match(app,/onDrop=/);assert.match(app,/suggest-category/);
  assert.match(route,/허용 코드 중 하나만 답한다/);assert.match(route,/allowed\.has\(code\)/);
  assert.match(master,/기획 > 개발계획/);assert.match(master,/품질 > 시험결과/);assert.match(master,/승인 > Gate/);
});

test("completion conditions are system managed, short, defaulted, and enforced",async()=>{
  const [editor,master,actuals]=await Promise.all([read("app/v2/advanced-wbs-editor.tsx"),read("app/api/system/master-data/route.ts"),read("app/api/projects/[projectId]/actuals/route.ts")]);
  for(const label of ["진척 완료","필수 등록","필수 승인","하위 완료","Gate 승인","담당 확인"])assert.match(master,new RegExp(label));
  assert.match(editor,/COMPLETION_CONDITION/);assert.match(editor,/조건 \{selectedCriteria\(item\)\.length\}개/);
  assert.match(editor,/event\.key==="ArrowUp"/);assert.match(editor,/event\.key==="ArrowDown"/);assert.match(editor,/isComposing/);
  assert.match(actuals,/REQUIRED_APPROVAL/);assert.match(actuals,/CHILD_COMPLETE/);
});

test("AI governance file remains unchanged from the protected V1 contract",async()=>{
  const route=await read("app/api/projects/[projectId]/deliverables/route.ts");
  assert.doesNotMatch(route,/buildAiGovernancePrompt/);
});
