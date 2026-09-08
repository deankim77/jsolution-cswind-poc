import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const now=()=>Math.floor(Date.now()/1000);

async function ensureTables(db:D1){
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS bom_revisions (
      id TEXT PRIMARY KEY NOT NULL,company_id TEXT NOT NULL,root_part_id TEXT NOT NULL,
      revision_seq INTEGER NOT NULL,revision TEXT NOT NULL,structure_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,
      change_note TEXT,created_by TEXT,created_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS bom_revisions_company_root_seq_uq ON bom_revisions(company_id,root_part_id,revision_seq)"),
    db.prepare("CREATE INDEX IF NOT EXISTS bom_revisions_company_root_idx ON bom_revisions(company_id,root_part_id,created_at)"),
  ]);
}

const revisionLabel=(seq:number)=>{
  let n=Math.max(1,seq),label="";
  while(n>0){n-=1;label=String.fromCharCode(65+n%26)+label;n=Math.floor(n/26)}
  return label;
};

const stableHash=(value:string)=>{
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return (hash>>>0).toString(16).padStart(8,"0");
};

async function buildSnapshot(db:D1,companyId:string,rootPartId:string){
  const partRows=await db.prepare("SELECT id,part_number AS partNumber,name,part_type AS partType,spec,unit,revision,status FROM product_parts WHERE company_id=? ORDER BY part_number").bind(companyId).all();
  const bomRows=await db.prepare("SELECT id,parent_part_id AS parentPartId,child_part_id AS childPartId,quantity,unit,sort_order AS sortOrder,note FROM product_bom_items WHERE company_id=? ORDER BY parent_part_id,sort_order,child_part_id").bind(companyId).all();
  const parts=(partRows.results??[]) as any[],allBom=(bomRows.results??[]) as any[];
  const byId=new Map(parts.map(part=>[part.id,part]));
  if(!byId.has(rootPartId))throw new Error("BOM을 찾지 못했습니다.");
  const children=new Map<string,any[]>();
  for(const row of allBom)children.set(row.parentPartId,[...(children.get(row.parentPartId)||[]),row]);
  const included=new Set<string>([rootPartId]),rows:any[]=[];
  const walk=(parentId:string,seen=new Set<string>())=>{
    if(seen.has(parentId))return;seen.add(parentId);
    for(const row of children.get(parentId)||[]){rows.push(row);included.add(row.childPartId);walk(row.childPartId,new Set(seen))}
  };
  walk(rootPartId);
  const snapshot={rootPartId,parts:[...included].map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>String(a.partNumber).localeCompare(String(b.partNumber))),bom:rows};
  const canonical=JSON.stringify(snapshot);
  return {snapshot,hash:stableHash(canonical)};
}

function diffSnapshots(from:any,to:any){
  const fromRows=(from?.bom||[]) as any[],toRows=(to?.bom||[]) as any[];
  const fromParts=new Map(((from?.parts||[]) as any[]).map(part=>[part.id,part]));
  const toParts=new Map(((to?.parts||[]) as any[]).map(part=>[part.id,part]));
  const fromRoot=String(from?.rootPartId||""),toRoot=String(to?.rootPartId||"");
  const key=(row:any,rootId:string)=>`${row.parentPartId===rootId?"$ROOT":row.parentPartId}>${row.childPartId}`;
  const fromMap=new Map(fromRows.map(row=>[key(row,fromRoot),row])),toMap=new Map(toRows.map(row=>[key(row,toRoot),row]));
  const added:any[]=[],removed:any[]=[],quantity:any[]=[];
  for(const [k,row] of toMap){
    const before=fromMap.get(k);
    if(!before)added.push(row);
    else if(Number(before.quantity)!==Number(row.quantity)||String(before.unit)!==String(row.unit))quantity.push({before,row});
  }
  for(const [k,row] of fromMap)if(!toMap.has(k))removed.push(row);
  const moved:any[]=[];
  for(let i=added.length-1;i>=0;i--){
    const add=added[i];const removeIndex=removed.findIndex(row=>row.childPartId===add.childPartId);
    if(removeIndex>=0){const remove=removed[removeIndex];moved.push({childPartId:add.childPartId,fromParentPartId:remove.parentPartId,toParentPartId:add.parentPartId,quantity:add.quantity,unit:add.unit});added.splice(i,1);removed.splice(removeIndex,1)}
  }
  const decorate=(row:any,parts:Map<string,any>)=>({...row,parent:parts.get(row.parentPartId),child:parts.get(row.childPartId)});
  return {
    summary:{added:added.length,removed:removed.length,quantityChanged:quantity.length,moved:moved.length,total:added.length+removed.length+quantity.length+moved.length},
    added:added.map(row=>decorate(row,toParts)),
    removed:removed.map(row=>decorate(row,fromParts)),
    quantityChanged:quantity.map(item=>({before:decorate(item.before,fromParts),after:decorate(item.row,toParts)})),
    moved:moved.map(item=>({...item,child:toParts.get(item.childPartId)||fromParts.get(item.childPartId),fromParent:fromParts.get(item.fromParentPartId),toParent:toParts.get(item.toParentPartId)})),
  };
}

async function listRevisions(db:D1,companyId:string,rootPartId:string){
  const rows=await db.prepare(`SELECT r.id,r.root_part_id AS rootPartId,r.revision_seq AS revisionSeq,r.revision,r.structure_hash AS structureHash,r.change_note AS changeNote,r.created_at AS createdAt,u.name AS createdBy
    FROM bom_revisions r LEFT JOIN users u ON u.id=r.created_by
    WHERE r.company_id=? AND r.root_part_id=? ORDER BY r.revision_seq DESC`).bind(companyId,rootPartId).all();
  return rows.results??[];
}

async function revisionSnapshot(db:D1,companyId:string,rootPartId:string,revisionSeq:number){
  return db.prepare("SELECT root_part_id AS rootPartId,revision_seq AS revisionSeq,revision,snapshot_json AS snapshotJson FROM bom_revisions WHERE company_id=? AND root_part_id=? AND revision_seq=?").bind(companyId,rootPartId,revisionSeq).first<any>();
}

export async function GET(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const url=new URL(request.url),rootPartId=String(url.searchParams.get("rootPartId")||"");
  const fromRootPartId=String(url.searchParams.get("fromRootPartId")||rootPartId||""),toRootPartId=String(url.searchParams.get("toRootPartId")||rootPartId||"");
  const fromSeq=Number(url.searchParams.get("from")||0),toSeq=Number(url.searchParams.get("to")||0);
  if(!fromSeq||!toSeq){if(!rootPartId)return Response.json({error:"BOM을 선택해 주세요."},{status:400});return Response.json({revisions:await listRevisions(db,context.companyId,rootPartId)});}
  if(!fromRootPartId||!toRootPartId)return Response.json({error:"비교할 BOM을 선택해 주세요."},{status:400});
  const [from,to]=await Promise.all([revisionSnapshot(db,context.companyId,fromRootPartId,fromSeq),revisionSnapshot(db,context.companyId,toRootPartId,toSeq)]);
  if(!from||!to)return Response.json({error:"비교할 BOM Revision을 찾지 못했습니다."},{status:404});
  const fromSnapshot=JSON.parse(from.snapshotJson),toSnapshot=JSON.parse(to.snapshotJson);
  return Response.json({from:{rootPartId:from.rootPartId,revisionSeq:fromSeq,revision:from.revision},to:{rootPartId:to.rootPartId,revisionSeq:toSeq,revision:to.revision},fromSnapshot,toSnapshot,diff:diffSnapshots(fromSnapshot,toSnapshot)});
}

export async function POST(request:Request){
  const db=await runtimeDb();await ensureTables(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const input=await request.json() as any,action=String(input.action||""),rootPartId=String(input.rootPartId||"");if(!rootPartId)return Response.json({error:"BOM을 선택해 주세요."},{status:400});
  const part=await db.prepare("SELECT id,revision FROM product_parts WHERE company_id=? AND id=?").bind(context.companyId,rootPartId).first<{id:string;revision:string}>();if(!part)return Response.json({error:"BOM을 찾지 못했습니다."},{status:404});
  if(action==="ensure-baseline"){
    const latest=await db.prepare("SELECT revision_seq AS revisionSeq,revision FROM bom_revisions WHERE company_id=? AND root_part_id=? ORDER BY revision_seq DESC LIMIT 1").bind(context.companyId,rootPartId).first<{revisionSeq:number;revision:string}>();
    if(latest)return Response.json({ok:true,created:false,revisionSeq:latest.revisionSeq,revision:latest.revision});
    const {snapshot,hash}=await buildSnapshot(db,context.companyId,rootPartId),seq=1,revision=String(part.revision||"A").trim()||"A";
    await db.prepare("INSERT INTO bom_revisions (id,company_id,root_part_id,revision_seq,revision,structure_hash,snapshot_json,change_note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,rootPartId,seq,revision,hash,JSON.stringify(snapshot),"Initial BOM baseline",context.userId,now()).run();
    return Response.json({ok:true,created:true,revisionSeq:seq,revision},{status:201});
  }
  if(action==="checkin-revision"){
    const lock=await db.prepare("SELECT locked_by AS lockedBy FROM bom_edit_locks WHERE company_id=? AND root_part_id=?").bind(context.companyId,rootPartId).first<{lockedBy:string}>();
    if(!lock||lock.lockedBy!==context.userId)return Response.json({error:"현재 사용자가 Check-out한 BOM만 Revision으로 확정할 수 있습니다."},{status:403});
    let latest=await db.prepare("SELECT revision_seq AS revisionSeq,revision,structure_hash AS structureHash FROM bom_revisions WHERE company_id=? AND root_part_id=? ORDER BY revision_seq DESC LIMIT 1").bind(context.companyId,rootPartId).first<{revisionSeq:number;revision:string;structureHash:string}>();
    if(!latest){const {snapshot,hash}=await buildSnapshot(db,context.companyId,rootPartId);await db.prepare("INSERT INTO bom_revisions (id,company_id,root_part_id,revision_seq,revision,structure_hash,snapshot_json,change_note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,rootPartId,1,String(part.revision||"A"),hash,JSON.stringify(snapshot),"Initial BOM baseline",context.userId,now()).run();latest={revisionSeq:1,revision:String(part.revision||"A"),structureHash:hash}}
    const {snapshot,hash}=await buildSnapshot(db,context.companyId,rootPartId);
    if(hash===latest.structureHash)return Response.json({ok:true,changed:false,revisionSeq:latest.revisionSeq,revision:latest.revision});
    const nextSeq=Number(latest.revisionSeq)+1,nextRevision=revisionLabel(nextSeq),t=now(),note=String(input.changeNote||"").trim()||null;
    await db.batch([
      db.prepare("INSERT INTO bom_revisions (id,company_id,root_part_id,revision_seq,revision,structure_hash,snapshot_json,change_note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.companyId,rootPartId,nextSeq,nextRevision,hash,JSON.stringify(snapshot),note,context.userId,t),
      db.prepare("UPDATE product_parts SET revision=?,updated_at=? WHERE company_id=? AND id=?").bind(nextRevision,t,context.companyId,rootPartId),
    ]);
    return Response.json({ok:true,changed:true,revisionSeq:nextSeq,revision:nextRevision},{status:201});
  }
  return Response.json({error:"지원하지 않는 작업입니다."},{status:400});
}
