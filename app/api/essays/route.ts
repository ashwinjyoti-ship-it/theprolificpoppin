import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getEssays, saveEssay } from "@/lib/server-data";
import { isAuthorized, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const essays = await getEssays();
  return NextResponse.json({ essays });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const body = await request.json();
  const essay = await saveEssay(body);
  revalidatePath("/");
  revalidatePath("/essays");
  revalidatePath(`/essays/${essay.slug}`);
  return NextResponse.json({ essay });
}

