import {zipStore} from '../lib/trr-zip';
import {pbomColumns,type ColumnKey} from '../lib/pbom-columns';
import {bomSectionName,DRAWING_AVAILABILITY_LABELS,type BomRow,type ProjectPbom} from '../lib/pbom-contract';

const xml=(value:unknown)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const col=(n:number)=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
export function pbomExcelValue(key:ColumnKey,row:BomRow,rows:BomRow[],sources:Record<string,string>):string|number|null{
 const b=row.bom;
 switch(key){
 case 'part':return row.internalPartNumber??'';
 case 'status':return ({NEW:'NEW · 신규',EXISTING:'기존 부품',NEED_REVIEW:'확인 필요',MANUAL:'내부 추가'}[row.match??'NEED_REVIEW'])+(row.changed?` · ${row.changeLabel||'Revision 변경'}`:'');
 case 'procurement':return row.procurement==='supplied'?'사급':row.procurement==='own'?'자체 조달':'미확인';
 case 'section':return bomSectionName(row,rows);
 case 'level':return row.level;
 case 'description':return b.itemDescription;
 case 'position':return b.position;
 case 'item':return b.customerItemNumber;
 case 'drawing':return b.drawingNumber;
 case 'revision':return b.componentRevision||'미확인';
 case 'quantity':return b.quantity;
 case 'unit':return b.unit||'미확인';
 case 'total':return row.totalQuantity;
 case 'weight':return b.weightUnit?`${row.calculatedWeight??'미확인'} ${b.weightUnit}`:row.calculatedWeight;
 case 'weightSource':return row.calculatedWeightSource;
 case 'availability':return DRAWING_AVAILABILITY_LABELS[b.drawingAvailability];
 case 'source':return (row.sourceRecordIds??[row.recordId]).map(id=>sources[id]??id).join(', ');
 case 'reviewDescription':case 'reviewTotal':case 'reviewDrawing':case 'reviewPosition':case 'reviewRevision':return row.confirmationId?'OK':'미확정';
 case 'remark':return b.remark??'';
 case 'customerReply':return b.customerReply??'';
 }
}

/** Excel text cells stay literal, including customer IDs and strings beginning with '='. */
export function buildPbomExcel(data:ProjectPbom,sources:Record<string,string>={},date=new Date()):Uint8Array{
 const count=pbomColumns.length,last=col(count-1),title=data.root?.name||'프로젝트 BOM';
 const cell=(value:string|number|null,index:number,row:number,style=0)=>{const ref=`${col(index)}${row}`;return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;};
 const sheetRows=[`<row r="1" ht="32" customHeight="1">${cell(`${title} · BOM REVIEW REPORT`,0,1,1)}</row>`,`<row r="2" ht="24" customHeight="1">${cell(`JSOLUTION AI PLM  |  ${date.toISOString().slice(0,10)}  |  ${data.rows.length}개 BOM 항목  |  OK: 사용자 검토·확정 완료`,0,2,2)}</row>`,`<row r="3" ht="24" customHeight="1">${cell('BOM 정보',0,3,3)}${cell('검토 결과',17,3,3)}</row>`,`<row r="4" ht="34" customHeight="1">${pbomColumns.map((c,i)=>cell(c.label,i,4,4)).join('')}</row>`];
 let rowNumber=5;
 if(data.root){sheetRows.push(`<row r="${rowNumber}" ht="26" customHeight="1">${pbomColumns.map((c,i)=>cell(c.key==='part'?data.root!.partNumber:c.key==='description'?title:c.key==='level'?0:c.key==='status'?'프로젝트 TOP':'',i,rowNumber,5)).join('')}</row>`);rowNumber++;}
 for(const row of data.rows){const r=rowNumber++,assembly=row.bom.partType==='ASSEMBLY';sheetRows.push(`<row r="${r}" ht="${row.bom.remark?.includes('\n')||row.bom.customerReply?.includes('\n')?42:26}" customHeight="1" outlineLevel="${Math.min(7,Math.max(0,row.level))}">${pbomColumns.map((c,i)=>{const value=pbomExcelValue(c.key,row,data.rows,sources);const style=c.key.startsWith('review')?(value==='OK'?7:8):c.key==='part'?9+Math.min(7,Math.max(0,row.level)):typeof value==='number'?6:assembly?5:0;return cell(value,i,r,style);}).join('')}</row>`);}
 const width=(key:ColumnKey)=>key==='description'?42:key==='remark'||key==='customerReply'?48:key==='weightSource'?38:key==='drawing'||key==='source'||key==='section'?27:key.startsWith('review')?23:key==='part'||key==='item'||key==='availability'?22:key==='status'||key==='total'?23:15;
 const sheet=`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><outlinePr summaryBelow="0"/></sheetPr><dimension ref="A1:${last}${rowNumber-1}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="4" topLeftCell="C5" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="26" outlineLevelRow="7"/><cols>${pbomColumns.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${width(c.key)}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A4:${last}${rowNumber-1}"/><mergeCells count="4"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/><mergeCell ref="A3:Q3"/><mergeCell ref="R3:${last}3"/></mergeCells><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="8" orientation="landscape"/></worksheet>`;
 const xf=(font=0,fill=0,alignment='vertical="center" wrapText="1"',numFmt=0)=>`<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="1" xfId="0" applyAlignment="1" applyFill="1" applyFont="1"${numFmt?' applyNumberFormat="1"':''}><alignment ${alignment}/></xf>`;
 const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.########"/></numFmts><fonts count="6"><font><sz val="11"/><name val="Calibri"/><color rgb="FF243746"/></font><font><b/><sz val="18"/><name val="Calibri"/><color rgb="FF087F83"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF087F83"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF187448"/></font><font><sz val="11"/><name val="Calibri"/><color rgb="FF9A6700"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF087F83"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF3F5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F8F9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left/><right/><top/><bottom style="hair"><color rgb="FFDDE6EB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="17">${xf()}${xf(1)}${xf()}${xf(2,2)}${xf(3,3)}${xf(3,4)}${xf(0,0,'vertical="center" horizontal="right"',164)}${xf(4,0,'vertical="center" horizontal="center"')}${xf(5,0,'vertical="center" horizontal="center"')}${Array.from({length:8},(_,i)=>xf(3,0,`vertical="center" horizontal="left" indent="${i}"`)).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 const entries:Record<string,string>={
 '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
 '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BOM Review" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
 'xl/styles.xml':styles,'xl/worksheets/sheet1.xml':sheet};
 return zipStore(Object.entries(entries).map(([name,value])=>({name,data:new TextEncoder().encode(value)})));
}
