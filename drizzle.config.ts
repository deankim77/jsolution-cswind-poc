import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Drizzle PostgreSQL commands.");
}

export default defineConfig({
  out: "./drizzle-postgres",
  schema: ["./db/schema.ts", "./db/workflow-part-schema.ts", "./db/workflow-drawing-schema.ts", "./db/customer-data-schema.ts", "./db/production-schema.ts", "./db/customer-review-schema.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
