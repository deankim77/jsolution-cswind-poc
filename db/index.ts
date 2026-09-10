import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as pbomSchema from "./pbom-schema";
import * as customerReviewSchema from "./customer-review-schema";
import * as schema from "./schema";
import * as workflowPartSchema from "./workflow-part-schema";
import * as workflowDrawingSchema from "./workflow-drawing-schema";
import * as productionSchema from "./production-schema";
import * as customerDataSchema from "./customer-data-schema";

const globalForDb = globalThis as typeof globalThis & {
  __aiPlmPgPool?: Pool;
};

const databaseSchema = { ...pbomSchema, ...customerReviewSchema, ...schema, ...workflowPartSchema, ...workflowDrawingSchema, ...customerDataSchema, ...productionSchema };

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect AI PLM to PostgreSQL.");
  }

  if (!globalForDb.__aiPlmPgPool) {
    globalForDb.__aiPlmPgPool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000),
    });
  }

  return globalForDb.__aiPlmPgPool;
}

export function getDb() {
  return drizzle(getPool(), { schema: databaseSchema });
}

export function getDbPool() {
  return getPool();
}
