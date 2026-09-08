export const PRODUCTION_PROJECT_CODE = "PRODUCTION";
export const CUSTOMER_DOCUMENT_TYPES = {
  drawing: "도면", specification: "사양서", bom: "Parts List / BOM",
  requirement: "요구사항", report: "기술 보고서", other: "기타",
} as const;
export const CUSTOMER_IMPACT_TARGETS = {
  unclassified: "미분류", pbom: "PBOM", requirement: "TTR / Requirement",
  process: "Process Readiness", multiple: "복수 영역",
} as const;
export const MAX_CUSTOMER_FILE_BYTES = 50 * 1024 * 1024;
export type CustomerDocumentType = keyof typeof CUSTOMER_DOCUMENT_TYPES;
export type CustomerImpactTarget = keyof typeof CUSTOMER_IMPACT_TARGETS;
export type CustomerDataRecord = {
  id: string; projectId: string; rawDataId: string; revision: number;
  title: string; documentType: CustomerDocumentType; impactTarget: CustomerImpactTarget;
  fileName: string; fileSize: number; checksum: string; note: string | null;
  analysisStatus: "not_requested"; reviewStatus: "pending" | "reviewed";
  appliedStatus: "not_applied"; createdBy: string; createdAt: number;
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
