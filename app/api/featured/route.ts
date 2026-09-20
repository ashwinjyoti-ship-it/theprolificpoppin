import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

