import {diffSnapshots} from './bom-revision-diff';

type Item = {id?:string;kind?:string;title?:string;meta?:string};
type Revision = {rootPartId:string;revisionSeq:number;revision:string;snapshotJson:string;changeNote:string|null};
type Reader = (companyId:string, rootPartId:string, revisionSeq:number)=>Promise<Revision|null>;


export async function prepareBomRevisionContext(companyId:string, items:Item[], read:Reader) {
  const selected = items.filter(item=>item.kind==='BOM Revision'||(item.kind==='BOM'&&/^.+:[1-9]\d*$/.test(item.id||'')));
  if (!selected.length) return undefined;
  if (selected.length>10) throw new Error('BOM Revision은 최대 10개까지 선택해 주세요.');
  const revisions: Array<Revision & {snapshot:ReturnType<typeof JSON.parse>}> = [];
  const seen = new Set<string>();
  for (const item of selected) {
    const match=/^(.+):([1-9]\d*)$/.exec(item.id||'');
    if (!match||!Number.isSafeInteger(Number(match[2]))) throw new Error('BOM Revision 선택 정보가 올바르지 않습니다. 다시 선택해 주세요.');
    if (seen.has(item.id!)) continue;
    seen.add(item.id!);
    const revision=await read(companyId,match[1],Number(match[2]));
    if (!revision) throw new Error('선택한 BOM Revision을 조회할 수 없습니다. 접근 권한과 Revision을 확인해 주세요.');
    let snapshot;
    try { snapshot=JSON.parse(revision.snapshotJson); } catch { throw new Error('저장된 BOM Revision 데이터가 손상되었습니다.'); }
    if (!snapshot||snapshot.rootPartId!==revision.rootPartId||!Array.isArray(snapshot.parts)||!Array.isArray(snapshot.bom)) throw new Error('저장된 BOM Revision 구조를 읽을 수 없습니다.');
    revisions.push({...revision,snapshot});
  }
  // History selection is newest first; compare the same BOM in chronological order.
  // Different BOM roots retain the explicit left/right order from the compare screen.
  if (selected.every(item=>item.kind==='BOM Revision')&&revisions.every(row=>row.rootPartId===revisions[0].rootPartId)) revisions.sort((a,b)=>a.revisionSeq-b.revisionSeq);
  const label=(row:Revision)=>({rootPartId:row.rootPartId,revisionSeq:row.revisionSeq,revision:row.revision,changeNote:row.changeNote});
  const comparisons=revisions.slice(1).map((row,index)=>({from:label(revisions[index]),to:label(row),diff:diffSnapshots(revisions[index].snapshot,row.snapshot)}));
  const text=JSON.stringify({source:'저장된 BOM Revision 스냅샷',order:'from → to',revisions:revisions.map(row=>({...label(row),snapshot:row.snapshot})),comparisons});
  if (text.length>240000) throw new Error('선택한 BOM 데이터가 AI 분석 범위를 초과했습니다. 더 작은 ASSY 또는 적은 Revision을 선택해 주세요.');
  return text;
}
