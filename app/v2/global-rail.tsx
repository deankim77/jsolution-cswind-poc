"use client";

import {useEffect,useState} from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Folders,
  GitPullRequestArrow,
  House,
  MessageSquareText,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import ProjectPlmTabsBridge from "./project-plm-tabs-bridge";
import DocumentPreviewOverlayBridge from "./document-preview-overlay";
import BomCentralTabBridge from "./bom-central-tab-bridge";
import BomEditorCommandBridge from "./bom-editor-command-bridge";

type RailWorkspaceView=
  | "portfolio"
  | "projects"
  | "documents"
  | "issues"
  | "workflows"
  | "reports"
  | "my-work"
  | "my-ai"
  | "settings";

type RailItem={
  label:string;
  icon:LucideIcon;
  view?:RailWorkspaceView;
  action?:()=>void;
};

const primaryNav:RailItem[]=[
  {label:"전사 대시보드",icon:House,view:"portfolio"},
  {label:"통합검색",icon:Search},
  {label:"프로젝트 목록",icon:Folders,view:"projects"},
  {label:"문서·산출물",icon:FileText,view:"documents"},
  {label:"이슈·리스크",icon:AlertTriangle,view:"issues"},
  {label:"워크플로우",icon:GitPullRequestArrow,view:"workflows"},
  {label:"보고·회의",icon:MessageSquareText,view:"reports"},
];

const personalNav:RailItem[]=[
  {label:"MY WORK",icon:Check,view:"my-work"},
  {label:"MY AI HOME",icon:Sparkles,view:"my-ai"},
  {label:"설정",icon:Settings,view:"settings"},
];

const iconStyle={width:"var(--v2-icon-size-primary)",height:"var(--v2-icon-size-primary)"};

export default function GlobalRail({onSearch,onView,active}:{onSearch:()=>void;onView:(view:RailWorkspaceView)=>void;active:string}){
  const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
  const renderItem=(item:RailItem)=>{
    const Icon=item.icon;
    const action=item.label==="통합검색"?onSearch:item.action;
    return <button key={item.label} className={item.view&&active===item.view?"active":""} onClick={action||(()=>item.view&&onView(item.view))} title={item.label}><Icon style={iconStyle}/><span>{item.label}</span></button>;
  };
  return <><aside className="wv2-rail"><button className="wv2-brand">J</button>{primaryNav.map(renderItem)}<div className="wv2-rail-spacer"/>{personalNav.map(renderItem)}</aside>{mounted&&<><ProjectPlmTabsBridge/><DocumentPreviewOverlayBridge/><BomCentralTabBridge/><BomEditorCommandBridge/></>}</>;
}
