import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const now=()=>Math.floor(Date.now()/1000);

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
    db.prepare(`CREATE TABLE IF NOT EXISTS part_number_settings (
      company_id TEXT PRIMARY KEY NOT NULL,prefix TEXT NOT NULL DEFAULT 'P',separator TEXT NOT NULL DEFAULT '-',digits INTEGER NOT NULL DEFAULT 6,
      next_sequence INTEGER NOT NULL DEFAULT 1,allow_manual INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS part_category_links (
      company_id TEXT NOT NULL,part_id TEXT PRIMARY KEY NOT NULL,category_id TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS bom_revisions (
      id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,root_part_id TEXT NOT NULL,
      revision_seq INTEGER NOT NULL,revision TEXT NOT NULL,structure_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,
      change_note TEXT,created_by TEXT,created_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS bom_revisions_company_root_seq_uq ON bom_revisions(company_id,root_part_id,revision_seq)"),
  ]);
}

async function ensureNumberSetting(db:D1,companyId:string){
  const setting=await db.prepare("SELECT company_id FROM part_number_settings WHERE company_id=?").bind(companyId).first();
  if(!setting)await db.prepare("INSERT INTO part_number_settings (company_id,prefix,separator,digits,next_sequence,allow_manual,updated_at) VALUES (?,'P','-',6,1,1,?)").bind(companyId,now()).run();
}

async function nextPartNumber(db:D1,companyId:string){
  const setting=await db.prepare("SELECT prefix,separator,digits,next_sequence AS nextSequence FROM part_number_settings WHERE company_id=?").bind(companyId).first<{prefix:string;separator:string;digits:number;nextSequence:number}>();
  const prefix=String(setting?.prefix??"P"),separator=String(setting?.separator??"-"),digits=Math.max(3,Math.min(12,Number(setting?.digits||6)));
  let sequence=Math.max(1,Number(setting?.nextSequence||1)),partNumber="";
  for(let attempt=0;attempt<1000;attempt++,sequence++){
    partNumber=`${prefix}${separator}${String(sequence).padStart(digits,"0")}`;
    const exists=await db.prepare("SELECT id FROM product_parts WHERE company_id=? AND UPPER(part_number)=UPPER(?) LIMIT 1").bind(companyId,partNumber).first();
    if(!exists)break;
  }
  await db.prepare("UPDATE part_number_settings SET next_sequence=?,updated_at=? WHERE company_id=?").bind(sequence+1,now(),companyId).run();
  return {partNumber,ruleCode:`${prefix}${separator}SEQ${digits}`};
}

const stableHash=(value:string)=>{let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return (hash>>>0).toString(16).padStart(8,"0")};

async function buildSnapshot(db:D1,companyId:string,rootPartId:string){
  const partRows=await db.prepare("SELECT id,part_number AS partNumber,name,part_type AS partType,spec,unit,revision,status FROM product_parts WHERE company_id=? ORDER BY part_number").bind(companyId).all();
  const bomRows=await db.prepare("SELECT id,parent_part_id AS parentPartId,child_part_id AS childPartId,quantity,unit,sort_order AS sortOrder,note FROM product_bom_items WHERE company_id=? ORDER BY parent_part_id,sort_order,child_part_id").bind(companyId).all();
  const parts=(partRows.results??[]) as any[],allBom=(bomRows.results??[]) as any[],byId=new Map(parts.map(part=>[part.id,part]));
  const children=new Map<string,any[]>();for(const row of allBom)children.set(row.parentPartId,[...(children.get(row.parentPartId)||[]),row]);
  const included=new Set<string>([rootPartId]),rows:any[]=[];const walk=(parentId:string,seen=new Set<string>())=>{if(seen.has(parentId))return;seen.add(parentId);for(const row of children.get(parentId)||[]){rows.push(row);included.add(row.childPartId);walk(row.childPartId,new Set(seen))}};walk(rootPartId);
  const snapshot={rootPartId,parts:[...included].map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>String(a.partNumber).localeCompare(String(b.partNumber))),bom:rows};const canonical=JSON.stringify(snapshot);return {snapshot,hash:stableHash(canonical)};
}

export async function POST(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  await ensureNumberSetting(db,context.companyId);const input=await request.json() as any,sourceRootPartId=String(input.sourceRootPartId||"").trim();if(!sourceRootPartId)return Response.json({error:"복사할 BOM을 선택해 주세요."},{status:400});
  const source=await db.prepare("SELECT id,part_number AS partNumber,name,part_type AS partType,spec,unit,revision,status,standard_cost AS standardCost FROM product_parts WHERE company_id=? AND id=?").bind(context.companyId,sourceRootPartId).first<any>();if(!source)return Response.json({error:"복사할 BOM을 찾지 못했습니다."},{status:404});
  const directRows=await db.prepare("SELECT child_part_id AS childPartId,quantity,unit,sort_order AS sortOrder,note FROM product_bom_items WHERE company_id=? AND parent_part_id=? ORDER BY sort_order,child_part_id").bind(context.companyId,sourceRootPartId).all();const children=(directRows.results??[]) as any[];if(!children.length)return Response.json({error:"복사할 하위 BOM 구조가 없습니다."},{status:409});
  const category=await db.prepare("SELECT category_id AS categoryId FROM part_category_links WHERE company_id=? AND part_id=?").bind(context.companyId,sourceRootPartId).first<{categoryId:string}>();
  const generated=await nextPartNumber(db,context.companyId),id=crypto.randomUUID(),t=now();
  const requestedName=String(input.name??"").trim(),requestedSpec=input.spec===undefined?undefined:String(input.spec??"").trim();
  const name=requestedName||`${String(source.name||"").trim()} COPY`;const spec=requestedSpec===undefined?(source.spec??null):(requestedSpec||null);
  const statements:any[]=[db.prepare("INSERT INTO product_parts (id,company_id,part_number,name,part_type,spec,unit,revision,status,standard_cost,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'A','active',?,?,?,?)").bind(id,context.companyId,generated.partNumber,name,String(source.partType||"TOP_ITEM"),spec,String(source.unit||"EA"),Math.max(0,Number(source.standardCost)||0),context.userId,t,t),db.prepare("INSERT INTO part_number_history (id,company_id,part_id,part_number,rule_code,created_by,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,id,generated.partNumber,generated.ruleCode,context.userId,t)];
  if(category?.categoryId)statements.push(db.prepare("INSERT INTO part_category_links (company_id,part_id,category_id,created_at,updated_at) VALUES (?,?,?,?,?)").bind(context.companyId,id,category.categoryId,t,t));
  for(const row of children)statements.push(db.prepare("INSERT INTO product_bom_items (id,company_id,parent_part_id,child_part_id,quantity,unit,sort_order,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,id,row.childPartId,Number(row.quantity)||1,String(row.unit||"EA"),Number(row.sortOrder)||0,row.note??null,t,t));
  await db.batch(statements);const {snapshot,hash}=await buildSnapshot(db,context.companyId,id);await db.prepare("INSERT INTO bom_revisions (id,company_id,root_part_id,revision_seq,revision,structure_hash,snapshot_json,change_note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,id,1,"A",hash,JSON.stringify(snapshot),`Copied from ${source.partNumber} Rev.${source.revision||"A"}`,context.userId,t).run();
  return Response.json({ok:true,id,partNumber:generated.partNumber,name,spec,revision:"A",sourceRootPartId,sourcePartNumber:source.partNumber,copiedItems:children.length},{status:201});
}
