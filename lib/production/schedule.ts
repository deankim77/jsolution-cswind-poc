export type ProductionTask = {
  id: string; parentId?: string | null; level?: number; kind?: string; name: string;
  durationDays: number; startOffsetDays?: number; predecessor?: string; role?: string;
  completionActor?: string; completionCriteria?: string;
  deliverables?: { name: string; type?: string; required?: boolean; documentKind?: string }[];
};

/** Business-day offsets are demo template planning assumptions, never production actuals. */
export function productionSchedule(tasks: ProductionTask[], start: string, workingDays: number[], holidays: string[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || new Date(start).toISOString().slice(0, 10) !== start) throw new Error('올바른 시작일을 입력하세요.');
  if (!workingDays.length || workingDays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('회사 근무일 설정을 확인하세요.');
  if (!tasks.length || new Set(tasks.map(row=>row.id)).size !== tasks.length) throw new Error('WBS 코드가 비어 있거나 중복되었습니다.');
  for (const row of tasks) {
    if (!row.id || !Number.isInteger(row.durationDays) || row.durationDays < 0 || (row.startOffsetDays !== undefined && (!Number.isInteger(row.startOffsetDays) || row.startOffsetDays < 0))) throw new Error('WBS 소요일과 시작 오프셋을 확인하세요.');
    if (row.parentId && !tasks.some(parent=>parent.id===row.parentId&&parent.kind==='summary')) throw new Error('상위 WBS를 확인하세요.');
  }
  const holidaySet = new Set(holidays);
  const dates: string[] = [];
  const totalDays = Math.max(1, ...tasks.map(row => (row.startOffsetDays ?? 0) + row.durationDays), tasks.reduce((sum, row) => sum + Math.max(0, row.durationDays), 0));
  if (totalDays > 2000) throw new Error('계획 소요일이 허용 범위를 초과했습니다.');
  const date = new Date(`${start}T00:00:00Z`);
  for (let guard = 0; dates.length < totalDays && guard < 20000; guard++) {
    const iso = date.toISOString().slice(0, 10);
    if (workingDays.includes(date.getUTCDay()) && !holidaySet.has(iso)) dates.push(iso);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  if (dates.length < totalDays) throw new Error('근무일을 계산할 수 없습니다.');
  let cursor = 0;
  const ends = new Map<string, number>();
  const planned = tasks.map(row => {
    if (row.kind === 'summary') return { ...row, plannedStart: null as string | null, plannedEnd: null as string | null };
    const dependency = row.predecessor ? ends.get(row.predecessor) : undefined;
    if (row.predecessor && dependency === undefined) throw new Error('선행 업무는 먼저 배치된 실행 업무를 선택하세요.');
    const offset = Math.max(row.startOffsetDays ?? (dependency === undefined ? cursor : dependency + 1), dependency === undefined ? 0 : dependency + 1);
    const end = offset + Math.max(1, row.durationDays) - 1;
    if (!dates[end]) throw new Error('일정 범위를 확인하세요.');
    ends.set(row.id, end); cursor = end + 1;
    return { ...row, plannedStart: dates[offset], plannedEnd: dates[end] };
  });
  for (const row of [...planned].reverse()) {
    if (row.kind !== 'summary') continue;
    const children = planned.filter(item => item.parentId === row.id);
    row.plannedStart = children.map(item => item.plannedStart).filter((v): v is string => Boolean(v)).sort()[0] ?? null;
    row.plannedEnd = children.map(item => item.plannedEnd).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
  }
  return planned;
}
