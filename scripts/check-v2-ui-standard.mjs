import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {execFileSync} from "node:child_process";

const root=process.cwd();
const tokensPath=path.join(root,"app/ui-standard-tokens.css");
const foundationPath=path.join(root,"app/v2/v2-ui-foundation-enforcement.css");
const v2Path=path.join(root,"app/v2");
const errors=[];
const tokens=fs.readFileSync(tokensPath,"utf8");
const foundation=fs.readFileSync(foundationPath,"utf8");

const requiredTokens=new Map([
  ["--v2-font-size-screen-title","22px"],
  ["--v2-font-size-section-title","18px"],
  ["--v2-font-size-card-title","16px"],
  ["--v2-font-size-panel-title","16px"],
  ["--v2-font-size-body","14px"],
  ["--v2-font-size-control","14px"],
  ["--v2-font-size-table-header","13px"],
  ["--v2-font-size-caption","12px"],
  ["--v2-font-size-min","12px"],
  ["--v2-font-size-gantt-progress","10px"],
  ["--v2-icon-size","18px"],
  ["--v2-icon-size-primary","20px"],
  ["--v2-right-panel-width","560px"],
  ["--v2-right-panel-wide-width","760px"],
  ["--v2-surface-workspace","#f6f8fa"],
  ["--v2-surface-content","#ffffff"],
  ["--v2-surface-subtle","#f7f9fa"],
  ["--v2-surface-table-header","#edf2f4"],
  ["--v2-tab-height","38px"],
  ["--v2-tab-active-border-width","2px"],
  ["--v2-tab-active-background","transparent"],
]);

for(const [name,value] of requiredTokens){
  const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  if(!new RegExp(`${name}\\s*:\\s*${escaped}\\s*;`).test(tokens))errors.push(`${tokensPath}: expected ${name}: ${value}`);
}

const requiredFoundationSelectors=[
  ".wv2 .wv2-content",
  ".wv2 .wv2-project-workspace",
  ".wv2 .wv2-module",
  ".wv2 .wv2-document-workspace",
  ".wv2 .wv2-system-suite",
  ".wv2 .wv2-settings-workspace",
  ".wv2 .pbw-shell",
  ".wv2 .pcw-shell",
  ".wv2 .wv2-module-head small",
  ".wv2 .wv2-system-suite > header small",
  ".wv2 .pbw-head small",
  ".wv2 .pcw-head small",
  ".wv2 .wv2-module-head h1",
  ".wv2 .wv2-system-suite > header h1",
  ".wv2 .pbw-head h1",
  ".wv2 .pcw-head h1",
  ".wv2 .wv2-module-head p",
  ".wv2 .wv2-system-suite > header p",
  ".wv2 .pbw-head p",
  ".wv2 .pcw-head p",
  ".wv2 .wv2-view-tabs",
  ".wv2 .wv2-preview-tabs",
  ".wv2 .wv2-system-suite > nav",
  ".wv2 .pbw-tabs",
  ".wv2 .pcw-tabs",
  ".wv2 .wv2-document-table > header",
  ".wv2 .wv2-issue-table > header",
  ".wv2 .wv2-master-table > header",
  ".wv2 .pbw-part-table > header",
  ".wv2 .pcw-budget-table .th",
  ".wv2 .wv2-advanced-wbs-editor th",
];
for(const selector of requiredFoundationSelectors){
  if(!foundation.includes(selector))errors.push(`${foundationPath}: missing required Foundation selector ${selector}`);
}
if(!foundation.includes("background: var(--v2-tab-active-background)"))errors.push(`${foundationPath}: central active tabs must use --v2-tab-active-background`);
if(!foundation.includes("border-bottom-color: var(--v2-color-primary)"))errors.push(`${foundationPath}: central active tabs must use the V2 primary underline`);
if(!foundation.includes("background: var(--v2-surface-workspace)"))errors.push(`${foundationPath}: workspace surfaces must use --v2-surface-workspace`);
if(!foundation.includes("background: var(--v2-surface-content)"))errors.push(`${foundationPath}: content surfaces must use --v2-surface-content`);
if(!foundation.includes("background: var(--v2-surface-table-header)"))errors.push(`${foundationPath}: table headers must use --v2-surface-table-header`);
if(!foundation.includes("font-size: var(--v2-font-size-screen-title)"))errors.push(`${foundationPath}: workspace titles must use --v2-font-size-screen-title`);
if(!foundation.includes("font-size: var(--v2-font-size-caption)"))errors.push(`${foundationPath}: workspace kicker/description must use --v2-font-size-caption`);
if(!foundation.includes("font-family: var(--v2-font-family)"))errors.push(`${foundationPath}: workspace headers must use --v2-font-family`);
if(!foundation.includes("letter-spacing: .12em"))errors.push(`${foundationPath}: workspace kicker must use the shared .12em letter spacing`);

function walk(dir){
  const result=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

function gitFiles(args){
  try{return execFileSync("git",args,{cwd:root,encoding:"utf8",stdio:["ignore","pipe","ignore"]}).split(/\r?\n/).map(value=>value.trim()).filter(Boolean)}catch{return[]}
}

function changedFiles(){
  if(process.env.V2_UI_CHECK_ALL==="1")return walk(v2Path);
  const files=new Set();
  const commands=[
    ["diff","--name-only","--diff-filter=ACMR","HEAD","--","app/v2"],
    ["diff","--cached","--name-only","--diff-filter=ACMR","--","app/v2"],
    ["diff-tree","--no-commit-id","--name-only","-r","--diff-filter=ACMR","HEAD","--","app/v2"],
  ];
  for(const args of commands)for(const file of gitFiles(args))files.add(path.join(root,file));
  return [...files].filter(file=>fs.existsSync(file));
}

const targets=changedFiles();
for(const filePath of targets){
  const ext=path.extname(filePath);
  if(ext!==".css"&&ext!==".tsx"&&ext!==".ts")continue;
  const source=fs.readFileSync(filePath,"utf8");

  if(ext===".tsx"||ext===".ts"){
    for(const match of source.matchAll(/size=\{([0-9]+)\}/g)){
      const size=Number(match[1]);
      if(size>0&&size<18)errors.push(`${filePath}: icon size ${size}px is below the V2 18px minimum; use the Foundation icon size`);
    }
    if(/\b(Maximize|Maximize2|Expand)\b/.test(source)&&/(right[-_ ]?panel|RightPanel|panelWide|panelOpen|workflow-detail)/i.test(source)){
      errors.push(`${filePath}: right-panel expand/collapse must use PanelRightOpen / PanelRightClose, not Maximize/Expand icons`);
    }
    continue;
  }

  for(const match of source.matchAll(/font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px/g)){
    const size=Number(match[1]);
    if(size<12)errors.push(`${filePath}: raw font-size ${size}px is below the V2 12px minimum`);
  }

  if(/width\s*:\s*(560|760)px/.test(source))errors.push(`${filePath}: raw 560px/760px right-panel width is forbidden; use --v2-right-panel-width / --v2-right-panel-wide-width`);

  if(filePath!==foundationPath){
    for(const match of source.matchAll(/([^{}]*tabs[^{}]*\.active[^{}]*)\{([^}]*)\}/gi)){
      const body=match[2];
      const background=body.match(/background(?:-color)?\s*:\s*([^;]+)/i)?.[1]?.trim();
      if(background&&background!=="transparent"&&background!=="none"&&background!=="var(--v2-tab-active-background)"){
        errors.push(`${filePath}: central tab active background '${background}' is forbidden; use teal text/icon + underline with transparent background`);
      }
    }

    for(const match of source.matchAll(/([^{}]*(?:shell|workspace)[^{}]*)\{([^}]*)\}/gi)){
      const body=match[2];
      if(/background(?:-color)?\s*:\s*#[0-9a-f]{3,8}\b/i.test(body)){
        errors.push(`${filePath}: workspace/shell background must use a --v2-surface-* token instead of a raw hex color`);
        break;
      }
    }
  }
}

if(errors.length){
  console.error("V2 UI Foundation check failed:\n"+errors.join("\n"));
  process.exit(1);
}

console.log(`V2 UI Foundation check passed${targets.length?` (${targets.length} changed V2 file${targets.length===1?"":"s"})`:""}.`);
