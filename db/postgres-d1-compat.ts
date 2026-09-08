import type { Pool } from "pg";
import { getDbPool } from "./index";

export type LegacyD1Statement = {
  bind: (...values: unknown[]) => LegacyD1Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<{ success: boolean; meta: { changes: number } }>;
};

export type LegacyD1Compat = {
  prepare: (sql: string) => LegacyD1Statement;
  batch: (statements: LegacyD1Statement[]) => Promise<unknown[]>;
};

function placeholderFor(index: number, value: unknown) {
  const token = `$${index}`;
  if (typeof value === "bigint") return `CAST(${token} AS BIGINT)`;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return value >= -2147483648 && value <= 2147483647
        ? `CAST(${token} AS INTEGER)`
        : `CAST(${token} AS BIGINT)`;
    }
    return `CAST(${token} AS DOUBLE PRECISION)`;
  }
  if (typeof value === "boolean") return `CAST(${token} AS BOOLEAN)`;
  if (value instanceof Date) return `CAST(${token} AS TIMESTAMPTZ)`;
  return token;
}

function normalizeBoundValues(values: unknown[]) {
  return values.map(value => typeof value === "bigint" ? value.toString() : value);
}

function replaceQuestionPlaceholders(sql: string, values: unknown[] = []) {
  let index = 0;
  let quote: "'" | '"' | null = null;
  let out = "";
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "?") {
      index += 1;
      out += placeholderFor(index, values[index - 1]);
      continue;
    }
    out += ch;
  }
  return out;
}

function translateSql(input: string, values: unknown[] = []) {
  let sql = input.trim();

  const pragma = sql.match(/^PRAGMA\s+table_info\(([^)]+)\)\s*;?$/i);
  if (pragma) {
    const table = pragma[1].trim().replace(/["'`]/g, "");
    if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error(`Unsafe PRAGMA table name: ${table}`);
    return `SELECT column_name AS name, data_type AS type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position`;
  }

  sql = sql.replace(
    /FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s+IN\s*\(([^)]+)\)/gi,
    "FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name IN ($1)"
  );

  if (/information_schema\.tables/i.test(sql) && /table_name\s+IN\s*\(\$1\)/i.test(sql)) {
    const originalIn = input.match(/name\s+IN\s*\(([^)]+)\)/i)?.[1] ?? "?";
    const count = (originalIn.match(/\?/g) ?? []).length || 1;
    sql = sql.replace(
      /table_name\s+IN\s*\(\$1\)/i,
      `table_name IN (${Array.from({ length: count }, (_, i) => placeholderFor(i + 1, values[i])).join(",")})`
    );
  } else {
    sql = replaceQuestionPlaceholders(sql, values);
  }

  if (/^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql)) {
    sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
    if (!/\bON\s+CONFLICT\b/i.test(sql)) sql = `${sql.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
  }

  sql = sql.replace(/json_extract\(([^,]+),\s*'\$\.([A-Za-z0-9_]+)'\)/gi, "($1::jsonb ->> '$2')");

  // GROUP_CONCAT compatibility: SQLite -> PostgreSQL string_agg.
  sql = sql.replace(/GROUP_CONCAT\(\s*DISTINCT\s+([^)]+)\)/gi, "string_agg(DISTINCT ($1)::text, ',')");
  sql = sql.replace(/GROUP_CONCAT\(\s*([^)]+)\)/gi, "string_agg(($1)::text, ',')");

  // SQLite date('now') compatibility. Legacy date fields are YYYY-MM-DD text.
  sql = sql.replace(/date\(\s*'now'\s*\)/gi, "CURRENT_DATE::text");
  return sql;
}

function aliasMap(sourceSql: string) {
  const aliases = new Map<string, string>();
  const regex = /\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sourceSql)) !== null) {
    const alias = match[1];
    if (/[A-Z]/.test(alias)) aliases.set(alias.toLowerCase(), alias);
  }
  return aliases;
}

function restoreLegacyAliases<T = Record<string, unknown>>(sourceSql: string, rows: T[]): T[] {
  const aliases = aliasMap(sourceSql);
  if (!aliases.size) return rows;
  return rows.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const output = { ...(row as Record<string, unknown>) };
    for (const [lower, original] of aliases) {
      if (lower in output && !(original in output)) {
        output[original] = output[lower];
        delete output[lower];
      }
    }
    return output as T;
  });
}

function boundValueTypes(values: unknown[]) {
  return values.map(value => value === null ? "null" : value instanceof Date ? "Date" : typeof value);
}

function postgresCompatError(error: unknown, sourceSql: string, translatedSql: string, values: unknown[]) {
  const message = error instanceof Error ? error.message : String(error);
  const detail = [
    message,
    "[postgres-d1-compat] source SQL: " + sourceSql,
    "[postgres-d1-compat] translated SQL: " + translatedSql,
    "[postgres-d1-compat] bound value types: " + JSON.stringify(boundValueTypes(values)),
  ].join("\n");
  const wrapped = new Error(detail);
  (wrapped as Error & { cause?: unknown }).cause = error;
  return wrapped;
}

class Statement implements LegacyD1Statement {
  private values: unknown[] = [];

  constructor(private pool: Pool, private sourceSql: string) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>() {
    const translatedSql = translateSql(this.sourceSql, this.values);
    try {
      const result = await this.pool.query(translatedSql, normalizeBoundValues(this.values));
      return { results: restoreLegacyAliases(this.sourceSql, result.rows as T[]) };
    } catch (error) {
      throw postgresCompatError(error, this.sourceSql, translatedSql, this.values);
    }
  }

  async first<T = Record<string, unknown>>() {
    const translatedSql = translateSql(this.sourceSql, this.values);
    try {
      const result = await this.pool.query(translatedSql, normalizeBoundValues(this.values));
      return restoreLegacyAliases(this.sourceSql, result.rows as T[])[0] ?? null;
    } catch (error) {
      throw postgresCompatError(error, this.sourceSql, translatedSql, this.values);
    }
  }

  async run() {
    const translatedSql = translateSql(this.sourceSql, this.values);
    try {
      const result = await this.pool.query(translatedSql, normalizeBoundValues(this.values));
      return { success: true, meta: { changes: result.rowCount ?? 0 } };
    } catch (error) {
      throw postgresCompatError(error, this.sourceSql, translatedSql, this.values);
    }
  }
}

const globalForCompat = globalThis as typeof globalThis & {
  __aiPlmLegacyDbCompat?: LegacyD1Compat;
};

function createLegacyDbCompat(): LegacyD1Compat {
  const pool = getDbPool();
  return {
    prepare(sql: string) {
      return new Statement(pool, sql);
    },
    async batch(statements: LegacyD1Statement[]) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const statement of statements) {
          if (!(statement instanceof Statement)) throw new Error("Unsupported legacy statement implementation");
          const privateStatement = statement as Statement & { sourceSql: string; values: unknown[] };
          const values = normalizeBoundValues(privateStatement.values);
          const translatedSql = translateSql(privateStatement.sourceSql, privateStatement.values);
          try {
            const result = await client.query(translatedSql, values);
            results.push({ success: true, meta: { changes: result.rowCount ?? 0 }, results: restoreLegacyAliases(privateStatement.sourceSql, result.rows) });
          } catch (error) {
            throw postgresCompatError(error, privateStatement.sourceSql, translatedSql, privateStatement.values);
          }
        }
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export function getLegacyDbCompat(): LegacyD1Compat {
  if (!globalForCompat.__aiPlmLegacyDbCompat) {
    globalForCompat.__aiPlmLegacyDbCompat = createLegacyDbCompat();
  }
  return globalForCompat.__aiPlmLegacyDbCompat;
}
