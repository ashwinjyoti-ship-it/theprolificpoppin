import { NextResponse } from "next/server";
import { deleteEssay, getEssays, saveEssay } from "@/lib/server-data";
import { isAuthorized, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthorized(request)) return unauthorized();
  const { id } = params;
  const essay = (await getEssays()).find(item => item.id === Number(id));
  if (!essay) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ essay });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthorized(request)) return unauthorized();
  const { id } = params;
  const body = await request.json();
  const essay = await saveEssay({ ...body, id: Number(id) });
  return NextResponse.json({ essay });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthorized(request)) return unauthorized();
  const { id } = params;
  await deleteEssay(Number(id));
  return NextResponse.json({ ok: true });
}
