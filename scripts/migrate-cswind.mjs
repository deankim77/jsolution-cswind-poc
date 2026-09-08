import fs from "node:fs";
import path from "node:path";

// Match the Node development server's .dev.vars precedence, then allow .env as fallback.
for (const name of [".dev.vars", ".env"]) {
  const file = path.resolve(name);
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
let database;
try { database = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)); }
catch { throw new Error("CS WIND DATABASE_URL 설정을 확인하세요. 비밀번호를 로그나 대화에 공유하지 마세요."); }
if (database !== "jsolution_cswind_poc") {
  throw new Error("CS WIND 전용 마이그레이션은 jsolution_cswind_poc DB에서만 실행할 수 있습니다.");
}
console.log("CS WIND database verified: jsolution_cswind_poc");
await import("./migrate-postgres.mjs");
