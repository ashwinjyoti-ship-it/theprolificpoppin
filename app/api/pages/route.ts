import { NextResponse } from "next/server";
import { getPages, savePage } from "@/lib/server-data";
import { isAuthorized, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const pages = await getPages();
  return NextResponse.json({ pages });
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const body = await request.json();
  await savePage(body);
  return NextResponse.json({ ok: true });
}

