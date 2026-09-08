import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const now=()=>Math.floor(Date.now()/1000);
const normalizeRole=(value:string)=>value==="TOP_ITEM"||value==="ASSEMBLY"?value:"PART";

const DEFAULT_CATEGORIES=[
  ["PURCHASED","구매품"],["MACHINED","가공품"],["INJECTION","사출품"],["SHEET_METAL","판금품"],
  ["ELECTRICAL","전장품"],["MECHANICAL","기구품"],["RAW_MATERIAL","원자재"],["CONSUMABLE","소모품"],["OTHER","기타"],
] as const;

async function ensureTables(db:D1){
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS product_parts (
      id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,part_number TEXT NOT NULL,name TEXT NOT NULL,
      part_type TEXT NOT NULL DEFAULT 'PART',spec TEXT,unit TEXT NOT NULL DEFAULT 'EA',revision TEXT NOT NULL DEFAULT 'A',
      status TEXT NOT NULL DEFAULT 'active',standard_cost REAL NOT NULL DEFAULT 0,created_by TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS product_parts_company_number_uq ON product_parts(company_id,part_number)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS product_bom_items (
      id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,parent_part_id TEXT NOT NULL,child_part_id TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,unit TEXT NOT NULL DEFAULT 'EA',sort_order INTEGER NOT NULL DEFAULT 0,note TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS product_bom_parent_child_uq ON product_bom_items(company_id,parent_part_id,child_part_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS part_number_history (
      id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,part_id TEXT NOT NULL,part_number TEXT NOT NULL,rule_code TEXT NOT NULL,created_by TEXT,created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS part_categories (
      id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,code TEXT NOT NULL,name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS part_categories_company_code_uq ON part_categories(company_id,code)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS part_category_links (
      company_id TEXT NOT NULL,part_id TEXT PRIMARY KEY NOT NULL,category_id TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS part_number_settings (
      company_id TEXT PRIMARY KEY NOT NULL,prefix TEXT NOT NULL DEFAULT 'P',separator TEXT NOT NULL DEFAULT '-',digits INTEGER NOT NULL DEFAULT 6,
      next_sequence INTEGER NOT NULL DEFAULT 1,allow_manual INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL
    )`),
  ]);
}

async function ensureDefaults(db:D1,companyId:string){
  const t=now();
  const categoryCount=await db.prepare("SELECT COUNT(*) AS count FROM part_categories WHERE company_id=?").bind(companyId).first<{count:number}>();
  if(Number(categoryCount?.count||0)===0){
    await db.batch(DEFAULT_CATEGORIES.map(([code,name],index)=>db.prepare("INSERT INTO part_categories (id,company_id,code,name,is_active,sort_order,created_at,updated_at) VALUES (?,?,?,?,1,?,?,?)").bind(crypto.randomUUID(),companyId,code,name,index,t,t)));
  }
  const setting=await db.prepare("SELECT company_id FROM part_number_settings WHERE company_id=?").bind(companyId).first();
  if(!setting)await db.prepare("INSERT INTO part_number_settings (company_id,prefix,separator,digits,next_sequence,allow_manual,updated_at) VALUES (?,'P','-',6,1,1,?)").bind(companyId,t).run();
}

async function nextPartNumber(db:D1,companyId:string){
  const setting=await db.prepare("SELECT prefix,separator,digits,next_sequence AS nextSequence FROM part_number_settings WHERE company_id=?").bind(companyId).first<{prefix:string;separator:string;digits:number;nextSequence:number}>();
  const prefix=String(setting?.prefix??"P"),separator=String(setting?.separator??"-"),digits=Math.max(3,Math.min(12,Number(setting?.digits||6)));
  let sequence=Math.max(1,Number(setting?.nextSequence||1));
  let partNumber="";
  for(let attempt=0;attempt<1000;attempt++,sequence++){
    partNumber=`${prefix}${separator}${String(sequence).padStart(digits,"0")}`;
    const exists=await db.prepare("SELECT id FROM product_parts WHERE company_id=? AND UPPER(part_number)=UPPER(?) LIMIT 1").bind(companyId,partNumber).first();
    if(!exists)break;
  }
  await db.prepare("UPDATE part_number_settings SET next_sequence=?,updated_at=? WHERE company_id=?").bind(sequence+1,now(),companyId).run();
  return {partNumber,ruleCode:`${prefix}${separator}SEQ${digits}`};
}

export async function GET(request:Request){
  const db=await runtimeDb();await ensureTables(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  await ensureDefaults(db,context.companyId);
  const [categories,setting,links]=await Promise.all([
    db.prepare("SELECT id,code,name,is_active AS isActive,sort_order AS sortOrder FROM part_categories WHERE company_id=? ORDER BY is_active DESC,sort_order,name").bind(context.companyId).all(),
    db.prepare("SELECT prefix,separator,digits,next_sequence AS nextSequence,allow_manual AS allowManual FROM part_number_settings WHERE company_id=?").bind(context.companyId).first(),
    db.prepare("SELECT part_id AS partId,category_id AS categoryId FROM part_category_links WHERE company_id=?").bind(context.companyId).all(),
  ]);
  return Response.json({categories:categories.results??[],numberSetting:setting,categoryLinks:links.results??[]});
}

export async function POST(request:Request){
  const db=await runtimeDb();await ensureTables(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  await ensureDefaults(db,context.companyId);
  const input=await request.json() as any;
  const name=String(input.name||"").trim();
  const itemRole=normalizeRole(String(input.itemRole||"PART").toUpperCase());
  const unit=String(input.unit||"EA").trim()||"EA";
  const spec=String(input.spec||"").trim()||null;
  const categoryId=String(input.categoryId||"").trim();
  const numberMode=String(input.numberMode||"auto")==="manual"?"manual":"auto";
  if(!name)return Response.json({error:"품명을 입력해 주세요."},{status:400});

  if(categoryId){
    const category=await db.prepare("SELECT id FROM part_categories WHERE company_id=? AND id=? AND is_active=1").bind(context.companyId,categoryId).first();
    if(!category)return Response.json({error:"선택한 부품 유형을 사용할 수 없습니다."},{status:400});
  }

  const setting=await db.prepare("SELECT allow_manual AS allowManual FROM part_number_settings WHERE company_id=?").bind(context.companyId).first<{allowManual:number}>();
  let partNumber="",ruleCode="MANUAL";
  if(numberMode==="manual"){
    if(Number(setting?.allowManual??1)!==1)return Response.json({error:"현재 회사 설정에서는 품번 직접입력을 사용할 수 없습니다."},{status:403});
    partNumber=String(input.partNumber||"").trim();
    if(!partNumber)return Response.json({error:"PART Code를 입력해 주세요."},{status:400});
    const duplicate=await db.prepare("SELECT id FROM product_parts WHERE company_id=? AND UPPER(part_number)=UPPER(?) LIMIT 1").bind(context.companyId,partNumber).first();
    if(duplicate)return Response.json({error:"이미 사용 중인 PART Code입니다."},{status:409});
  }else{
    const generated=await nextPartNumber(db,context.companyId);partNumber=generated.partNumber;ruleCode=generated.ruleCode;
  }

  const id=crypto.randomUUID(),t=now();
  const statements:any[]=[
    db.prepare("INSERT INTO product_parts (id,company_id,part_number,name,part_type,spec,unit,revision,status,standard_cost,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'A','active',0,?,?,?)").bind(id,context.companyId,partNumber,name,itemRole,spec,unit,context.userId,t,t),
    db.prepare("INSERT INTO part_number_history (id,company_id,part_id,part_number,rule_code,created_by,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,id,partNumber,ruleCode,context.userId,t),
  ];
  if(categoryId)statements.push(db.prepare("INSERT INTO part_category_links (company_id,part_id,category_id,created_at,updated_at) VALUES (?,?,?,?,?)").bind(context.companyId,id,categoryId,t,t));
  await db.batch(statements);
  return Response.json({ok:true,id,partNumber,itemRole,categoryId:categoryId||null,revision:"A"},{status:201});
}

export async function PATCH(request:Request){
  const db=await runtimeDb();await ensureTables(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  await ensureDefaults(db,context.companyId);
  const input=await request.json() as any;
  const partId=String(input.partId||"").trim();
  const name=String(input.name||"").trim();
  const itemRole=normalizeRole(String(input.itemRole||"PART").toUpperCase());
  const unit=String(input.unit||"EA").trim()||"EA";
  const spec=String(input.spec||"").trim()||null;
  const status=String(input.status||"active")==="inactive"?"inactive":"active";
  const categoryId=String(input.categoryId||"").trim();
  if(!partId||!name)return Response.json({error:"PART와 품명을 확인해 주세요."},{status:400});
  const existing=await db.prepare("SELECT id,part_type AS partType FROM product_parts WHERE company_id=? AND id=?").bind(context.companyId,partId).first<{id:string;partType:string}>();
  if(!existing)return Response.json({error:"PART를 찾지 못했습니다."},{status:404});
  if(itemRole==="PART"){
    const child=await db.prepare("SELECT id FROM product_bom_items WHERE company_id=? AND parent_part_id=? LIMIT 1").bind(context.companyId,partId).first();
    if(child)return Response.json({error:"하위 구조가 있는 Assembly는 Part로 변경할 수 없습니다. 먼저 하위 연결을 해제해 주세요."},{status:409});
  }
  if(categoryId){
    const category=await db.prepare("SELECT id FROM part_categories WHERE company_id=? AND id=? AND is_active=1").bind(context.companyId,categoryId).first();
    if(!category)return Response.json({error:"선택한 부품 유형을 사용할 수 없습니다."},{status:400});
  }
  const t=now();
  const statements:any[]=[
    db.prepare("UPDATE product_parts SET name=?,part_type=?,spec=?,unit=?,status=?,updated_at=? WHERE company_id=? AND id=?").bind(name,itemRole,spec,unit,status,t,context.companyId,partId),
    db.prepare("DELETE FROM part_category_links WHERE company_id=? AND part_id=?").bind(context.companyId,partId),
  ];
  if(categoryId)statements.push(db.prepare("INSERT INTO part_category_links (company_id,part_id,category_id,created_at,updated_at) VALUES (?,?,?,?,?)").bind(context.companyId,partId,categoryId,t,t));
  await db.batch(statements);
  return Response.json({ok:true,partId,itemRole,categoryId:categoryId||null});
}
