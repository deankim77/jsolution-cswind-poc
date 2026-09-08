import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vinext from "vinext";
import { defineConfig } from "vite";

function loadDevVars() {
  const file = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(file)) return;

  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDevVars();

export default defineConfig({
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local", "aipms.jjjsolution.com", "ai-pms.jjjsolution.com", "localhost"],
  },
  ssr: {
    external: ["pg", "pg-native"],
  },
  plugins: [vinext()],
});
