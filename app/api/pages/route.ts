import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPages, savePage } from "@/lib/server-data";
import { isAuthorized, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

const PAGE_PATHS: Record<string, string> = {
  about: "/about",
  about_author: "/author",
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const pages = await getPages();
  return NextResponse.json({ pages });
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const body = await request.json();
  await savePage(body);
  const path = PAGE_PATHS[body.page_key];
  if (path) revalidatePath(path);
  return NextResponse.json({ ok: true });
}

