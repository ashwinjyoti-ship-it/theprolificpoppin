import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "db", "schema.sql");
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is missing.");
}

const sql = postgres(url, {
  max: 1,
  prepare: false,
  ssl: "require",
});

const schema = await fs.readFile(schemaPath, "utf8");

await sql.unsafe(schema);

await sql.end({ timeout: 5 });

console.log("Neon schema applied successfully.");
