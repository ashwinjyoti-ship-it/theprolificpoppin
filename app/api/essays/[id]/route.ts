import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
  const existing = (await getEssays()).find(item => item.id === Number(id));
  const body = await request.json();
  const essay = await saveEssay({ ...body, id: Number(id) });
  revalidatePath("/");
  revalidatePath("/essays");
  revalidatePath(`/essays/${essay.slug}`);
  if (existing && existing.slug !== essay.slug) {
    revalidatePath(`/essays/${existing.slug}`);
  }
  return NextResponse.json({ essay });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthorized(request)) return unauthorized();
  const { id } = params;
  const existing = (await getEssays()).find(item => item.id === Number(id));
  await deleteEssay(Number(id));
  revalidatePath("/");
  revalidatePath("/essays");
  if (existing) revalidatePath(`/essays/${existing.slug}`);
  return NextResponse.json({ ok: true });
}
