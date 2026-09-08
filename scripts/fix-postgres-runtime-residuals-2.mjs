import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const changed=[];
function patch(rel,transforms){const file=path.join(root,rel);let text=fs.readFileSync(file,"utf8");const before=text;for(const transform of transforms)text=transform(text);if(text!==before){fs.writeFileSync(file,text,"utf8");changed.push(rel)}}
const replace=(from,to)=>text=>text.replace(from,to);

patch("app/api/dashboard-detail/route.ts",[
  replace("planned_end<date('now')","planned_end<CURRENT_DATE::text"),
  replace("CAST(julianday('now')-julianday(s.planned_end) AS INTEGER)","(CURRENT_DATE - s.planned_end::date)"),
  replace("ORDER BY d2.decided_at DESC,d2.rowid DESC LIMIT 1","ORDER BY d2.decided_at DESC,d2.id DESC LIMIT 1"),
]);

for(const rel of ["app/api/ecr/route.ts","app/api/quality/route.ts"]){
  patch(rel,[
    replace("group_concat(flow.name||'|'||flow.status,'~')","string_agg(flow.name||'|'||flow.status,'~')"),
  ]);
}

patch("app/api/workflows/shared.ts",[
  replace("ORDER BY h.created_at,h.rowid","ORDER BY h.created_at,h.id"),
]);

// Surface hidden 500 causes during PostgreSQL cutover without changing response contracts.
const diagnostics=[
  ["app/api/deliverable-standards/route.ts","표준 산출물을 불러오지 못했습니다.","DELIVERABLE_STANDARDS"],
  ["app/api/system/master-data/route.ts","마스터 데이터를 불러오지 못했습니다.","MASTER_DATA"],
  ["app/api/system/drawing-types/route.ts","도면 유형을 불러오지 못했습니다.","DRAWING_TYPES"],
  ["app/api/workflows/templates/route.ts","Workflow 템플릿을 불러오지 못했습니다.","WORKFLOW_TEMPLATES"],
];
for(const [rel,message,label] of diagnostics){
  patch(rel,[text=>{
    const needle=`catch(reason){return contextErrorResponse(reason)??Response.json({error:\"${message}\"},{status:500})}`;
    const replacement=`catch(reason){console.error(\"[${label}_ERROR]\",reason);return contextErrorResponse(reason)??Response.json({error:\"${message}\"},{status:500})}`;
    return text.includes(needle)?text.replace(needle,replacement):text;
  }]);
}

console.log(`Second residual PostgreSQL patch complete: ${changed.length} file(s) changed.`);
for(const file of changed)console.log(` - ${file}`);
if(!changed.length)console.log("No changes needed; patch is already applied.");
