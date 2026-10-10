import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs path/to/migration.sql");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is missing.");
}

const sql = postgres(url, {
  max: 1,
  prepare: false,
  ssl: "require",
});

const absolute = path.resolve(file);
const schema = await fs.readFile(absolute, "utf8");
await sql.unsafe(schema);
await sql.end({ timeout: 5 });
console.log(`Applied ${absolute}`);
