import type {ReviewDraft} from './customer-review-contract';

/** Resolve document metadata without borrowing names from child parts or other drawings. */
export function resolveDrawingTitle(draft: ReviewDraft, recordId: string): string {
  const title = draft.drawingTitle?.trim();
  if (title) return title;
  const drawingNumber = draft.drawingNumber.trim();
  if (!drawingNumber) return '';
  const names = new Set(draft.items
    .filter(item => item.recordId === recordId && item.area === 'pbom'
      && item.bom?.parentId === null
      && item.bom.drawingNumber.trim() === drawingNumber)
    .map(item => item.bom!.itemDescription.trim())
    .filter(Boolean));
  return names.size === 1 ? [...names][0] : '';
}
