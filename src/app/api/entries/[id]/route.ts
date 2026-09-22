import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { deleteFile } from "@/lib/blob";
import { getEntry, deleteEntry, touchProject } from "@/lib/db";
import { regenerateEntrySnippet } from "@/lib/processEntry";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  if (entry.durationSeconds == null) {
    return NextResponse.json({ error: "This entry hasn't resolved yet — try again once it's ready." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const startOverride = typeof body?.startSeconds === "number" ? body.startSeconds : null;
  if (startOverride == null || !Number.isFinite(startOverride) || startOverride < 0) {
    return NextResponse.json({ error: "startSeconds must be a non-negative number." }, { status: 400 });
  }

  after(() => regenerateEntrySnippet(id, startOverride));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  if (entry.clipUrl) await deleteFile(entry.clipUrl).catch(() => {});
  if (entry.gifUrl) await deleteFile(entry.gifUrl).catch(() => {});
  await deleteEntry(id);
  await touchProject(entry.projectId);

  return NextResponse.json({ ok: true });
}
