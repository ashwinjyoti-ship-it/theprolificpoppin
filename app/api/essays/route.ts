import { NextResponse } from "next/server";
import { getEssays, saveEssay } from "@/lib/server-data";

export const runtime = "nodejs";

export async function GET() {
  const essays = await getEssays();
  return NextResponse.json({ essays });
}

export async function POST(request: Request) {
  const body = await request.json();
  const essay = await saveEssay(body);
  return NextResponse.json({ essay });
}

