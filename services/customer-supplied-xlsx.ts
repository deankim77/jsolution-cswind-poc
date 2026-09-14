import {inflateRawSync} from 'node:zlib';
import {posix} from 'node:path';
function fail():never{throw Error('Excel 파일 구조를 읽지 못했습니다. 파일 손상·암호 설정 여부를 확인하세요.');}
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
export function readCustomerSuppliedWorkbook(input:Uint8Array){
 const files=archive(input),workbook=files.get('xl/workbook.xml'),rels=files.get('xl/_rels/workbook.xml.rels');
 if(!workbook||!rels)throw Error('Excel 통합 문서 내용을 읽지 못했습니다. 파일 손상 또는 암호 설정을 확인하세요.');
 const strings=[...(files.get('xl/sharedStrings.xml')??'').matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(m=>textNodes(m[1]));
 const targets=new Map([...rels.matchAll(/<(?:\w+:)?Relationship\s+([^>]+)\/?\s*>/g)].filter(m=>attr(m[1],'TargetMode')!=='External').map(m=>[attr(m[1],'Id'),attr(m[1],'Target')]));
 const sheets:{name:string;cells:{ref:string;value:string;formula?:string}[]}[]=[];let count=0;
 for(const sheet of workbook.matchAll(/<(?:\w+:)?sheet\s+([^>]+)\/?\s*>/g)){
  const name=attr(sheet[1],'name'),target=targets.get(attr(sheet[1],'r:id'));if(!target)continue;
  const path=posix.normalize(target.startsWith('/')?target.slice(1):`xl/${target}`);if(!path.startsWith('xl/worksheets/'))continue;
  const xml=files.get(path);if(!xml)throw Error(`${name}: 시트 내용을 읽지 못했습니다.`);
  const cells:{ref:string;value:string;formula?:string}[]=[];
  for(const c of xml.matchAll(/<(?:\w+:)?c\s+([^>]*?)(?<!\/)>([\s\S]*?)<\/(?:\w+:)?c>/g)){
   const ref=attr(c[1],'r'),v=/<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(c[2])?.[1]??'';
   const value=attr(c[1],'t')==='s'?(strings[Number(v)]??''):attr(c[1],'t')==='inlineStr'?textNodes(c[2]):decode(v);
   const formula=/<(?:\w+:)?f(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?f>/.exec(c[2])?.[1];
   if(value||formula){cells.push({ref,value,...(formula?{formula:decode(formula)}:{})});if(++count>30000)throw Error('분석할 셀이 너무 많습니다. 시트별로 나누어 등록하세요.');}
  }
  if(cells.length)sheets.push({name,cells});
 }
 if(!sheets.length)throw Error('Excel에서 읽을 수 있는 셀 내용이 없습니다.');
 return sheets;
}
