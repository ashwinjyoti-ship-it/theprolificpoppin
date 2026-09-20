import { NextResponse } from "next/server";
import { getFeaturedEssays, saveFeaturedIds } from "@/lib/server-data";
import { isAuthorized, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const essays = await getFeaturedEssays();
  return NextResponse.json({ essays });
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const body = await request.json();
  await saveFeaturedIds(body.ids || []);
  return NextResponse.json({ ok: true });
}

