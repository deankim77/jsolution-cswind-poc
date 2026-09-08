"use client";

import {Suspense,lazy,type ComponentType} from "react";

const lazyNamed=(loader:()=>Promise<{default:ComponentType<any>}>)=>{
  const Component=lazy(loader);
  return (props:any)=><Suspense fallback={null}><Component {...props}/></Suspense>;
};

export const ReportsWorkspace=lazyNamed(()=>import("./module-workspaces-impl").then(module=>({default:module.ReportsWorkspace})));
export type {ReportAiRequest} from "./module-workspaces-impl";
