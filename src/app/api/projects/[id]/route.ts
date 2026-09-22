import { NextResponse } from "next/server";
import { deleteFile } from "@/lib/blob";
import { getProject, listEntries, deleteProject } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const entries = await listEntries(id);
  return NextResponse.json({ project, entries });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (project.montageGifUrl) await deleteFile(project.montageGifUrl).catch(() => {});
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
