import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "app", "v2", "project-workspaces.tsx");
if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);

let source = fs.readFileSync(file, "utf8");
const before = source;

source = source.replace(
  /void fetch\("\/api\/state",\{method:"PUT",headers:\{"content-type":"application\/json"\},body:JSON\.stringify\(\{key:"v2-project-list-filter",value:\{query,filters,sortKey\}\}\)\}\)/g,
  'void fetch("/api/state",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:"v2-project-list-filter",value:{query,filters,sortKey}})}).catch(()=>{})'
);

if (source === before) {
  console.log("No unhandled project state fetch pattern found; no change made.");
} else {
  fs.writeFileSync(file, source, "utf8");
  console.log("Patched app/v2/project-workspaces.tsx to absorb transient state-save fetch failures.");
}
