import fs from "node:fs";

const path="app/v2/document-preview-workspace-impl.tsx";
let source=fs.readFileSync(path,"utf8");
const original=source;

source=source.replace(/\nconst PAGE_SIZE=50;\r?\n/,"\n");

source=source.replace(
  /const buildParams=useCallback\([\s\S]*?(?=\n\s*const requestKey=)/,
  'const buildParams=useCallback((value=filters)=>{const params=new URLSearchParams({mode:"latest",documentKind:libraryMode});if(debouncedQuery)params.set("q",debouncedQuery);if(projectFilter!=="all")params.set("projectId",projectFilter);if(registrationFilter!=="all")params.set("registration",registrationFilter);if(value.review)params.set("review",value.review);if(value.required)params.set("required",value.required);if(value.source)params.set("source",value.source);if(value.category)params.set("category",value.category);return params},[debouncedQuery,projectFilter,registrationFilter,filters,libraryMode]);'
);

source=source.replace(
  /const requestKey=useMemo\([^\n]+/,
  'const requestKey=useMemo(()=>buildParams(filters).toString(),[buildParams,filters]);'
);

source=source.replace(
  /const fetchList=useCallback\([\s\S]*?(?=\n\s*const load=useCallback)/,
  'const fetchList=useCallback(async(signal?:AbortSignal,value=filters)=>{const response=await fetch(`/api/deliverables?${buildParams(value)}`,{cache:"no-store",signal});const data=await response.json() as ListResponse;if(!response.ok)throw new Error(data.error||"산출물을 불러오지 못했습니다.");return data},[buildParams,filters]);'
);

source=source.replace(/fetchList\(0,controller\.signal\)/g,'fetchList(controller.signal)');
source=source.replace(/fetchList\(0,controller\.signal,draftFilters,10\)/g,'fetchList(controller.signal,draftFilters)');
source=source.replace(/fetchList\(items\.length\)/g,'fetchList()');

source=source.replace(
  /\n\s*const loadMore=useCallback\([\s\S]*?(?=\n\s*const latestFor=)/,
  "\n"
);

source=source.replace(/\s+onScroll=\{event=>\{[\s\S]*?loadMore\(\)[\s\S]*?\}\}/g,"");

if(source===original)throw new Error("No document pagination patterns were changed. Inspect current source before retrying.");
const residue=[];
if(source.includes("PAGE_SIZE=50"))residue.push("PAGE_SIZE");
if(source.includes("limit:String(limit)"))residue.push("limit");
if(source.includes("offset:String(offset)"))residue.push("offset");
if(source.includes("const loadMore="))residue.push("loadMore definition");
if(/onScroll=\{[^}]*loadMore/.test(source))residue.push("loadMore scroll handler");
if(residue.length)throw new Error(`Document pagination residue remains: ${residue.join(", ")}`);

fs.writeFileSync(path,source,"utf8");
console.log("Document/drawing library pagination removed; lists now load in one request.");
