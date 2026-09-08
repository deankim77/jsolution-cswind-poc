export type BusinessHoliday = {
  date: string;
  name: string;
};

export type BusinessCalendar = {
  id?: string;
  name: string;
  timezone: string;
  workingDays: number[];
  holidays: BusinessHoliday[];
};

export const DEFAULT_BUSINESS_CALENDAR: BusinessCalendar = {
  name: "기본 업무 캘린더",
  timezone: "Asia/Seoul",
  workingDays: [1, 2, 3, 4, 5],
  holidays: [],
};

let activeCalendar = DEFAULT_BUSINESS_CALENDAR;
let holidayDates = new Set<string>();

export function setActiveBusinessCalendar(calendar?: Partial<BusinessCalendar>) {
  activeCalendar = {
    ...DEFAULT_BUSINESS_CALENDAR,
    ...calendar,
    workingDays: calendar?.workingDays?.length
      ? [...new Set(calendar.workingDays)].filter(day => day >= 0 && day <= 6)
      : DEFAULT_BUSINESS_CALENDAR.workingDays,
    holidays: calendar?.holidays ?? [],
  };
  holidayDates = new Set(activeCalendar.holidays.map(holiday => holiday.date));
}

export function isBusinessDay(value: Date) {
  const date = value.toISOString().slice(0, 10);
  return activeCalendar.workingDays.includes(value.getUTCDay()) && !holidayDates.has(date);
}

export function nextBusinessDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  do value.setUTCDate(value.getUTCDate() + 1);
  while (!isBusinessDay(value));
  return value.toISOString().slice(0, 10);
}

export function toBusinessDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  while (!isBusinessDay(value)) value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function shiftBusinessDate(date: string, offset: number) {
  let value = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(value.getTime())) return date;
  if (!offset) return toBusinessDate(date);
  const direction = offset > 0 ? 1 : -1;
  let remaining = Math.abs(Math.trunc(offset));
  while (remaining > 0) {
    value.setUTCDate(value.getUTCDate() + direction);
    if (isBusinessDay(value)) remaining--;
  }
  while (!isBusinessDay(value)) value.setUTCDate(value.getUTCDate() + direction);
  return value.toISOString().slice(0, 10);
}

export function endFromDuration(start: string, duration: number) {
  const value = new Date(`${start}T00:00:00Z`);
  while (!isBusinessDay(value)) value.setUTCDate(value.getUTCDate() + 1);
  let remaining = Math.max(1, duration) - 1;
  while (remaining > 0) {
    value.setUTCDate(value.getUTCDate() + 1);
    if (isBusinessDay(value)) remaining--;
  }
  return value.toISOString().slice(0, 10);
}

export function durationFromRange(start: string, end: string) {
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (cursor > last) return 1;
  let count = 0;
  while (cursor <= last) {
    if (isBusinessDay(cursor)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(1, count);
}
