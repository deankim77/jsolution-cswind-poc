"use client";

import {useEffect,useRef,useState} from "react";
import {Pin,X} from "lucide-react";
import "./pinned-tabs-settings.css";

export type PinnedView="my-work"|"portfolio"|"projects"|"documents"|"issues"|"workflows"|"ecr"|"quality"|"my-ai";

type PinnedItem={view:PinnedView;label:string};

export const PINNED_TABS_STATE_KEY="v2-pinned-workspace-tabs";
export const FIXED_PINNED_VIEW:PinnedView="my-work";
export const PINNED_TAB_ITEMS:PinnedItem[]=[
  {view:"my-work",label:"MY WORK"},
  {view:"portfolio",label:"전사 대시보드"},
  {view:"projects",label:"프로젝트 목록"},
  {view:"documents",label:"문서 · 산출물"},
  {view:"issues",label:"이슈 · 리스크"},
  {view:"workflows",label:"워크플로우"},
  {view:"ecr",label:"설계변경"},
  {view:"quality",label:"품질관리"},
  {view:"my-ai",label:"MY AI HOME"},
];

const additionalItems=PINNED_TAB_ITEMS.filter(item=>item.view!==FIXED_PINNED_VIEW);

export const normalizePinnedTabs=(value:unknown):PinnedView[]=>{
  const valid=new Set(additionalItems.map(item=>item.view));
  const additional=Array.isArray(value)
    ? value.filter((view):view is PinnedView=>valid.has(view as PinnedView)).slice(0,2)
    : [];
  return [FIXED_PINNED_VIEW,...additional];
};

export async function loadPinnedTabs():Promise<PinnedView[]>{
  const response=await fetch(`/api/state?key=${encodeURIComponent(PINNED_TABS_STATE_KEY)}`,{cache:"no-store"});
  if(!response.ok)return [FIXED_PINNED_VIEW];
  const data=await response.json() as {value?:unknown};
  return normalizePinnedTabs(data.value);
}

async function savePinnedTabs(value:PinnedView[]){
  const additional=value.filter(view=>view!==FIXED_PINNED_VIEW).slice(0,2);
  const response=await fetch("/api/state",{
    method:"PUT",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({key:PINNED_TABS_STATE_KEY,value:additional}),
  });
  if(!response.ok)throw new Error("고정 탭 설정을 저장하지 못했습니다.");
}

export function PinnedTabsSettings(){
  const [pinned,setPinned]=useState<PinnedView[]>([FIXED_PINNED_VIEW]);
  const [draft,setDraft]=useState<PinnedView[]>([FIXED_PINNED_VIEW]);
  const [open,setOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const popoverRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    let active=true;
    void loadPinnedTabs().then(value=>{if(active){setPinned(value);setDraft(value)}}).catch(()=>undefined);
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      const target=event.target as Element|null;
      if(target?.closest(".wv2-avatar")){
        event.preventDefault();
        event.stopPropagation();
        setDraft(pinned);
        setNotice("");
        setOpen(value=>!value);
        return;
      }
      if(open&&popoverRef.current&&target&&!popoverRef.current.contains(target))setOpen(false);
    };
    document.addEventListener("click",onClick,true);
    return()=>document.removeEventListener("click",onClick,true);
  },[open,pinned]);

  const toggle=(view:PinnedView)=>setDraft(current=>{
    if(view===FIXED_PINNED_VIEW)return current;
    if(current.includes(view))return current.filter(item=>item!==view);
    return current.length<3?[...current,view]:current;
  });

  const save=async()=>{
    const next=normalizePinnedTabs(draft);
    setSaving(true);
    setNotice("");
    try{
      await savePinnedTabs(next);
      setPinned(next);
      setDraft(next);
      window.dispatchEvent(new CustomEvent("v2-pinned-tabs-changed",{detail:next}));
      setOpen(false);
    }catch(error){
      setNotice(error instanceof Error?error.message:"고정 탭 설정을 저장하지 못했습니다.");
    }finally{
      setSaving(false);
    }
  };

  if(!open)return null;
  return <div ref={popoverRef} className="wv2-pinned-tabs-popover" role="dialog" aria-label="고정 탭 설정">
    <header>
      <div><b>고정 탭 설정</b><small>MY WORK는 항상 1번에 고정되며, 2개를 추가할 수 있습니다.</small></div>
      <button aria-label="닫기" onClick={()=>setOpen(false)}><X size={17}/></button>
    </header>
    <section>
      <div className="wv2-pinned-tabs-title"><label>고정 탭</label><span>{draft.length}/3</span></div>
      <div className="wv2-pinned-tabs-grid">
        <button className="selected" disabled>
          <span className="order">1</span>MY WORK
        </button>
        {additionalItems.map(item=>{
          const order=draft.indexOf(item.view);
          const selected=order>=0;
          const disabled=!selected&&draft.length>=3;
          return <button key={item.view} className={selected?"selected":""} disabled={disabled} onClick={()=>toggle(item.view)}>
            <span className={selected?"order":""}>{selected?order+1:<Pin size={15}/>}</span>{item.label}
          </button>;
        })}
      </div>
      <p>MY WORK는 1번 고정이며, 선택한 순서대로 2번과 3번이 추가됩니다.</p>
      {notice&&<p>{notice}</p>}
    </section>
    <footer>
      <button onClick={()=>{setDraft(pinned);setOpen(false)}}>취소</button>
      <button className="primary" disabled={saving} onClick={save}>{saving?"저장 중…":"저장"}</button>
    </footer>
  </div>;
}
