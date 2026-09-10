"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Download, FileText, Filter, Link2, Plus, RefreshCw, Search } from "lucide-react";
import { CUSTOMER_DOCUMENT_TYPES, CUSTOMER_IMPACT_TARGETS, MAX_CUSTOMER_FILE_BYTES, PRODUCTION_PROJECT_CODE,
  type CustomerDataList, type CustomerDataRecord } from "../../lib/customer-data-contract";
import { V2ViewTabs } from "./v2-ui-foundation";
import { FilterSelect, type WorkspaceFilterConfig } from "./workspace-filter-panel";
import type { V2Project } from "./project-workspaces";
import "./customer-data-workspace.css";

const emptyData: CustomerDataList = { records: [], relations: [], canUpload: false, canReview: false };
const emptyFilters = { documentType: "", reviewStatus: "" };
const reviewLabel = (row: CustomerDataRecord) => row.reviewStatus === "reviewed" ? "원본 검토 완료" : "검토 대기";
const options = (values: Record<string, string>) => Object.entries(values).map(([value, label]) => ({ value, label }));
const dateLabel = (value: number) => new Date(value * 1000).toLocaleString("ko-KR");

async function readResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "요청을 처리하지 못했습니다.");
  return result;
}

export default function CustomerDataWorkspace({ project, onOpenFilter, embedded, recordIds, onChanged }: {
  embedded?: boolean; recordIds?: string[]; onChanged?: () => void;
  project: V2Project | null; onOpenFilter: (config: WorkspaceFilterConfig) => void;
}) {
  if (!project || project.projectTypeCode !== PRODUCTION_PROJECT_CODE) return <section className="wv2-project-workspace"><h1>Production 프로젝트를 선택하세요.</h1><p>고객 Data는 Production 유형의 프로젝트에서 관리합니다.</p></section>;
  return <CustomerDataContent key={project.id} project={project} onOpenFilter={onOpenFilter} embedded={embedded} recordIds={recordIds} onChanged={onChanged} />;
}

function CustomerDataContent({ project, onOpenFilter, embedded, recordIds, onChanged }: { embedded?: boolean; recordIds?: string[]; onChanged?: () => void; project: V2Project; onOpenFilter: (config: WorkspaceFilterConfig) => void }) {
  const [data, setData] = useState<CustomerDataList>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [upload, setUpload] = useState<{ previous?: CustomerDataRecord } | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [draft, setDraft] = useState(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [relatedId, setRelatedId] = useState("");
  const url = `/api/projects/${encodeURIComponent(project.id)}/customer-data`;
  const load = useCallback((signal?: AbortSignal) => fetch(url, { cache: "no-store", signal })
    .then(readResponse).then(result => { if (!signal?.aborted) setData(result); })
    .catch(reason => { if (!signal?.aborted) { setError(reason instanceof Error ? reason.message : "자료 조회에 실패했습니다."); throw reason; } })
    .finally(() => { if (!signal?.aborted) setLoading(false); }), [url]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(() => undefined); return () => controller.abort(); }, [load]);
  const selected = data.records.find(row => row.id === selectedId);
  const filtered = useCallback((value: typeof emptyFilters) => data.records.filter(row =>
    (!recordIds || recordIds.includes(row.id)) && (!value.documentType || row.documentType === value.documentType) && (!value.reviewStatus || row.reviewStatus === value.reviewStatus)
    && `${row.rawDataId} ${row.title} ${row.fileName}`.toLowerCase().includes(query.trim().toLowerCase())), [data.records, query, recordIds]);
  const visible = useMemo(() => filtered(filters), [filtered, filters]);
  const activeCount = Object.values(filters).filter(Boolean).length;
  useEffect(() => {
    if (!filterOpen) return;
    onOpenFilter({ eyebrow: "CUSTOMER DATA", title: "고객 Data 필터", description: "문서유형과 원본 검토 상태로 조회합니다.",
      resultCount: filtered(draft).length, activeCount: Object.values(draft).filter(Boolean).length,
      onCancel: () => setFilterOpen(false), onApply: () => { setFilters(draft); setFilterOpen(false); }, onReset: () => setDraft(emptyFilters),
      content: <><FilterSelect label="문서유형" value={draft.documentType} options={options(CUSTOMER_DOCUMENT_TYPES)} onChange={documentType => setDraft(current => ({ ...current, documentType }))} />
        <FilterSelect label="원본 검토" value={draft.reviewStatus} options={[{ value: "pending", label: "검토 대기" }, { value: "reviewed", label: "원본 검토 완료" }]} onChange={reviewStatus => setDraft(current => ({ ...current, reviewStatus }))} /></> });
  }, [draft, filterOpen, filtered, onOpenFilter]);
  const mutate = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); await load(); onChanged?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "저장에 실패했습니다."); }
    finally { setBusy(false); }
  };
  const latest = selected && !data.records.some(row => row.rawDataId === selected.rawDataId && row.revision > selected.revision);
  const writable = data.canUpload && project.status !== "completed";
  return <section className="wv2-project-workspace cswind-data-workspace">
    <header className="wv2-page-title"><div><small>{project.code} · PRODUCTION</small><h1>고객 Data</h1><p>{project.name} · 고객 원본과 버전·참조 관계를 관리합니다.</p></div><div>
      {(upload || selected) && <button disabled={busy} onClick={() => { setUpload(null); setSelectedId(""); setRelatedId(""); }}><ArrowLeft size={18} />목록</button>}
      {!upload && <button disabled={busy || loading} onClick={() => { setLoading(true); setError(""); void load().catch(() => undefined); }}><RefreshCw size={18} />새로고침</button>}
      {!upload && <button className="primary" disabled={!writable || busy || loading} onClick={() => { setUpload({}); setNotice(""); }}><Plus size={18} />원본 등록</button>}
    </div></header>
    {!embedded && <V2ViewTabs value="customer-data" onChange={() => undefined} items={[
      { value: "customer-data", label: "Customer Data", icon: FileText },
      { value: "ai-review", label: "AI Data Review · 준비 중", disabled: true },
      { value: "pbom", label: "PBOM · 준비 중", disabled: true },
      { value: "requirement", label: "TRR / Requirement · 준비 중", disabled: true },
      { value: "process", label: "Process Readiness · 준비 중", disabled: true },
    ]} />}
    {error && <p className="wv2-form-error" role="alert">{error}</p>}
    {notice && <p className="wv2-template-notice" role="status">{notice}</p>}
    {upload ? <CustomerUploadForm key={upload.previous?.id || "new"} previous={upload.previous} records={data.records} busy={busy} onCancel={() => setUpload(null)} onSubmit={form => mutate(async () => {
      const result = await readResponse(await fetch(url, { method: "POST", body: form })); setUpload(null); setSelectedId(result.record.id);
    }, "원본을 저장했습니다. AI 분석과 프로젝트 데이터 반영은 아직 수행되지 않았습니다.")} /> : selected ? <>
      <section className="cswind-data-card"><h2>{selected.title}</h2><p className="cswind-data-id">{selected.rawDataId} · Rev.{selected.revision}</p>
        <div className="cswind-data-actions"><a href={`${url}/${selected.id}`}><Download size={18} />원본 다운로드</a>
          <button disabled={!writable || !latest || busy} onClick={() => setUpload({ previous: selected })}>새 Revision 등록</button>
          <button disabled={!data.canReview || !writable || busy} onClick={() => void mutate(() => fetch(`${url}/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewed: selected.reviewStatus !== "reviewed" }) }).then(readResponse), "원본 검토 상태를 저장했습니다.")}><Check size={18} />{selected.reviewStatus === "reviewed" ? "검토 대기로 변경" : "원본 검토 완료"}</button>
        </div>
        <dl className="cswind-data-details">
          <div><dt>원본 파일</dt><dd>{selected.fileName} · {(selected.fileSize / 1024).toFixed(1)} KB</dd></div>
          <div><dt>문서유형</dt><dd>{CUSTOMER_DOCUMENT_TYPES[selected.documentType]}</dd></div>
          <div><dt>영향 대상 · 등록자 분류</dt><dd>{CUSTOMER_IMPACT_TARGETS[selected.impactTarget]}</dd></div>
          <div><dt>분석 / 검토 / 반영</dt><dd>AI 미분석 / {reviewLabel(selected)} / 미반영</dd></div>
          <div><dt>등록일</dt><dd>{dateLabel(selected.createdAt)}</dd></div>
          <div><dt>검토일</dt><dd>{selected.reviewedAt ? dateLabel(selected.reviewedAt) : "미검토"}</dd></div>
          <div><dt>SHA-256</dt><dd className="cswind-data-id">{selected.checksum}</dd></div>
          <div><dt>메모</dt><dd>{selected.note || "없음"}</dd></div>
        </dl><p>원본 검토 완료는 자료를 확인했다는 의미입니다. PBOM 등 프로젝트 데이터 반영 승인은 별도로 진행합니다.</p>
      </section>
      <section className="cswind-data-card"><h2>버전 이력</h2><div className="cswind-data-relations">{data.records.filter(row => row.rawDataId === selected.rawDataId).sort((a, b) => b.revision - a.revision).map(row => <button key={row.id} disabled={row.id === selected.id || busy} onClick={() => { setSelectedId(row.id); setRelatedId(""); }}>Rev.{row.revision} · {row.fileName} · {reviewLabel(row)}</button>)}</div></section>
      <section className="cswind-data-card"><h2>원본 관계</h2><div className="cswind-data-relations">{data.relations.filter(link => link.sourceId === selected.id || link.targetId === selected.id).map(link => {
        const outgoing = link.sourceId === selected.id;
        const other = data.records.find(row => row.id === (outgoing ? link.targetId : link.sourceId));
        return <button key={link.id} disabled={busy} onClick={() => { setSelectedId(other?.id || ""); setRelatedId(""); }}><Link2 size={18} />{link.relationType === "supersedes" ? (outgoing ? "이전 버전" : "후속 버전") : (outgoing ? "참조하는 자료" : "이 자료를 참조")} · {other?.title} · Rev.{other?.revision}</button>;
      })}{!data.relations.some(link => link.sourceId === selected.id || link.targetId === selected.id) && <p>연결된 원본이 없습니다.</p>}</div>
        {writable && <div className="cswind-data-actions"><label>참조 자료<select value={relatedId} onChange={event => setRelatedId(event.target.value)} disabled={busy}><option value="">선택하세요</option>{data.records.filter(row => row.id !== selected.id && !data.relations.some(link => link.sourceId === selected.id && link.targetId === row.id && link.relationType === "references")).map(row => <option key={row.id} value={row.id}>{row.title} · Rev.{row.revision} · {row.fileName}</option>)}</select></label><button disabled={!relatedId || busy} onClick={() => void mutate(async () => { await readResponse(await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "link", sourceId: selected.id, targetId: relatedId }) })); setRelatedId(""); }, "참조 관계를 저장했습니다.")}><Link2 size={18} />참조 연결</button></div>}
      </section>
    </> : <>
      <div className="wv2-toolbar"><label><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="자료명, 파일명, Raw Data ID 검색" /></label>
        <button onClick={() => { setDraft(filters); setFilterOpen(true); }}><Filter size={18} />상세 필터{activeCount > 0 && <em>{activeCount}</em>}</button>
        <span className="cswind-data-count">{visible.length}개 버전 · 원본 {new Set(visible.map(row => row.rawDataId)).size}건</span>
      </div>
      {loading ? <p role="status">고객 Data를 불러오는 중…</p> : <div className="cswind-data-table"><table><thead><tr><th>자료명 / Raw Data ID</th><th>파일 / 버전</th><th>문서유형</th><th>영향 대상</th><th>AI 분석</th><th>원본 검토</th><th>Applied</th></tr></thead><tbody>
        {visible.map(row => <tr key={row.id}><td><button onClick={() => { setSelectedId(row.id); setRelatedId(""); }}>{row.title}</button><small className="cswind-data-id">{row.rawDataId}</small></td><td>{row.fileName}<small>Rev.{row.revision} · {dateLabel(row.createdAt)}</small></td><td>{CUSTOMER_DOCUMENT_TYPES[row.documentType]}</td><td>{CUSTOMER_IMPACT_TARGETS[row.impactTarget]}</td><td>미분석</td><td>{reviewLabel(row)}</td><td>미반영</td></tr>)}
        {!visible.length && <tr><td colSpan={7}>{error ? "자료를 조회하지 못했습니다. 새로고침으로 다시 시도하세요." : data.records.length ? "검색 조건에 맞는 자료가 없습니다." : "등록된 고객 원본이 없습니다. 도면·사양서·Parts List를 등록하세요."}</td></tr>}
      </tbody></table></div>}
    </>}
  </section>;
}

function CustomerUploadForm({ previous, records, busy, onSubmit, onCancel }: {
  previous?: CustomerDataRecord; records: CustomerDataRecord[]; busy: boolean;
  onSubmit: (form: FormData) => Promise<void>; onCancel: () => void;
}) {
  const [validation, setValidation] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_CUSTOMER_FILE_BYTES) { setValidation("0바이트보다 크고 50MB 이하인 파일을 선택하세요."); return; }
    setValidation(""); void onSubmit(form);
  };
  return <form className="cswind-data-card cswind-data-form" onSubmit={submit}><h2>{previous ? `새 Revision · ${previous.title}` : "고객 원본 등록"}</h2>
    {previous && <><p className="cswind-data-id">{previous.rawDataId} · 이전 Rev.{previous.revision}</p><input type="hidden" name="previousId" value={previous.id} /></>}
    <fieldset disabled={busy}><label>자료명 *<input name="title" defaultValue={previous?.title || ""} required maxLength={200} /></label>
      <label>원본 파일 *<input type="file" name="file" required /><small>파일당 최대 50MB. 기존 파일은 덮어쓰지 않습니다.</small></label>
      <label>문서유형 *<select name="documentType" defaultValue={previous?.documentType || "drawing"}>{options(CUSTOMER_DOCUMENT_TYPES).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>영향 대상 · 등록자 분류<select name="impactTarget" defaultValue={previous?.impactTarget || "unclassified"}>{options(CUSTOMER_IMPACT_TARGETS).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>참조할 원본<select name="relatedId" defaultValue=""><option value="">참조 없음</option>{records.map(row => <option key={row.id} value={row.id}>{row.title} · Rev.{row.revision} · {row.fileName}</option>)}</select></label>
      <label>등록 메모<textarea name="note" rows={3} maxLength={2000} /></label>
    </fieldset>
    {validation && <p role="alert" className="wv2-form-error">{validation}</p>}
    <div className="cswind-data-actions"><button type="button" disabled={busy} onClick={onCancel}>취소</button><button className="primary" disabled={busy} type="submit">{busy ? "저장 중…" : "원본 저장"}</button></div>
  </form>;
}
