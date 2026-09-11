export const CUSTOMER_INTAKE_GROUPS={unclassified:'미분류',a_bt:'Category A · BT',a_wt:'Category A · WT',a_im:'Category A · IM',a_common:'Category A · 공통',b_initial:'Category B · 초기 BOM',b_change:'Category B · 변경',b_missing:'Category B · 누락 도면',b_parts:'Category B · 부품 목록',common:'A/B 공통'} as const;
export type CustomerIntakeGroup=keyof typeof CUSTOMER_INTAKE_GROUPS;
export const CUSTOMER_SOURCE_PURPOSES={bom:'BOM AI 추출',ttr:'TRR 문서 작성',input:'분석용 원본',template:'출력 템플릿',example:'출력 예시'} as const;
export type CustomerSourcePurpose=keyof typeof CUSTOMER_SOURCE_PURPOSES;
export const PRODUCTION_PROJECT_CODE = "PRODUCTION";
export const CUSTOMER_DOCUMENT_TYPES = {
  drawing: "도면", specification: "사양서", bom: "Parts List / BOM",
  requirement: "요구사항", report: "기술 보고서", other: "기타",
} as const;
export const CUSTOMER_IMPACT_TARGETS = {
  unclassified: "미분류", pbom: "PBOM", requirement: "TRR / Requirement",
  process: "Process Readiness", multiple: "복수 영역",
} as const;
export const MAX_CUSTOMER_FILE_BYTES = 50 * 1024 * 1024;
export type CustomerDocumentType = keyof typeof CUSTOMER_DOCUMENT_TYPES;
export type CustomerImpactTarget = keyof typeof CUSTOMER_IMPACT_TARGETS;
export type CustomerDataRecord = {
  id: string; projectId: string; receiptNumber?: number; rawDataId: string; revision: number;
  intakeGroup?:CustomerIntakeGroup;sourcePurpose?:CustomerSourcePurpose;
  title: string; documentType: CustomerDocumentType; impactTarget: CustomerImpactTarget;
  fileName: string; fileSize: number; checksum: string; note: string | null;
  analysisStatus: "not_requested"; reviewStatus: "pending" | "reviewed";
  appliedStatus: "not_applied"; createdBy: string; createdByName?: string | null; createdAt: number;
  reviewedBy: string | null; reviewedAt: number | null;
};
export type CustomerDataRelation = {
  id: string; sourceId: string; targetId: string;
  relationType: "references" | "supersedes"; createdAt: number;
};
export type CustomerDataList = {
  records: CustomerDataRecord[]; relations: CustomerDataRelation[];
  canUpload: boolean; canReview: boolean;
};
export class CustomerDataError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Stable receipt number belongs to one uploaded file version, independent of AI review versions. */
export function customerReceiptId(record: Pick<CustomerDataRecord, "id" | "receiptNumber">): string {
  return record.receiptNumber ? `DOC-${String(record.receiptNumber).padStart(6, "0")}` : record.id;
}
