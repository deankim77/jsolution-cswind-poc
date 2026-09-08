import fs from "node:fs";

const path="app/v2/document-preview-workspace-impl.tsx";
let source=fs.readFileSync(path,"utf8");

const componentMarker='export function PreviewDocumentsWorkspace({project,projects,tasks,initialDeliverableId,onInitialOpened,onOpenTask,onAddDeliverable,onOpenFilter,libraryMode="document",onLibraryModeChange,onOpenDetail}';
if(!source.includes(componentMarker))throw new Error("PreviewDocumentsWorkspace signature not found.");

const stateMarker='  const [items,setItems]=useState<Deliverable[]>([]),[versions,setVersions]=useState<DeliverableVersion[]>([]),[total,setTotal]=useState(0),[registeredCount,setRegisteredCount]=useState(0),[missingRequiredCount,setMissingRequiredCount]=useState(0),[totalRevisionCount,setTotalRevisionCount]=useState(0),[hasMore,setHasMore]=useState(false),[categories,setCategories]=useState<string[]>([]);';
if(!source.includes(stateMarker))throw new Error("State marker not found.");
source=source.replace(stateMarker,`${stateMarker}\n  const debugRenderCount=useRef(0);debugRenderCount.current+=1;if(debugRenderCount.current<=30)console.log("[DOCDBG] render",{count:debugRenderCount.current,libraryMode});`);

const readyMarker='  useEffect(()=>{const controller=new AbortController();fetch("/api/state?key=v2-document-workspace-state",{cache:"no-store",signal:controller.signal})';
if(!source.includes(readyMarker))throw new Error("Workspace-state effect marker not found.");
source=source.replace(readyMarker,'  useEffect(()=>{console.log("[DOCDBG] workspace-state:start",{libraryMode});const controller=new AbortController();fetch("/api/state?key=v2-document-workspace-state",{cache:"no-store",signal:controller.signal})');

const readyFinally='}).catch(()=>undefined).finally(()=>{if(!controller.signal.aborted)setWorkspaceStateReady(true)});return()=>controller.abort()},[]);';
if(!source.includes(readyFinally))throw new Error("Workspace-state finally marker not found.");
source=source.replace(readyFinally,'}).catch(reason=>console.log("[DOCDBG] workspace-state:error",reason)).finally(()=>{console.log("[DOCDBG] workspace-state:finally",{aborted:controller.signal.aborted,libraryMode});if(!controller.signal.aborted)setWorkspaceStateReady(true)});return()=>{console.log("[DOCDBG] workspace-state:cleanup",{libraryMode});controller.abort()}},[]);');

const loadStart='const load=useCallback(()=>{if(!workspaceStateReady)return()=>{};const controller=new AbortController();requestKeyRef.current=requestKey;setLoading(true);';
if(!source.includes(loadStart))throw new Error("Load start marker not found. Run restore-document-list-loading.mjs first if needed.");
source=source.replace(loadStart,'const load=useCallback(()=>{console.log("[DOCDBG] load:invoke",{workspaceStateReady,requestKey,libraryMode});if(!workspaceStateReady)return()=>{};const controller=new AbortController();requestKeyRef.current=requestKey;console.log("[DOCDBG] load:start",{requestKey,libraryMode});setLoading(true);');

const thenMarker='fetchList(0,controller.signal).then(data=>{setItems(data.deliverables??[]);';
if(!source.includes(thenMarker))throw new Error("fetchList load marker not found.");
source=source.replace(thenMarker,'fetchList(0,controller.signal).then(data=>{console.log("[DOCDBG] load:resolved",{requestKey,libraryMode,total:data.total,items:data.deliverables?.length,versions:data.versions?.length});setItems(data.deliverables??[]);');

const finallyMarker='}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[workspaceStateReady,requestKey,fetchList]);';
if(!source.includes(finallyMarker))throw new Error("Load finally marker not found.");
source=source.replace(finallyMarker,'}).finally(()=>{console.log("[DOCDBG] load:finally",{requestKey,libraryMode,aborted:controller.signal.aborted});if(!controller.signal.aborted){setLoading(false);console.log("[DOCDBG] loading:false",{requestKey,libraryMode})}});return()=>{console.log("[DOCDBG] load:cleanup",{requestKey,libraryMode});controller.abort()}},[workspaceStateReady,requestKey,fetchList]);');

fs.writeFileSync(path,source,"utf8");
console.log("Temporary DOCDBG diagnostics added to document-preview-workspace-impl.tsx");
