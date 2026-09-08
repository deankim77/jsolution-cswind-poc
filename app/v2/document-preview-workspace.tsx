"use client";

import "./document-list-wbs-link.css";
import {Suspense,lazy,useEffect,useState,type ComponentType} from "react";
import DocumentManagementPanel from "./document-management-panel";

const LibraryWorkspace=lazy(()=>import("./document-library-workspace"));
type LibraryMode="document"|"drawing";

function DocumentWorkspace(props:any){
  const [libraryMode,setLibraryMode]=useState<LibraryMode>("document");
  const [detailId,setDetailId]=useState("");
  const [refreshVersion,setRefreshVersion]=useState(0);

  useEffect(()=>{
    const refresh=()=>setRefreshVersion(value=>value+1);
    window.addEventListener("v2-deliverables-updated",refresh);
    return()=>window.removeEventListener("v2-deliverables-updated",refresh);
  },[]);

  return <>
    <Suspense fallback={null}><LibraryWorkspace {...props} refreshVersion={refreshVersion} libraryMode={libraryMode} onLibraryModeChange={setLibraryMode} onOpenDetail={setDetailId}/></Suspense>
    {detailId&&<DocumentManagementPanel deliverableId={detailId} onClose={()=>setDetailId("")} onOpenTask={(projectId,taskId)=>{setDetailId("");props.onOpenTask?.(projectId,taskId)}}/>}
  </>;
}

export const PreviewDocumentsWorkspace=((props:any)=><DocumentWorkspace {...props}/>) as ComponentType<any>;
