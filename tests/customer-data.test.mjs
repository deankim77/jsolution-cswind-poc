import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createCustomerDataRepository } from "../db/repositories/customer-data-repository.ts";
import { createCustomerDataService } from "../services/customer-data-service.ts";

// PostgreSQL engine in an isolated WASM process: never connects to Z440 or production DBs.
const pg = new PGlite();
const db = drizzle(pg);
const repository = createCustomerDataRepository(db);
const files = new Map();
const storage = {
  async put(key, value) { files.set(key, new Uint8Array(value)); },
  async get(key) { const bytes = files.get(key); return bytes ? { body: new Blob([bytes]).stream() } : null; },
  async delete(key) { files.delete(key); },
};
const service = createCustomerDataService(repository, storage);
const scope = { companyId: "test-company", projectId: "test-production", userId: "test-pm", systemRoles: [] };
const ordinary = { ...scope, userId: "test-member" };
const admin = { ...scope, systemRoles: ["ADMIN"] };
let original;
function uploadForm(extra = {}, content = "original drawing") {
  const form = new FormData();
  for (const [key, value] of Object.entries({ title: "TC800 도면", documentType: "drawing", impactTarget: "pbom", ...extra })) form.set(key, value);
  form.set("file", new File([content], "TC800 도면.pdf", { type: "application/pdf" }));
  return form;
}
const status = expected => error => error.status === expected;

before(async () => {
  const journal = JSON.parse(await fs.readFile(new URL("../drizzle-postgres/meta/_journal.json", import.meta.url), "utf8"));
  for (const entry of journal.entries.filter(entry => entry.idx < 7)) {
    const sql = await fs.readFile(new URL(`../drizzle-postgres/${entry.tag}.sql`, import.meta.url), "utf8");
    await pg.exec(sql);
  }
  await pg.exec(`
    INSERT INTO companies (id,code,name,created_at,updated_at) VALUES ('test-company','TEST','Test',1,1),('other-company','OTHER','Other',1,1);
    INSERT INTO users (id,company_id,email,name,status,created_at,updated_at) VALUES
      ('test-pm','test-company','pm@test.invalid','PM','active',1,1),('test-member','test-company','member@test.invalid','Member','active',1,1),
      ('test-outsider','test-company','outsider@test.invalid','Outsider','active',1,1);
    INSERT INTO project_types (id,company_id,code,name,status,created_at,updated_at) VALUES ('existing-production','test-company','PRODUCTION','기존 생산 유형','active',1,1);
  `);
  await pg.exec(await fs.readFile(new URL("../drizzle-postgres/0007_cswind_customer_data.sql", import.meta.url), "utf8"));
  await pg.exec(`
    INSERT INTO templates(id,company_id,code,name,status,created_at,updated_at) VALUES ('test-template','test-company','TEST','Test','active',1,1);
    INSERT INTO template_versions(id,template_id,version,definition,created_by,created_at,updated_at) VALUES ('test-version','test-template','1','{}','test-pm',1,1);
    INSERT INTO projects(id,company_id,template_version_id,code,name,project_type_id,start_date,end_date,status,template_snapshot,created_at,updated_at)
      VALUES ('test-production','test-company','test-version','P1','Production','existing-production','2026-09-01','2026-10-01','preparing','{}',1,1),
      ('test-second','test-company','test-version','P2','Second','existing-production','2026-09-01','2026-10-01','preparing','{}',1,1),
      ('test-rd','test-company','test-version','P3','R&D',NULL,'2026-09-01','2026-10-01','preparing','{}',1,1);
    INSERT INTO project_members(project_id,user_id,project_role,created_at,updated_at) VALUES
      ('test-production','test-pm','PM',1,1),('test-production','test-member','MEMBER',1,1);
  `);
});
after(async () => { await pg.close(); });

test("migration preserves existing Production master and adds missing R&D per company", async () => {
  const { rows } = await pg.query("SELECT name FROM project_types WHERE id='existing-production'");
  assert.equal(rows[0].name, "기존 생산 유형");
  const types = await pg.query("SELECT code FROM project_types WHERE company_id='other-company' ORDER BY code");
  assert.deepEqual(types.rows.map(row => row.code), ["PRODUCTION", "R_AND_D"]);
});

test("upload stores immutable bytes, hash, Raw Data ID, audit and honest initial states", async () => {
  original = await service.upload(scope, uploadForm());
  assert.match(original.rawDataId, /^RAW-/);
  assert.equal(original.revision, 1);
  assert.equal(original.reviewStatus, "pending");
  assert.equal(original.analysisStatus, "not_requested");
  assert.equal(original.appliedStatus, "not_applied");
  assert.match(original.checksum, /^[0-9a-f]{64}$/);
  assert.equal("fileKey" in original, false);
  const file = await service.download(scope, original.id);
  assert.equal(await new Response(file.body).text(), "original drawing");
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_type='CUSTOMER_RAW_DATA'")).rows[0].n, 1);
});

test("company, project membership and Production boundaries apply to listing, downloads and uploads", async () => {
  await assert.rejects(service.list({ ...scope, companyId: "other-company" }), status(404));
  await assert.rejects(service.download({ ...scope, userId: "test-outsider" }, original.id), status(403));
  await assert.rejects(service.upload({ ...scope, userId: "test-outsider" }, uploadForm()), status(403));
  await assert.rejects(service.list({ ...admin, projectId: "test-rd" }), status(409));
  await assert.rejects(service.download({ ...admin, projectId: "test-second" }, original.id), status(404));
});

test("invalid files and classification are rejected before storage", async () => {
  const size = files.size;
  await assert.rejects(service.upload(scope, uploadForm({}, "")), status(400));
  await assert.rejects(service.upload(scope, uploadForm({ documentType: "__proto__" })), status(400));
  await assert.rejects(service.upload(scope, uploadForm({ impactTarget: "unexpected" })), status(400));
  await assert.rejects(service.upload(scope, uploadForm({ title: " " })), status(400));
  const large = uploadForm(); large.set("file", new File([new Uint8Array(50 * 1024 * 1024 + 1)], "large.pdf"));
  await assert.rejects(service.upload(scope, large), status(413));
  assert.equal(files.size, size);
});

test("review requires PM/PL and never applies data; revisions start a new review", async () => {
  await assert.rejects(service.review(ordinary, original.id, true), status(403));
  await assert.rejects(service.review(scope, original.id, "true"), status(400));
  const reviewed = await service.review(scope, original.id, true);
  assert.equal(reviewed.reviewedBy, scope.userId); assert.equal(reviewed.appliedStatus, "not_applied");
  const revision = await service.upload(ordinary, uploadForm({ previousId: original.id }, "revision two"));
  assert.equal(revision.rawDataId, original.rawDataId); assert.equal(revision.revision, 2);
  assert.equal(revision.reviewStatus, "pending"); assert.equal(revision.reviewedBy, null);
  assert.equal((await service.list(scope)).relations.some(link => link.sourceId === revision.id && link.targetId === original.id && link.relationType === "supersedes"), true);
  assert.equal(await new Response((await service.download(scope, original.id)).body).text(), "original drawing");
});

test("stale revision conflict cleans the uploaded binary and creates no metadata", async () => {
  const count = (await service.list(scope)).records.length, fileCount = files.size;
  await assert.rejects(service.upload(scope, uploadForm({ previousId: original.id })), status(409));
  assert.equal(files.size, fileCount); assert.equal((await service.list(scope)).records.length, count);
});

test("references are scoped, idempotent and cannot point to the same version", async () => {
  const target = await service.upload(scope, uploadForm({ title: "사양서", documentType: "specification" }));
  await service.link(scope, original.id, target.id);
  await service.link(scope, original.id, target.id);
  assert.equal((await service.list(scope)).relations.filter(link => link.sourceId === original.id && link.targetId === target.id).length, 1);
  await assert.rejects(service.link(scope, original.id, original.id), status(400));
  const other = await service.upload({ ...admin, projectId: "test-second" }, uploadForm());
  await assert.rejects(service.link(scope, original.id, other.id), status(404));
  await assert.rejects(pg.query("INSERT INTO customer_raw_data_relations VALUES ('bad','test-company','test-production',$1,$2,'references','test-pm',1)", [original.id, other.id]));
});

test("storage failures cannot create a database record", async () => {
  const failing = createCustomerDataService(repository, { ...storage, async put(key, bytes) { await storage.put(key, bytes); throw new Error("disk unavailable"); } });
  const fileCount = files.size, rowCount = (await service.list(scope)).records.length;
  await assert.rejects(failing.upload(scope, uploadForm()), /disk unavailable/);
  assert.equal(files.size, fileCount); assert.equal((await service.list(scope)).records.length, rowCount);
});

test("competing uploads from the same revision produce one successor and clean the rejected file", async () => {
  const base = await service.upload(scope, uploadForm({ title: "Concurrent source" }));
  const fileCount = files.size;
  const results = await Promise.allSettled([
    service.upload(scope, uploadForm({ previousId: base.id }, "candidate A")),
    service.upload(scope, uploadForm({ previousId: base.id }, "candidate B")),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.find(result => result.status === "rejected").reason.status, 409);
  assert.equal(files.size, fileCount + 1);
  assert.deepEqual((await service.list(scope)).records.filter(row => row.rawDataId === base.rawDataId).map(row => row.revision).sort(), [1, 2]);
});

test("completed projects remain readable but reject uploads, review and linking", async () => {
  await pg.exec("UPDATE projects SET status='completed' WHERE id='test-production'");
  const result = await service.list(scope);
  assert.equal(result.canUpload, false); assert.equal(result.canReview, false);
  await assert.rejects(service.upload(scope, uploadForm()), status(409));
  await assert.rejects(service.review(scope, original.id, false), status(409));
  await assert.rejects(service.link(scope, original.id, result.records.find(row => row.id !== original.id).id), status(409));
  assert.ok(await service.download(scope, original.id));
});
