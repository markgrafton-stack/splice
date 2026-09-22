import { NextResponse } from "next/server";
import { after } from "next/server";
import { getProject, listEntries, setProjectMontage } from "@/lib/db";
import { processMontage } from "@/lib/processMontage";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const entries = await listEntries(projectId);
  const readyCount = entries.filter((e) => e.status === "ready").length;
  if (readyCount < 2) {
    return NextResponse.json({ error: "Need at least two ready clips to build a montage." }, { status: 409 });
  }

  await setProjectMontage(projectId, { montageStatus: "processing" });
  after(() => processMontage(projectId));

  return NextResponse.json({ ok: true });
}
