import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
import {ensureProjectDataFoundation,type RuntimeD1} from "../../../db/project-data-foundation";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type D1=RuntimeD1;
async function dbRuntime(){return getLegacyDbCompat() as D1;}

const STANDARDS=[
  ["P01_INIT_REPORT","01 프로젝트·기획 > 프로젝트 관리 > 착수보고서"],["P01_EXEC_PLAN","01 프로젝트·기획 > 프로젝트 관리 > 수행계획서"],["P01_TFT_ORG","01 프로젝트·기획 > 프로젝트 관리 > TFT 조직도"],["P01_REQUIRE_TRACE","01 프로젝트·기획 > 요구사항 관리 > 요구사항 추적표"],["P01_REQUIRE_ANALYSIS","01 프로젝트·기획 > 요구사항 관리 > AS-IS(요구사항) 분석서"],["P01_MEETING","01 프로젝트·기획 > 회의·보고 > 회의록"],["P01_WEEKLY_REPORT","01 프로젝트·기획 > 회의·보고 > 주간보고서"],["P01_FINAL_REPORT","01 프로젝트·기획 > 회의·보고 > 완료보고서"],
  ["P02_TOBE_DESIGN","02 디자인·설계·기술 > 시스템 설계 > TO-BE 설계서"],["P02_DB_DESIGN","02 디자인·설계·기술 > 시스템 설계 > DB 설계서"],["P02_ARCH","02 디자인·설계·기술 > 시스템 설계 > 시스템 구성도"],["P02_SPEC","02 디자인·설계·기술 > 기술 사양 > 기술사양서"],["P02_DRAWING","02 디자인·설계·기술 > 도면·BOM > 설계도면"],["P02_BOM","02 디자인·설계·기술 > 도면·BOM > BOM"],["P02_CHANGE_DOC","02 디자인·설계·기술 > 변경 관리 > 설계변경서"],
  ["P03_DEV_RESULT","03 개발·샘플·PILOT > 개발 > 개발 결과서"],["P03_SAMPLE_RESULT","03 개발·샘플·PILOT > 샘플 > 샘플 제작 결과서"],["P03_PILOT_RESULT","03 개발·샘플·PILOT > PILOT > PILOT 생산 결과서"],["P03_TEST_PLAN","03 개발·샘플·PILOT > 시험·검증 > 테스트 계획서"],["P03_TEST_RESULT","03 개발·샘플·PILOT > 시험·검증 > 테스트 결과서"],
  ["P04_QUOTE","04 구매·협력사 > 구매 > 견적서"],["P04_PO","04 구매·협력사 > 구매 > 발주서"],["P04_VENDOR_EVAL","04 구매·협력사 > 협력사 > 협력사 평가서"],["P04_SUPPLIER_SPEC","04 구매·협력사 > 협력사 > 공급사 사양서"],["P04_CONTRACT","04 구매·협력사 > 계약 > 계약서"],
  ["P05_FMEA","05 품질·검증 > 품질 계획 > FMEA"],["P05_INSPECTION","05 품질·검증 > 검사 > 검사 기준서"],["P05_TEST_CERT","05 품질·검증 > 시험 > 시험 성적서"],["P05_ISIR","05 품질·검증 > 승인 > ISIR"],["P05_ACTION","05 품질·검증 > 개선 > 품질 개선조치서"],["P05_VALIDATION","05 품질·검증 > 검증 > 검증 결과서"],
  ["P06_PROCESS_PLAN","06 생산·공정 > 공정 계획 > 공정 계획서"],["P06_WORK_STANDARD","06 생산·공정 > 작업 표준 > 작업 표준서"],["P06_PROCESS_CONDITION","06 생산·공정 > 생산 조건 > 생산 조건서"],["P06_CONTROL_PLAN","06 생산·공정 > 공정 관리 > Control Plan"],["P06_EQUIPMENT","06 생산·공정 > 설비 > 설비 조건서"],
  ["P07_TRANSFER","07 양산·이관 > 양산 이관 > 양산 이관서"],["P07_HANDOVER","07 양산·이관 > 인수인계 > 인수인계서"],["P07_FINAL_INSPECTION","07 양산·이관 > 검수 > 최종 검수 확인서"],["P07_RELEASE","07 양산·이관 > 승인 > 양산 승인서"],["P07_RELEASE_REPORT","07 양산·이관 > 완료 > 완료보고서"],
  ["P08_GATE_CHECK","08 Gate·승인 > Gate Review > Gate 판정 체크리스트"],["P08_GATE_APPROVAL","08 Gate·승인 > Gate Review > Gate 승인서"],["P08_SIGNOFF","08 Gate·승인 > 최종 승인 > 최종 승인서"],["P08_APPROVAL_RECORD","08 Gate·승인 > 승인 기록 > 승인 이력서"],
] as const;

let schemaReady:Promise<void>|null=null;
const seedRequests=new Map<string,Promise<void>>();
const seededCompanies=new Set<string>();

async function ensureSchema(db:D1){
  if(!schemaReady){
    schemaReady=(async()=>{
      await ensureProjectDataFoundation(db);
      await db.prepare(`CREATE TABLE IF NOT EXISTS common_codes (id text PRIMARY KEY NOT NULL,company_id text NOT NULL,group_code text NOT NULL,code text NOT NULL,label text NOT NULL,version integer DEFAULT 1 NOT NULL,sort_order integer DEFAULT 0 NOT NULL,enabled integer DEFAULT 1 NOT NULL,created_at integer NOT NULL,updated_at integer NOT NULL)`).run();
      await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS common_codes_version_uq ON common_codes(company_id,group_code,code,version)").run();
    })().catch(reason=>{schemaReady=null;throw reason});
  }
  await schemaReady;
}

async function ensure(db:D1,companyId:string){
  await ensureSchema(db);
  if(seededCompanies.has(companyId))return;
  const existing=seedRequests.get(companyId);
  if(existing){await existing;return;}
  const request=(async()=>{
    const now=Math.floor(Date.now()/1000);
    await db.batch(STANDARDS.map(([code,label],index)=>db.prepare("INSERT OR IGNORE INTO common_codes (id,company_id,group_code,code,label,version,sort_order,enabled,created_at,updated_at) VALUES (?,?,?,?,?,1,?,1,?,?)").bind(`deliverable-standard-${companyId}-${code}`,companyId,"DELIVERABLE_STANDARD",code,label,index*10,now,now)));
    seededCompanies.add(companyId);
  })().finally(()=>seedRequests.delete(companyId));
  seedRequests.set(companyId,request);
  await request;
}

export async function GET(request:Request){const db=await dbRuntime();let context;try{context=await resolveRequestContext(request,db);await ensure(db,context.companyId)}catch(reason){console.error("[DELIVERABLE_STANDARDS_ERROR]",reason);return contextErrorResponse(reason)??Response.json({error:"표준 산출물을 불러오지 못했습니다."},{status:500})}const rows=await db.prepare("SELECT code,label,sort_order AS sortOrder FROM common_codes WHERE company_id=? AND group_code='DELIVERABLE_STANDARD' AND enabled=1 ORDER BY sort_order,code").bind(context.companyId).all();return Response.json({standards:rows.results??[]});}
