import { NextResponse } from "next/server";
import { getFeaturedEssays, saveFeaturedIds } from "@/lib/server-data";

export const runtime = "nodejs";

export async function GET() {
  const essays = await getFeaturedEssays();
  return NextResponse.json({ essays });
}

export async function PUT(request: Request) {
  const body = await request.json();
  await saveFeaturedIds(body.ids || []);
  return NextResponse.json({ ok: true });
}

