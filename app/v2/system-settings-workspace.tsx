"use client";

import {useEffect,useState} from "react";
import {CalendarDays,Check,Plus,Settings,Trash2} from "lucide-react";
import type {BusinessCalendar,BusinessHoliday} from "./business-calendar";

const weekDays=[
  {value:1,label:"월"},{value:2,label:"화"},{value:3,label:"수"},{value:4,label:"목"},
  {value:5,label:"금"},{value:6,label:"토"},{value:0,label:"일"},
];

export function CalendarSettingsWorkspace(){
  const [calendar,setCalendar]=useState<BusinessCalendar|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{const controller=new AbortController();fetch("/api/system/calendar",{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"업무 캘린더를 불러오지 못했습니다.");setCalendar(data.calendar)}).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError"))setNotice(reason instanceof Error?reason.message:"업무 캘린더를 불러오지 못했습니다.")}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[]);

  const toggleDay=(day:number)=>setCalendar(current=>current?{...current,workingDays:current.workingDays.includes(day)?current.workingDays.filter(item=>item!==day):[...current.workingDays,day].sort()}:current);
  const patchHoliday=(index:number,patch:Partial<BusinessHoliday>)=>setCalendar(current=>current?{...current,holidays:current.holidays.map((holiday,cursor)=>cursor===index?{...holiday,...patch}:holiday)}:current);
  const addHoliday=()=>setCalendar(current=>current?{...current,holidays:[...current.holidays,{date:"",name:""}]}:current);
  const removeHoliday=(index:number)=>setCalendar(current=>current?{...current,holidays:current.holidays.filter((_,cursor)=>cursor!==index)}:current);
  const save=async()=>{if(!calendar||saving)return;setSaving(true);setNotice("");try{const response=await fetch("/api/system/calendar",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(calendar)});const data=await response.json();if(!response.ok)throw new Error(data.error||"업무 캘린더를 저장하지 못했습니다.");setCalendar(data.calendar);setNotice("업무 캘린더를 저장했습니다. WBS 일정 계산에 즉시 적용됩니다.");window.dispatchEvent(new CustomEvent("v2-business-calendar-updated",{detail:data.calendar}))}catch(reason){setNotice(reason instanceof Error?reason.message:"업무 캘린더를 저장하지 못했습니다.")}finally{setSaving(false)}};

  return <section className="wv2-module wv2-settings-workspace">
    <header className="wv2-module-head"><div><small>SYSTEM SETTINGS</small><h1>시스템 설정</h1><p>회사 공통 근무 기준을 관리합니다. 저장한 기준은 WBS 소요일과 선행 일정 계산에 자동 적용됩니다.</p></div><div className="wv2-module-count"><Settings size={20}/><span>관리자 설정</span></div></header>
    {loading?<div className="wv2-settings-loading">업무 캘린더를 불러오는 중…</div>:calendar&&<div className="wv2-settings-grid">
      <aside><button className="active"><CalendarDays size={18}/><span><b>근무 캘린더</b><small>주 근무일 · 회사 휴무일</small></span></button></aside>
      <main><header><div><small>BUSINESS CALENDAR</small><h2>근무일 · 휴무일 기준</h2></div><button className="primary" disabled={saving||!calendar.workingDays.length} onClick={save}><Check size={18}/>{saving?"저장 중…":"변경 저장"}</button></header>
        <div className="wv2-calendar-form-row"><label><span>캘린더명</span><input value={calendar.name} onChange={event=>setCalendar({...calendar,name:event.target.value})}/></label><label><span>시간대</span><select value={calendar.timezone} onChange={event=>setCalendar({...calendar,timezone:event.target.value})}><option value="Asia/Seoul">Asia/Seoul (KST)</option><option value="UTC">UTC</option></select></label></div>
        <section className="wv2-workweek"><header><div><b>주 근무일</b><p>기본값은 월–금 주 5일제입니다.</p></div><em>{calendar.workingDays.length}일 근무</em></header><div>{weekDays.map(day=><button key={day.value} className={calendar.workingDays.includes(day.value)?"active":""} onClick={()=>toggleDay(day.value)}><Check size={18}/>{day.label}</button>)}</div></section>
        <section className="wv2-holidays"><header><div><b>회사 휴무일</b><p>등록한 날짜는 평일이어도 WBS 소요일 계산에서 제외됩니다.</p></div><button onClick={addHoliday}><Plus size={18}/>휴무일 추가</button></header>{calendar.holidays.length?<div className="wv2-holiday-table"><header><span>날짜</span><span>휴무일명</span><span/></header>{calendar.holidays.map((holiday,index)=><div key={`${holiday.date}-${index}`}><input type="date" value={holiday.date} onChange={event=>patchHoliday(index,{date:event.target.value})}/><input value={holiday.name} placeholder="예: 창립기념일" onChange={event=>patchHoliday(index,{name:event.target.value})}/><button aria-label="휴무일 삭제" onClick={()=>removeHoliday(index)}><Trash2 size={18}/></button></div>)}</div>:<div className="wv2-holiday-empty"><CalendarDays size={24}/><b>등록된 회사 휴무일이 없습니다.</b><span>법정 공휴일·창립기념일·전사 휴무일을 추가할 수 있습니다.</span></div>}</section>
      </main>
    </div>}
    {notice&&<p className="wv2-module-notice">{notice}</p>}
  </section>;
}
