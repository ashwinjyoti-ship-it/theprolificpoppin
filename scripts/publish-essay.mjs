#!/usr/bin/env node
// Publish or update an essay on theprolificpoppin.com via the site's admin API.
//
// Usage:
//   node scripts/publish-essay.mjs path/to/essay.json
//
// essay.json shape:
// {
//   "title": "string (required)",
//   "content": "string (required, ## for headings)",
//   "category": "one of: the-ache, ... (required, see lib/data.ts categories)",
//   "excerpt": "string (optional, auto-generated if omitted)",
//   "slug": "string (optional, auto-generated from title if omitted)",
//   "published": true,
//   "featured": false,
//   "id": 12   // include to UPDATE an existing essay instead of creating one
// }
//
// Required environment variables:
//   SITE_URL        e.g. https://theprolificpoppin.com
//   ADMIN_API_KEY   the secret from the site's ADMIN_API_KEY env var

import { readFile } from "node:fs/promises";

const [, , filePath] = process.argv;

if (!filePath) {
  console.error("Usage: node scripts/publish-essay.mjs path/to/essay.json");
  process.exit(1);
}

const siteUrl = process.env.SITE_URL;
const apiKey = process.env.ADMIN_API_KEY;

if (!siteUrl) {
  console.error("Missing SITE_URL environment variable.");
  process.exit(1);
}
if (!apiKey) {
  console.error("Missing ADMIN_API_KEY environment variable.");
  process.exit(1);
}

const raw = await readFile(filePath, "utf8");
const essay = JSON.parse(raw);

if (!essay.title || !essay.content || !essay.category) {
  console.error("essay.json must include title, content, and category.");
  process.exit(1);
}

const isUpdate = Boolean(essay.id);
const url = isUpdate
  ? `${siteUrl.replace(/\/$/, "")}/api/essays/${essay.id}`
  : `${siteUrl.replace(/\/$/, "")}/api/essays`;

const response = await fetch(url, {
  method: isUpdate ? "PUT" : "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  },
  body: JSON.stringify(essay),
});

const body = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`Failed (${response.status}):`, body.error || body);
  process.exit(1);
}

console.log(isUpdate ? "Updated essay:" : "Created essay:", body.essay);
