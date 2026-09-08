import { getLegacyDbCompat } from "../../../../db/postgres-d1-compat";
import { ensureProjectDataFoundation, type RuntimeD1 } from "../../../../db/project-data-foundation";
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";

/* eslint-disable @typescript-eslint/no-explicit-any */
type D1 = RuntimeD1;
type HolidayInput = { date: string; name?: string };
type CalendarInput = {
  id?: string;
  name?: string;
  timezone?: string;
  workingDays?: number[];
  holidays?: HolidayInput[];
};


async function runtimeDb(): Promise<D1> {
  return getLegacyDbCompat() as D1;
}

async function ensureCalendarFoundation(db: D1,companyId:string) {
  await ensureProjectDataFoundation(db);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS work_calendars (
      id text PRIMARY KEY NOT NULL,
      company_id text NOT NULL,
      name text NOT NULL,
      timezone text DEFAULT 'Asia/Seoul' NOT NULL,
      working_days text NOT NULL,
      is_default integer DEFAULT 0 NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS work_calendars_company_default_uq ON work_calendars (company_id, is_default) WHERE is_default = 1"),
    db.prepare(`CREATE TABLE IF NOT EXISTS calendar_holidays (
      id text PRIMARY KEY NOT NULL,
      calendar_id text NOT NULL,
      holiday_date text NOT NULL,
      name text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (calendar_id) REFERENCES work_calendars(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS calendar_holidays_calendar_date_uq ON calendar_holidays (calendar_id, holiday_date)"),
  ]);
  const existing = await db.prepare("SELECT id FROM work_calendars WHERE company_id=? AND is_default=1").bind(companyId).first<{id:string}>();
  if (existing) return existing.id;
  const company = await db.prepare("SELECT id FROM companies WHERE id=?").bind(companyId).first();
  if (!company) return null;
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO work_calendars (id,company_id,name,timezone,working_days,is_default,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)")
    .bind(id, companyId, "기본 업무 캘린더", "Asia/Seoul", JSON.stringify([1,2,3,4,5]), now, now).run();
  return id;
}

async function readCalendar(db: D1, calendarId: string | null,companyId:string) {
  if (!calendarId) return {id:null,name:"기본 업무 캘린더",timezone:"Asia/Seoul",workingDays:[1,2,3,4,5],holidays:[]};
  const calendar = await db.prepare("SELECT id,name,timezone,working_days AS workingDays FROM work_calendars WHERE id=? AND company_id=?").bind(calendarId,companyId).first<any>();
  if (!calendar) return null;
  const holidays = await db.prepare("SELECT id,holiday_date AS date,name FROM calendar_holidays WHERE calendar_id=? ORDER BY holiday_date").bind(calendarId).all();
  return {...calendar,workingDays:JSON.parse(calendar.workingDays || "[1,2,3,4,5]"),holidays:holidays.results};
}

export async function GET(request:Request) {
  const db = await runtimeDb();
  await ensureProjectDataFoundation(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const calendarId = await ensureCalendarFoundation(db,context.companyId);
  return Response.json({calendar:await readCalendar(db,calendarId,context.companyId)});
}

export async function PUT(request: Request) {
  const db = await runtimeDb();
  await ensureProjectDataFoundation(db);let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const calendarId = await ensureCalendarFoundation(db,context.companyId);
  if (!calendarId) return Response.json({error:"회사 기본정보가 없어 업무 캘린더를 저장할 수 없습니다."},{status:409});
  const input = await request.json() as CalendarInput;
  const workingDays = [...new Set(input.workingDays ?? [])].filter(day => Number.isInteger(day) && day >= 0 && day <= 6).sort();
  if (!input.name?.trim() || !workingDays.length) return Response.json({error:"캘린더명과 최소 1개의 근무 요일이 필요합니다."},{status:400});
  const holidays = input.holidays ?? [];
  if (holidays.some(item => !/^\d{4}-\d{2}-\d{2}$/.test(item.date))) return Response.json({error:"휴무일 날짜 형식이 올바르지 않습니다."},{status:400});
  if (new Set(holidays.map(item => item.date)).size !== holidays.length) return Response.json({error:"중복된 휴무일이 있습니다."},{status:400});
  const now = Math.floor(Date.now() / 1000);
  const statements = [
    db.prepare("UPDATE work_calendars SET name=?,timezone=?,working_days=?,updated_at=? WHERE id=? AND company_id=?")
      .bind(input.name.trim(),input.timezone?.trim() || "Asia/Seoul",JSON.stringify(workingDays),now,calendarId,context.companyId),
    db.prepare("DELETE FROM calendar_holidays WHERE calendar_id=?").bind(calendarId),
  ];
  for (const holiday of holidays) statements.push(
    db.prepare("INSERT INTO calendar_holidays (id,calendar_id,holiday_date,name,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),calendarId,holiday.date,holiday.name?.trim() || "휴무일",now,now),
  );
  statements.push(db.prepare("INSERT INTO audit_logs (id,company_id,actor_user_id,action,entity_type,entity_id,detail,created_at) VALUES (?,?,?,'WORK_CALENDAR_UPDATED','WORK_CALENDAR',?,?,?)")
    .bind(crypto.randomUUID(),context.companyId,context.userId,calendarId,JSON.stringify({workingDays,holidayCount:holidays.length}),now));
  await db.batch(statements);
  return Response.json({ok:true,calendar:await readCalendar(db,calendarId,context.companyId)});
}
