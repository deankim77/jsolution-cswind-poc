import {REVIEW_USE_TARGETS,type ReviewArea,type ReviewItem,type ConfirmedReview} from './customer-review-contract';
export type BulkRow={id:string;recordId:string;version:number;item:ReviewItem;partNumber?:string;level?:number};
export type BulkState={rows:BulkRow[];canEdit:boolean;lock:null|{mine:boolean;token?:string;owner:string}};
export const bulkFields={pbom:[['section','SECTION'],['itemDescription','Item Description'],['position','POS'],['customerItemNumber','Item No.'],['drawingNumber','Drawing No.'],['componentRevision','CompRev'],['quantity','Qty Per Unit'],['unit','수량 단위'],['weight','Weight'],['weightUnit','중량 단위'],['material','Material']],extract:[['useTargets','활용 대상'],['assy','ASSY'],['part','PART'],['itemNumber','품번'],['itemName','추출 항목'],['detail','AI 추출 내용']]} as const;
export function activeBulkRows(rows:ConfirmedReview[],area:ReviewArea):BulkRow[]{
 const scoped=rows.filter(r=>r.item.area===area),latest=new Map<string,number>();
 for(const r of scoped)latest.set(r.recordId,Math.max(latest.get(r.recordId)??0,r.version));
 const active=new Map<string,ConfirmedReview>();
 for(const r of scoped){if(area==='pbom'&&r.version!==latest.get(r.recordId))continue;const key=`${r.recordId}:${r.item.id}`,old=active.get(key);if(!old||old.version<r.version)active.set(key,r);}
 const result=[...active.values()].map(({id,recordId,version,item})=>({id,recordId,version,item}));
 const order=(a:BulkRow,b:BulkRow)=>a.recordId.localeCompare(b.recordId)||(a.item.bom?.position||a.item.title).localeCompare(b.item.bom?.position||b.item.title,undefined,{numeric:true})||a.id.localeCompare(b.id);
 if(area!=='pbom')return result.sort(order);
 const ordered:BulkRow[]=[],visited=new Set<string>();
 const visit=(row:BulkRow,level:number)=>{if(visited.has(row.id))return;visited.add(row.id);ordered.push({...row,level});result.filter(child=>child.recordId===row.recordId&&child.item.bom?.parentId===row.item.id).sort(order).forEach(child=>visit(child,level+1));};
 result.filter(row=>!row.item.bom?.parentId).sort(order).forEach(row=>visit(row,1));result.sort(order).forEach(row=>visit(row,1));return ordered;
}
export function bulkCell(row:BulkRow,area:ReviewArea,key:string){const value=(area==='pbom'?row.item.bom:row.item) as unknown as Record<string,unknown>;const v=value?.[key];return Array.isArray(v)?v.join(' / '):v==null?'':String(v);}
export function updateBulkCell(row:BulkRow,area:ReviewArea,key:string,text:string):BulkRow{
 if(!bulkFields[area].some(([field])=>field===key))throw Error('편집할 수 없는 컬럼입니다.');
 let value:unknown=text;
 if(area==='pbom'&&['quantity','weight'].includes(key)){const normalized=text.trim().replaceAll(',','');value=normalized===''?null:Number(normalized);if(value!==null&&(!Number.isFinite(value)||Number(value)<0||(key==='quantity'&&Number(value)===0)))throw Error('수량은 양수, 중량은 0 이상으로 입력하세요. 미확인은 빈칸으로 두세요.');}
 if(key==='useTargets'){value=[...new Set(text.split(/[,/\n]/).map(v=>v.trim()).filter(Boolean))];if(!(value as string[]).length||(value as string[]).some(v=>!(REVIEW_USE_TARGETS as readonly string[]).includes(v)))throw Error('활용 대상: TTR / 조립기준 / 검사기준 / 작업방법 / 기타');}
 return area==='pbom'?{...row,item:{...row.item,bom:{...row.item.bom!,[key]:value}}}:{...row,item:{...row.item,[key]:value}};
}
/** Only whitelisted cell values can cross the editing boundary. */
export function mergeBulkEdits(base:BulkRow[],input:unknown,area:ReviewArea){
 if(!Array.isArray(input)||input.length!==base.length)throw Error('행을 추가하거나 삭제할 수 없습니다. 새로고침 후 다시 확인하세요.');
 const byId=new Map(input.map(row=>[row?.id,row]));if(byId.size!==base.length)throw Error('중복된 편집 행입니다.');
 return base.map(row=>{const edited=byId.get(row.id);if(!edited?.item)throw Error('편집 대상이 변경되었습니다.');let next=row;
 for(const [field] of bulkFields[area]){const value=bulkCell(edited,area,field);if(value!==bulkCell(row,area,field))next=updateBulkCell(next,area,field,value);}
 return next;});
}

export function parseGridClipboard(text:string):string[][]{
 const rows:string[][]=[],row:string[]=[];let cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&(quoted||cell==='')){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
 else if(!quoted&&(c==='\t'||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!=='\t'){rows.push([...row]);row.length=0;if(c==='\r'&&text[i+1]==='\n')i++;}}
 else cell+=c;}
 if(quoted)throw Error('붙여넣기 내용의 따옴표를 확인하세요.');
 if(cell!==''||row.length||!rows.length){row.push(cell);rows.push(row);}return rows;
}
