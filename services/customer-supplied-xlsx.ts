import {inflateRawSync} from 'node:zlib';
import {posix} from 'node:path';
import {classifySuppliedChange,validateSuppliedFacts,type SuppliedFact} from '../lib/customer-supplied-contract';
function fail():never{throw Error('사급품 Excel 원본을 확인하세요. 지원 형식은 .xlsx입니다.');}
/** Bounded ZIP reader: never extracts paths and never follows external relationships. */
function archive(input:Uint8Array){
 const b=Buffer.from(input);if(b.length<22||b.length>12*1024*1024)fail();let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
 if(end<0||b.readUInt16LE(end+4)||b.readUInt16LE(end+6))fail();
 const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12),offset=b.readUInt32LE(end+16);if(count>1000||count!==b.readUInt16LE(end+8)||offset+size!==end)fail();
 let cursor=offset,total=0;const files=new Map<string,string>();
 for(let i=0;i<count;i++){
  if(cursor+46>end||b.readUInt32LE(cursor)!==0x02014b50)fail();
  const flags=b.readUInt16LE(cursor+8),method=b.readUInt16LE(cursor+10),compressed=b.readUInt32LE(cursor+20),uncompressed=b.readUInt32LE(cursor+24),n=b.readUInt16LE(cursor+28),extra=b.readUInt16LE(cursor+30),comment=b.readUInt16LE(cursor+32),local=b.readUInt32LE(cursor+42);
  if(cursor+46+n+extra+comment>end)fail();const name=b.subarray(cursor+46,cursor+46+n).toString('utf8');cursor+=46+n+extra+comment;
  if(!/\.xml$|\.rels$/i.test(name))continue;
  if(files.has(name)||flags&1||![0,8].includes(method)||uncompressed>16*1024*1024||(total+=uncompressed)>32*1024*1024||local+30>offset||b.readUInt32LE(local)!==0x04034b50)fail();
  const localN=b.readUInt16LE(local+26),start=local+30+localN+b.readUInt16LE(local+28);
  if(start+compressed>offset||b.subarray(local+30,local+30+localN).toString('utf8')!==name)fail();
  const data=method===8?inflateRawSync(b.subarray(start,start+compressed),{maxOutputLength:Math.max(1,uncompressed)}):b.subarray(start,start+compressed);
  if(data.length!==uncompressed)fail();const xml=data.toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml))fail();files.set(name,xml);
 }
 if(cursor!==end)fail();return files;
}
const decode=(s:string)=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v:string)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v.toLowerCase()]??''));
const attr=(s:string,k:string)=>decode(new RegExp(`(?:^|\\s)${k}=["']([^"']*)["']`).exec(s)?.[1]??'');
const textNodes=(s:string)=>[...s.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(m=>decode(m[1])).join('');
export function extractCustomerSuppliedXlsx(input:Uint8Array):SuppliedFact[]{
 const files=archive(input),workbook=files.get('xl/workbook.xml')??fail(),rels=files.get('xl/_rels/workbook.xml.rels')??fail();
 const strings=[...(files.get('xl/sharedStrings.xml')??'').matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(m=>textNodes(m[1]));
 const targets=new Map([...rels.matchAll(/<(?:\w+:)?Relationship\s+([^>]+)\/?\s*>/g)].filter(m=>attr(m[1],'TargetMode')!=='External').map(m=>[attr(m[1],'Id'),attr(m[1],'Target')]));
 const result:SuppliedFact[]=[];
 for(const sheet of workbook.matchAll(/<(?:\w+:)?sheet\s+([^>]+)\/?\s*>/g)){
  const name=attr(sheet[1],'name'),target=targets.get(attr(sheet[1],'r:id'));if(!target)fail();const path=posix.normalize(target.startsWith('/')?target.slice(1):`xl/${target}`);if(!path.startsWith('xl/worksheets/'))fail();const xml=files.get(path)??fail();
  const rows=[...xml.matchAll(/<(?:\w+:)?row\s+([^>]+)>([\s\S]*?)<\/(?:\w+:)?row>/g)].map(m=>{
   const cells=new Map<string,string>();for(const c of m[2].matchAll(/<(?:\w+:)?c\s+([^>]+)>([\s\S]*?)<\/(?:\w+:)?c>/g)){
    const ref=attr(c[1],'r'),v=/<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(c[2])?.[1]??'';if(/<(?:\w+:)?f[\s>]/.test(c[2]))throw Error(`${name}!${ref}: 수식 대신 확정된 원본 값을 사용하세요.`);
    cells.set(ref.replace(/\d+$/,''),attr(c[1],'t')==='s'?(strings[Number(v)]??fail()):attr(c[1],'t')==='inlineStr'?textNodes(c[2]):decode(v));
   }return {row:attr(m[1],'r'),cells};
  });
  const header=rows.findIndex(r=>[...r.cells.values()].some(v=>/^Component\s+(number|no\.?)$/i.test(v.trim())));if(header<0)continue;
  const headings=rows[header].cells,find=(re:RegExp)=>[...headings].find(([,v])=>re.test(v.trim()))?.[0];
  const itemCol=find(/^Component\s+(number|no\.?)$/i),descCol=find(/^Object Description$/i),qtyCol=find(/^Comp\.\s*Qty/i);if(!itemCol||!descCol||!qtyCol)fail();
  const titles=rows.slice(0,header).flatMap(r=>[...r.cells.values()]);const declared=titles.map(t=>/^\s*(\S+)\s+Vestas provided components\s*$/i.exec(t)?.[1]).filter(Boolean) as string[];
  if(new Set(declared).size>1)throw Error(`${name}: SECTION 표기가 서로 다릅니다.`);const section=declared[0]||(/^\d+$/.test(name)?name:'');
  if(!section.trim())fail();
  for(const row of rows.slice(header+1)){
   const itemNumber=row.cells.get(itemCol)?.trim()??'',description=row.cells.get(descCol)?.trim()??'',qty=row.cells.get(qtyCol)?.trim()??'';
   if(!itemNumber&&!description&&!qty)continue;
   if(!itemNumber||!description||!qty||!/^\d+(?:\.\d+)?$/.test(qty))throw Error(`${name}!${row.row}: 품목번호·품명·수량을 확인하세요.`);
   const changeText=[...row.cells].filter(([col,v])=>![itemCol,descCol,qtyCol].includes(col)&&v.trim()).map(([,v])=>v.trim()).join('\n');
   result.push({id:`${name}:${row.row}`,section,itemNumber,description,quantity:Number(qty),changeText,...classifySuppliedChange(changeText,itemNumber),source:`${name}!${itemCol}${row.row}:${[...row.cells.keys()].at(-1)}${row.row}`});
  }
 }
 return validateSuppliedFacts(result);
}
