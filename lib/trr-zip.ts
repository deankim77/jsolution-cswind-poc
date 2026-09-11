type ZipEntry={name:string;data:Uint8Array};
const encoder=new TextEncoder();
const utf8=(value:string)=>encoder.encode(value);
const xmlEscape=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table;})();
const crc32=(data:Uint8Array)=>{let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
const u16=(n:number)=>[n&255,(n>>>8)&255];
const u32=(n:number)=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
const bytes=(values:number[])=>new Uint8Array(values);
function concat(parts:Uint8Array[]){const size=parts.reduce((sum,p)=>sum+p.length,0);const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
export function zipStore(entries:ZipEntry[]){const locals:Uint8Array[]=[];const centrals:Uint8Array[]=[];let offset=0;for(const entry of entries){const name=utf8(entry.name),data=entry.data,crc=crc32(data);const local=concat([bytes([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]),name,data]);locals.push(local);centrals.push(concat([bytes([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]),name]));offset+=local.length;}const central=concat(centrals);return concat([...locals,central,bytes([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(central.length),...u32(offset),...u16(0)])]);}
