import test from "node:test";
import assert from "node:assert/strict";
import {automotiveProjects,buildAutomotiveTemplate,deliverableBlueprints,demoRecordPlan} from "../scripts/demo-data/automotive-g6-portfolio.mjs";

test("자동차 포트폴리오는 현대 7·기아 5·르노 3개로 구성된다",()=>{
  const counts=Object.fromEntries(["HYUNDAI","KIA","RENAULT"].map(code=>[code,automotiveProjects.filter(item=>item.customerCode===code).length]));
  assert.deepEqual(counts,{HYUNDAI:7,KIA:5,RENAULT:3});
  assert.equal(new Set(automotiveProjects.map(item=>item.code)).size,15);
  assert.ok(automotiveProjects.every(item=>item.name.endsWith("시트 원단 개발")));
});

test("모든 Gate는 PASS 승인과 필수 활동·산출물을 요구한다",()=>{
  const definition=buildAutomotiveTemplate();
  assert.equal(definition.gates.length,6);
  assert.equal(definition.gatePolicy.startUnlockDecision,"PASS");
  assert.equal(definition.gatePolicy.conditionalPassUnlocks,false);
  for(let gate=1;gate<=6;gate++){
    const review=definition.wbs.find(item=>item.id===`G${gate}-REVIEW`);
    assert.ok(review);
    assert.deepEqual(review.gatePolicy.allowedDecision,["PASS"]);
    assert.ok(review.gatePolicy.requiredTaskCodes.length>0);
    assert.equal(review.gatePolicy.requiredDeliverables,true);
    assert.equal(review.dependencyType,"FS");
    assert.equal(review.dependencyConstraint,"HARD");
    if(gate>1){
      const first=definition.wbs.find(item=>item.parentId===`G${gate}`&&!item.id.endsWith("-REVIEW"));
      assert.equal(first.predecessor,`G${gate-1}-REVIEW`);
      assert.equal(first.dependencyConstraint,"HARD");
    }
  }
});

test("6개월 표준 일정과 90% 이상 선후행 관계를 유지한다",()=>{
  const definition=buildAutomotiveTemplate();
  const tasks=definition.wbs.filter(item=>item.kind==="task");
  const linked=tasks.filter(item=>item.predecessor);
  const reviews=tasks.filter(item=>item.taskType==="gate");
  assert.equal(tasks.length,56);
  assert.ok(linked.length/tasks.length>=0.9);
  assert.equal(linked.length,55);
  assert.ok(reviews.every(item=>item.durationDays===3));
  assert.equal(tasks[0].plannedStart,"2026-01-05");
  assert.equal(tasks.at(-1).plannedEnd,"2026-07-03");
  for(let gate=2;gate<=6;gate++){
    const review=reviews.find(item=>item.id===`G${gate}-REVIEW`);
    assert.equal(review.predecessor,`G${gate-1}-REVIEW`);
  }
  assert.ok(automotiveProjects.every(project=>{
    const start=new Date(`${project.startDate}T00:00:00Z`);
    const end=new Date(`${project.endDate}T00:00:00Z`);
    return (end-start)/(24*60*60*1000)===179;
  }));
});

test("AI 대화용 문서·운영 데이터 목표 수량을 보장한다",()=>{
  assert.equal(deliverableBlueprints.length,30);
  assert.equal(demoRecordPlan.totalDeliverables,450);
  assert.equal(demoRecordPlan.totalOperationalRecords,90);
  assert.equal(demoRecordPlan.documentBodyLength.minKoreanCharacters,600);
  assert.equal(demoRecordPlan.documentBodyLength.maxKoreanCharacters,1200);
});

