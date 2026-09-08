import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root=process.cwd();
const appRoot=path.join(root,"app");
const extensions=new Set([".ts",".tsx",".js",".jsx"]);

function walk(dir){
  const result=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...walk(full));
    else if(extensions.has(path.extname(entry.name)))result.push(full);
  }
  return result;
}

const rules=[
  {id:"dom-create",severity:"P0",re:/document\.createElement\s*\(/g,reason:"React 트리 내부에 DOM 노드를 직접 생성"},
  {id:"dom-insert",severity:"P0",re:/\.(?:appendChild|prepend|insertBefore|replaceChildren|replaceWith)\s*\(/g,reason:"React 트리 내부에 DOM 노드를 직접 삽입/교체"},
  {id:"dom-remove",severity:"P0",re:/\.(?:removeChild|remove)\s*\(/g,reason:"React가 소유한 DOM 노드를 직접 제거할 가능성"},
  {id:"html-write",severity:"P0",re:/\.(?:innerHTML|outerHTML)\s*=/g,reason:"React 렌더 트리를 문자열 HTML로 덮어씀"},
  {id:"forced-click",severity:"P1",re:/\.(?:click)\s*\(\s*\)/g,reason:"다른 컴포넌트의 DOM 이벤트를 강제로 실행"},
  {id:"observer",severity:"P1",re:/new\s+MutationObserver\s*\(/g,reason:"DOM 변경을 감시해 기능을 후처리"},
  {id:"global-query",severity:"P2",re:/document\.(?:querySelector|querySelectorAll)\s*\(/g,reason:"컴포넌트 경계를 넘어 전역 DOM 구조에 의존"},
];

const rows=[];
for(const file of walk(appRoot)){
  const source=fs.readFileSync(file,"utf8");
  const hits=[];
  for(const rule of rules){
    const count=[...source.matchAll(rule.re)].length;
    if(count)hits.push({...rule,count});
  }
  if(!hits.length)continue;
  const p0=hits.some(hit=>hit.severity==="P0");
  const p1=hits.some(hit=>hit.severity==="P1");
  const severity=p0?"P0":p1?"P1":"P2";
  rows.push({file:path.relative(root,file).replaceAll("\\","/"),severity,hits});
}

const rank={P0:0,P1:1,P2:2};
rows.sort((a,b)=>rank[a.severity]-rank[b.severity]||a.file.localeCompare(b.file));

console.log("# React DOM override audit\n");
console.log(`Scanned ${walk(appRoot).length} JS/TS source files; flagged ${rows.length}.\n`);
for(const row of rows){
  console.log(`## ${row.severity} ${row.file}`);
  for(const hit of row.hits)console.log(`- ${hit.id}: ${hit.count} — ${hit.reason}`);
  console.log("");
}

const p0Count=rows.filter(row=>row.severity==="P0").length;
const p1Count=rows.filter(row=>row.severity==="P1").length;
console.log(`Summary: P0=${p0Count}, P1=${p1Count}, P2=${rows.length-p0Count-p1Count}`);

if(process.argv.includes("--fail-on-p0")&&p0Count>0)process.exit(1);
