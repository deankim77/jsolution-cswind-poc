import type {BomRow} from './pbom-contract';

/** Use the same project BOM as the BOM tab; identify document roots by source linkage. */
export function resolveBomDrawingMetadata(rows: BomRow[], recordId: string) {
  const documentRows = rows.filter(row => row.recordId === recordId || row.sourceRecordIds?.includes(recordId));
  const ids = new Set(documentRows.map(row => row.id));
  const roots = documentRows.filter(row => !row.bom.parentId || !ids.has(row.bom.parentId));
  const values = roots.map(({bom}) => ({
    title: bom.itemDescription.trim(),
    drawingNumber: bom.drawingNumber.trim(),
    revisionLabel: bom.componentRevision.trim(),
  }));
  const unique = [...new Map(values.map(value => [JSON.stringify(value), value])).values()];
  return unique.length === 1 ? unique[0] : {title: '', drawingNumber: '', revisionLabel: ''};
}
