import http from "node:http";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.AUTODWG_CONVERTER_PORT || 8791);
const HOST = process.env.AUTODWG_CONVERTER_HOST || "127.0.0.1";
const TOKEN = process.env.AUTODWG_CONVERTER_TOKEN || "";
const MAX_BYTES = Number(
  process.env.AUTODWG_CONVERTER_MAX_BYTES || 150 * 1024 * 1024
);

const ROOT =
  process.env.CAD_WORKER_ROOT || join(process.cwd(), "cad-worker");

const INBOX = join(ROOT, "inbox");
const PROCESSING = join(ROOT, "processing");
const OUTPUT = join(ROOT, "output");
const DONE = join(ROOT, "done");
const ERROR = join(ROOT, "error");

const D2P_EXE =
  process.env.AUTODWG_D2P_EXE ||
  "C:\\Program Files (x86)\\AutoDWG\\AutoDWG DWG to PDF Converter 2020\\D2P.exe";

const CONVERT_TIMEOUT_MS = Number(
  process.env.AUTODWG_CONVERT_TIMEOUT_MS || 120000
);

const RESULT_WAIT_MS = Number(
  process.env.AUTODWG_RESULT_WAIT_MS || 60000
);

const RESULT_CHECK_MS = Math.max(
  1000,
  Number(process.env.AUTODWG_RESULT_CHECK_MS || 3000)
);

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const safe = (value) =>
  String(value || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

/**
 * 현재 시간을 한국 표준시(KST) 기준으로 반환
 * 예: 2026-09-01 11:25:30
 */
function nowKST() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Seoul",
    hour12: false,
  });
}

/**
 * 공통 로그 출력
 */
function log(message) {
  console.log(`[${nowKST()}] [autodwg-converter] ${message}`);
}

/**
 * 공통 에러 로그 출력
 */
function logError(message) {
  console.error(`[${nowKST()}] [autodwg-converter] ${message}`);
}

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });

  res.end(JSON.stringify(payload));
}

function sanitizeBaseName(fileName) {
  const raw = basename(
    fileName || "drawing.dwg",
    extname(fileName || "drawing.dwg")
  );

  return safe(raw) || "drawing";
}

async function ensureFolders() {
  for (const dir of [
    INBOX,
    PROCESSING,
    OUTPUT,
    DONE,
    ERROR,
  ]) {
    await mkdir(dir, { recursive: true });
  }
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > MAX_BYTES) {
      throw new Error(
        "DWG file exceeds converter size limit."
      );
    }

    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),

    fileName: decodeURIComponent(
      String(
        req.headers["x-file-name"] || "drawing.dwg"
      )
    ),
  };
}

async function readInput(req) {
  const contentType = String(
    req.headers["content-type"] || ""
  );

  if (
    !contentType
      .toLowerCase()
      .startsWith("multipart/form-data")
  ) {
    return readRawBody(req);
  }

  const webRequest = new Request(
    `http://127.0.0.1${req.url || "/"}`,
    {
      method: "POST",
      headers: req.headers,
      body: Readable.toWeb(req),
      duplex: "half",
    }
  );

  const form = await webRequest.formData();
  const file = form.get("file");

  if (!(file instanceof File) || !file.size) {
    throw new Error(
      "DWG file is missing from multipart request."
    );
  }

  if (file.size > MAX_BYTES) {
    throw new Error(
      "DWG file exceeds converter size limit."
    );
  }

  return {
    buffer: Buffer.from(
      await file.arrayBuffer()
    ),

    fileName: file.name || "drawing.dwg",
  };
}

function runD2P(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      D2P_EXE,
      [
        "/InFile",
        input,
        "/OutFile",
        output,
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const stdout = [];
    const stderr = [];

    const timer = setTimeout(() => {
      child.kill();

      reject(
        new Error(
          `AutoDWG conversion timed out after ${CONVERT_TIMEOUT_MS} ms.`
        )
      );
    }, CONVERT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) =>
      stdout.push(chunk)
    );

    child.stderr.on("data", (chunk) =>
      stderr.push(chunk)
    );

    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.once("close", (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        return reject(
          new Error(
            `D2P.exe failed (${code}): ${
              Buffer.concat(stderr)
                .toString("utf8")
                .trim() ||
              Buffer.concat(stdout)
                .toString("utf8")
                .trim()
            }`
          )
        );
      }

      resolve();
    });
  });
}

async function waitForPdf(path) {
  const started = Date.now();

  while (
    Date.now() - started <
    RESULT_WAIT_MS
  ) {
    try {
      await access(path);

      const pdf = await readFile(path);

      if (
        pdf.length > 4 &&
        pdf
          .subarray(0, 4)
          .toString() === "%PDF"
      ) {
        return pdf;
      }
    } catch {
      // PDF가 아직 생성되지 않은 경우 계속 대기
    }

    await sleep(RESULT_CHECK_MS);
  }

  throw new Error(
    `PDF output was not detected within ${Math.round(
      RESULT_WAIT_MS / 1000
    )} seconds.`
  );
}

async function moveIfExists(from, to) {
  try {
    await rename(from, to);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(
  async (req, res) => {
    const started = Date.now();

    /*
     * Health Check
     */
    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {
      try {
        await ensureFolders();
        await access(D2P_EXE);

        return json(res, 200, {
          ok: true,
          engine: "AutoDWG D2P",
          output: "pdf",
          root: ROOT,
          mode: "upload-triggered",
          resultCheckMs:
            RESULT_CHECK_MS,
          resultWaitMs:
            RESULT_WAIT_MS,
        });
      } catch {
        return json(res, 503, {
          ok: false,
          engine: "AutoDWG D2P",
          error: `D2P.exe not found: ${D2P_EXE}`,
        });
      }
    }

    /*
     * Convert API
     */
    if (
      req.method !== "POST" ||
      ![
        "/convert/dwg-to-pdf",
        "/convert",
      ].includes(req.url || "")
    ) {
      return json(res, 404, {
        error: "Not found",
      });
    }

    /*
     * Token 인증
     */
    if (
      TOKEN &&
      req.headers.authorization !==
        `Bearer ${TOKEN}`
    ) {
      return json(res, 401, {
        error: "Unauthorized",
      });
    }

    let job = null;

    try {
      await ensureFolders();
      await access(D2P_EXE);

      const {
        buffer,
        fileName,
      } = await readInput(req);

      if (!buffer.length) {
        return json(res, 400, {
          error: "DWG body is empty.",
        });
      }

      const base =
        sanitizeBaseName(fileName);

      const token =
        randomUUID().slice(0, 8);

      const workBase =
        `${base}_${token}`;

      const dwgName =
        `${workBase}.dwg`;

      const pdfName =
        `${workBase}.pdf`;

      const jobName =
        `${workBase}.job.json`;

      const inboxDwg = join(
        INBOX,
        dwgName
      );

      const inboxJob = join(
        INBOX,
        jobName
      );

      const processingDwg = join(
        PROCESSING,
        dwgName
      );

      const processingJob = join(
        PROCESSING,
        jobName
      );

      const outputPdf = join(
        OUTPUT,
        pdfName
      );

      job = {
        id: token,
        sourceFileName: fileName,
        dwgFileName: dwgName,
        pdfFileName: pdfName,
        createdAt:
          new Date().toISOString(),
        status: "queued",
      };

      await writeFile(
        inboxDwg,
        buffer
      );

      await writeFile(
        inboxJob,
        JSON.stringify(job, null, 2),
        "utf8"
      );

      log(
        `queued ${dwgName}`
      );

      await rename(
        inboxDwg,
        processingDwg
      );

      await rename(
        inboxJob,
        processingJob
      );

      job.status = "converting";

      await writeFile(
        processingJob,
        JSON.stringify(job, null, 2),
        "utf8"
      );

      log(
        `converting ${dwgName} -> ${pdfName}`
      );

      await runD2P(
        processingDwg,
        outputPdf
      );

      const pdf =
        await waitForPdf(outputPdf);

      await copyFile(
        processingDwg,
        join(DONE, dwgName)
      );

      await copyFile(
        outputPdf,
        join(DONE, pdfName)
      );

      job = {
        ...job,
        status: "converted",
        completedAt:
          new Date().toISOString(),
        elapsedMs:
          Date.now() - started,
      };

      await writeFile(
        join(DONE, jobName),
        JSON.stringify(job, null, 2),
        "utf8"
      );

      await rm(
        processingDwg,
        {
          force: true,
        }
      );

      await rm(
        processingJob,
        {
          force: true,
        }
      );

      await rm(
        outputPdf,
        {
          force: true,
        }
      );

      log(
        `completed ${pdfName} (${pdf.length} bytes) in ${
          Date.now() - started
        } ms`
      );

      res.writeHead(200, {
        "content-type":
          "application/pdf",

        "content-length":
          String(pdf.length),

        "x-autodwg-engine":
          "D2P.exe",

        "x-output-file-name":
          encodeURIComponent(pdfName),

        "x-cad-job-id":
          token,
      });

      res.end(pdf);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      logError(
        `failed after ${
          Date.now() - started
        } ms: ${message}`
      );

      if (job) {
        const failed = {
          ...job,
          status: "failed",
          error: message,
          failedAt:
            new Date().toISOString(),
        };

        await writeFile(
          join(
            ERROR,
            `${job.id}.job.json`
          ),
          JSON.stringify(
            failed,
            null,
            2
          ),
          "utf8"
        ).catch(() => {});

        for (const name of [
          job.dwgFileName,
          job.pdfFileName,
        ]) {
          for (const dir of [
            INBOX,
            PROCESSING,
            OUTPUT,
          ]) {
            if (
              await moveIfExists(
                join(dir, name),
                join(ERROR, name)
              )
            ) {
              break;
            }
          }
        }
      }

      json(res, 500, {
        error: message,
      });
    }
  }
);

await ensureFolders();

server.listen(
  PORT,
  HOST,
  () => {
    log(
      `listening on http://${HOST}:${PORT}`
    );

    log(
      `root: ${ROOT}`
    );

    log(
      `D2P.exe: ${D2P_EXE}`
    );

    log(
      `mode: upload-triggered / PDF check ${RESULT_CHECK_MS} ms / max ${RESULT_WAIT_MS} ms`
    );
  }
);