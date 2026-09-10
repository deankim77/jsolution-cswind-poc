import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import manifest from '../lib/production/tc800-input-manifest.json' with { type: 'json' };

const maxArchive = 50 * 1024 * 1024;
const fail = () => { throw new Error('TC800 V4 원본 ZIP을 확인하세요. 손상되었거나 지원하지 않는 파일입니다.'); };

/** Reads the allowlisted original package only, with no extraction paths or new dependency. */
export function readTc800InitialPackage(input) {
  const bytes = Buffer.from(input);
  if (bytes.length < 22 || bytes.length > maxArchive) fail();
  let end = -1;
  for (let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
    if (bytes.readUInt32LE(i)===0x06054b50 && i+22+bytes.readUInt16LE(i+20)===bytes.length) { end=i; break; }
  }
  if (end<0 || bytes.readUInt16LE(end+4)!==0 || bytes.readUInt16LE(end+6)!==0) fail();
  const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),offset=bytes.readUInt32LE(end+16);
  if (count>1000 || count!==bytes.readUInt16LE(end+8) || offset+size!==end) fail();
  const expected=new Map(manifest.map(row=>[row.path,row])), found=new Map();
  let cursor=offset;
  for(let index=0;index<count;index++) {
    if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50)fail();
    const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),uncompressed=bytes.readUInt32LE(cursor+24);
    const nameLength=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),local=bytes.readUInt32LE(cursor+42);
    if(cursor+46+nameLength+extra+comment>end)fail();
    const nameBytes=bytes.subarray(cursor+46,cursor+46+nameLength),name=nameBytes.toString('utf8');
    cursor+=46+nameLength+extra+comment;
    const item=expected.get(name);
    if(!item)continue;
    if(found.has(name)||flags&1||![0,8].includes(method)||uncompressed!==item.size||compressed>maxArchive)fail();
    if(local+30>offset||bytes.readUInt32LE(local)!==0x04034b50)fail();
    if(bytes.readUInt16LE(local+6)!==flags||bytes.readUInt16LE(local+8)!==method)fail();
    const localName=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28),start=local+30+localName+localExtra;
    if(start+compressed>offset||!bytes.subarray(local+30,local+30+localName).equals(nameBytes))fail();
    const body=bytes.subarray(start,start+compressed);
    const content=method===8?inflateRawSync(body,{maxOutputLength:item.size}):Buffer.from(body);
    if(content.length!==item.size||createHash('sha256').update(content).digest('hex')!==item.sha256)fail();
    found.set(name,{...item,name:name.split('/').at(-1),content});
  }
  if(cursor!==end||found.size!==manifest.length)fail();
  return manifest.map(row=>found.get(row.path));
}
