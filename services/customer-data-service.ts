import { createHash, randomUUID } from "node:crypto";
import { createCustomerDataRepository, type CustomerDataScope } from "../db/repositories/customer-data-repository";
import { getStorageAdapter } from "../lib/storage-adapter";
import { CUSTOMER_DOCUMENT_TYPES, CUSTOMER_IMPACT_TARGETS, CustomerDataError, MAX_CUSTOMER_FILE_BYTES,
  type CustomerDocumentType, type CustomerImpactTarget } from "../lib/customer-data-contract";

function publicRecord<T extends { fileKey: string; companyId: string }>(record: T) {
  const { fileKey: _fileKey, companyId: _companyId, ...result } = record;
  void _fileKey; void _companyId;
  return result;
}
function text(value: FormDataEntryValue | null, name: string, max: number, required = false) {
  if (value !== null && typeof value !== "string") throw new CustomerDataError(`${name} 형식을 확인하세요.`);
  const result = (value ?? "").trim();
  if ((required && !result) || result.length > max) throw new CustomerDataError(`${name}을(를) ${max}자 이내로 입력하세요.`);
  return result;
}

export function createCustomerDataService(repository = createCustomerDataRepository(), storage = getStorageAdapter()) {
  return {
    async list(scope: CustomerDataScope) {
      const result = await repository.list(scope);
      return { ...result, records: result.records.map(publicRecord), relations: result.relations.map(({ companyId: _companyId, ...item }) => { void _companyId; return item; }) };
    },
    async upload(scope: CustomerDataScope, form: FormData) {
      const permissions = await repository.access(scope);
      if (!permissions.canUpload) throw new CustomerDataError("완료된 프로젝트는 수정할 수 없습니다.", 409);
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) throw new CustomerDataError("빈 파일은 등록할 수 없습니다. 파일을 선택하세요.");
      if (file.size > MAX_CUSTOMER_FILE_BYTES) throw new CustomerDataError("파일은 50MB 이하로 등록하세요.", 413);
      const title = text(form.get("title"), "자료명", 200, true);
      const documentType = text(form.get("documentType"), "문서유형", 30) as CustomerDocumentType;
      const impactTarget = text(form.get("impactTarget"), "영향 대상", 30) as CustomerImpactTarget;
      if (!Object.hasOwn(CUSTOMER_DOCUMENT_TYPES, documentType) || !Object.hasOwn(CUSTOMER_IMPACT_TARGETS, impactTarget)) throw new CustomerDataError("문서유형과 영향 대상을 선택하세요.");
      const previousId = text(form.get("previousId"), "이전 버전", 100) || undefined;
      const relatedId = text(form.get("relatedId"), "참조 원본", 100) || undefined;
      const note = text(form.get("note"), "메모", 2000) || null;
      if (previousId) await repository.get(scope, previousId);
      if (relatedId) await repository.get(scope, relatedId);
      const fileName = file.name.replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g, "_").slice(0, 200) || "customer-file";
      const id = randomUUID();
      const fileKey = `customer-data/${scope.companyId}/${scope.projectId}/${id}/${fileName}`;
      const bytes = await file.arrayBuffer();
      const checksum = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
      try {
        await storage.put(fileKey, bytes, { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { originalName: fileName, checksum } });
        return publicRecord(await repository.create(scope, { id, title, documentType, impactTarget, fileKey, fileName, fileSize: bytes.byteLength, checksum, note }, previousId, relatedId));
      } catch (error) {
        // A failed DB write must not leave an untracked source binary behind.
        await storage.delete(fileKey).catch(cleanupError => console.error("Customer Data storage cleanup failed", { fileKey, cleanupError }));
        throw error;
      }
    },
    async download(scope: CustomerDataScope, id: string) {
      const record = await repository.get(scope, id);
      const object = await storage.get(record.fileKey);
      if (!object) throw new CustomerDataError("원본 파일을 저장소에서 찾을 수 없습니다.", 404);
      return { body: object.body, fileName: record.fileName };
    },
    async review(scope: CustomerDataScope, id: string, reviewed: unknown) {
      if (typeof reviewed !== "boolean") throw new CustomerDataError("검토 상태를 확인하세요.");
      return publicRecord(await repository.review(scope, id, reviewed));
    },
    async link(scope: CustomerDataScope, sourceId: unknown, targetId: unknown) {
      if (typeof sourceId !== "string" || typeof targetId !== "string" || !sourceId || !targetId) throw new CustomerDataError("연결할 원본을 선택하세요.");
      return repository.link(scope, sourceId, targetId);
    },
  };
}
