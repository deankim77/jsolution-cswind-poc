"use client";

import {Suspense,lazy,type ComponentType} from "react";

const lazyNamed=(loader:()=>Promise<{default:ComponentType<any>}>)=>{
  const Component=lazy(loader);
  return (props:any)=><Suspense fallback={null}><Component {...props}/></Suspense>;
};

const ConnectedAiPanelImpl=lazyNamed(()=>import("./connected-ai-panel").then(module=>({default:module.ConnectedAiPanel})));

export const ConnectedAiPanel=(props:any)=>{
  const draft=props.draftRequest;
  if(!draft)return <ConnectedAiPanelImpl {...props}/>;
  if(draft.source==="문서 변경이력"||draft.source==="도면 변경이력"){
    return <ConnectedAiPanelImpl {...props} draftRequest={{...draft,prompt:""}}/>;
  }
  return <ConnectedAiPanelImpl {...props}/>;
};

export const ContinuingAiHomeWorkspace=lazyNamed(()=>import("./connected-ai-workspaces-impl").then(module=>({default:module.ContinuingAiHomeWorkspace})));
export type {AiDraftRequest,ContextItem} from "./connected-ai-workspaces-impl";
