import { NextRequest, NextResponse } from "next/server";
import { deleteFile } from "@/lib/blob";
import { getProject, listEntries, deleteProject, updateProject } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const entries = await listEntries(id);
  return NextResponse.json({ project, entries });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const fields: Parameters<typeof updateProject>[1] = {};

  if (body && "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Board name can't be empty." }, { status: 400 });
    fields.name = name;
  }
  if (body && "clientTag" in body) {
    fields.clientTag = typeof body.clientTag === "string" && body.clientTag.trim() ? body.clientTag.trim() : null;
  }
  if (body && "description" in body) {
    fields.description =
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await updateProject(id, fields);
  const updated = await getProject(id);
  return NextResponse.json({ project: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (project.montageGifUrl) await deleteFile(project.montageGifUrl).catch(() => {});
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
