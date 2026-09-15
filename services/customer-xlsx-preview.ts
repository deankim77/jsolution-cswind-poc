import {readCustomerSuppliedWorkbook} from './customer-supplied-xlsx';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const columnName=(index:number)=>{let name='';for(let n=index;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};

/** Read-only preview: formulas are never evaluated and workbook markup is escaped. */
export function customerXlsxPreview(bytes:Uint8Array,fileName:string){
 const sheets=readCustomerSuppliedWorkbook(bytes);
 const text=sheets.map(sheet=>`${sheet.name}\n${sheet.cells.map(cell=>`${cell.ref}\t${cell.value||`=${cell.formula??''}`}`).join('\n')}`).join('\n\n');
 const tables=sheets.map((sheet,index)=>{
  const rows=new Map<number,Map<number,string>>();let maxColumn=0,limited=false;
  for(const cell of sheet.cells){
   const match=/^([A-Z]+)([1-9]\d*)$/i.exec(cell.ref);if(!match)continue;
   const column=[...match[1].toUpperCase()].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),row=Number(match[2]);
   if(row>1000||column>100){limited=true;continue;}
   if(!rows.has(row))rows.set(row,new Map());rows.get(row)!.set(column,cell.value||`=${cell.formula??''}`);maxColumn=Math.max(maxColumn,column);
  }
  const columns=Array.from({length:maxColumn},(_,i)=>i+1);
  return `<section id="sheet-${index}"><h2>${escape(sheet.name)}</h2>${limited?'<p>미리보기는 시트별 첫 1,000행·100열까지 표시합니다. 전체 내용은 원본을 다운로드해 확인하세요.</p>':''}<div class="sheet-table"><table><thead><tr><th scope="col">행</th>${columns.map(c=>`<th scope="col">${columnName(c)}</th>`).join('')}</tr></thead><tbody>${[...rows].sort(([a],[b])=>a-b).map(([row,cells])=>`<tr><th scope="row">${row}</th>${columns.map(c=>`<td>${escape(cells.get(c)||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
 }).join('');
 const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(fileName)}</title><style>
 *{box-sizing:border-box}body{margin:0;font:14px/1.5 Arial,"Malgun Gothic",sans-serif;color:#203747;background:#f4f8f9}header{padding:16px 20px;background:white;border-bottom:1px solid #dce5e9}h1{font-size:22px;margin:0 0 6px;overflow-wrap:anywhere}header p{margin:0;color:#657984;font-size:12px}nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px}a{color:#008b90;text-decoration:none}section{padding:16px 20px}h2{font-size:18px;margin:0 0 12px}.sheet-table{overflow:auto;max-height:75vh;border:1px solid #dce5e9;background:white}table{border-collapse:separate;border-spacing:0;min-width:100%;text-align:left}th,td{padding:8px 12px;border-right:1px solid #dce5e9;border-bottom:1px solid #dce5e9;min-width:90px;max-width:480px;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#eaf2f5;font-size:13px}thead{position:sticky;top:0;z-index:2}tbody th{position:sticky;left:0;min-width:48px}td{vertical-align:top}
 </style></head><body><header><h1>${escape(fileName)}</h1><p>셀 내용 미리보기 · 원본의 서식·병합·차트는 생략되며, 수식은 저장된 결과값을 표시합니다.</p><nav>${sheets.map((sheet,i)=>`<a href="#sheet-${i}">${escape(sheet.name)}</a>`).join('')}</nav></header>${tables}</body></html>`;
 return {text,html};
}
