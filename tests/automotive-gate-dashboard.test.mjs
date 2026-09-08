import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("V2 workspaces use the G6 Gate dashboards", () => {
  const app = read("../app/v2/NewWorkViewApp.tsx");
  assert.match(app, /GatePortfolioDashboard/);
  assert.match(app, /GateProjectDashboard/);
});

test("Gate dashboards expose portfolio, project and AI briefing views", () => {
  const dashboard = read("../app/v2/gate-dashboards.tsx");
  for (const phrase of ["Gate별 누적 통과", "현재 Gate 분포", "거래처 × 현재 Gate", "G1~G6 Stage-Gate 진행 현황", "AI 프로젝트 브리핑"]) {
    assert.ok(dashboard.includes(phrase), `missing dashboard phrase: ${phrase}`);
  }
  assert.match(dashboard, /fetch\("\/api\/dashboard"/);
  assert.match(dashboard, /\/gates/);
});

test("dashboard API supplies persisted Gate aggregates", () => {
  const route = read("../app/api/dashboard/route.ts");
  for (const field of ["gateSummary", "gatePortfolio", "gateHealth", "upcomingReviews"]) {
    assert.ok(route.includes(field), `missing API field: ${field}`);
  }
});
