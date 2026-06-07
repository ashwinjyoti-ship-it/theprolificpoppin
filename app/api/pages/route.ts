import { NextResponse } from "next/server";
import { getPages, savePage } from "@/lib/server-data";

export const runtime = "nodejs";

export async function GET() {
  const pages = await getPages();
  return NextResponse.json({ pages });
}

export async function PUT(request: Request) {
  const body = await request.json();
  await savePage(body);
  return NextResponse.json({ ok: true });
}

