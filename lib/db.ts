import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Set it in .env.local before running the app.");
}

declare global {
  // eslint-disable-next-line no-var
  var __tpp_sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  globalThis.__tpp_sql ??
  postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__tpp_sql = sql;
}

