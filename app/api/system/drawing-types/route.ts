import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
import {ensureProjectDataFoundation,type RuntimeD1} from "../../../../db/project-data-foundation";
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1=RuntimeD1;
const GROUP_CODE="DRAWING_TYPE";
const SEED_KEY="common-code-drawing-type-v1";
const DEFAULTS=[
  ["PRODUCT_DRAWING","제품도"],
  ["PART_DRAWING","부품도"],
  ["ASSEMBLY_DRAWING","조립도"],
  ["PROCESS_DRAWING","공정도"],
  ["DESIGN","디자인"],
  ["FABRIC_SPEC","원단 사양"],
  ["OTHER","기타"],
] as const;

async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}

async function ensureDrawingTypes(db:D1,companyId:string){
  const now=Math.floor(Date.now()/1000);
  await db.prepare(`CREATE TABLE IF NOT EXISTS common_codes (id text PRIMARY KEY NOT NULL,company_id text NOT NULL,group_code text NOT NULL,code text NOT NULL,label text NOT NULL,version integer DEFAULT 1 NOT NULL,sort_order integer DEFAULT 0 NOT NULL,enabled integer DEFAULT 1 NOT NULL,created_at integer NOT NULL,updated_at integer NOT NULL,FOREIGN KEY(company_id) REFERENCES companies(id))`).run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS common_codes_version_uq ON common_codes(company_id,group_code,code,version)").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS system_seed_markers (company_id text NOT NULL,seed_key text NOT NULL,created_at integer NOT NULL,PRIMARY KEY(company_id,seed_key))`).run();
  const seeded=await db.prepare("SELECT seed_key FROM system_seed_markers WHERE company_id=? AND seed_key=? LIMIT 1").bind(companyId,SEED_KEY).first();
  if(seeded)return;
  await db.batch([
    ...DEFAULTS.map(([code,label],index)=>db.prepare("INSERT OR IGNORE INTO common_codes (id,company_id,group_code,code,label,version,sort_order,enabled,created_at,updated_at) VALUES (?,?,?,?,?,1,?,1,?,?)").bind(`${companyId}-drawing-type-${code.toLowerCase().replaceAll('_','-')}`,companyId,GROUP_CODE,code,label,index*10,now,now)),
    db.prepare("INSERT OR IGNORE INTO system_seed_markers (company_id,seed_key,created_at) VALUES (?,?,?)").bind(companyId,SEED_KEY,now),
  ]);
}

export async function GET(request:Request){
  const db=await runtimeDb();
  let context;
  try{await ensureProjectDataFoundation(db);context=await resolveRequestContext(request,db);await ensureDrawingTypes(db,context.companyId)}catch(reason){console.error("[DRAWING_TYPES_ERROR]",reason);return contextErrorResponse(reason)??Response.json({error:"도면 유형을 불러오지 못했습니다."},{status:500})}
  const result=await db.prepare("SELECT id,group_code AS groupCode,code,label,version,sort_order AS sortOrder,enabled FROM common_codes WHERE company_id=? AND group_code=? ORDER BY sort_order,code").bind(context.companyId,GROUP_CODE).all();
  return Response.json({groupCode:GROUP_CODE,codes:result.results??[]});
}
