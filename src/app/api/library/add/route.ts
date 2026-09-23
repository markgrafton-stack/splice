import { NextRequest, NextResponse } from "next/server";
import { getEntry, getProject, entryExistsInProject, insertResolvedEntry, touchProject } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const sourceEntryId = typeof body?.sourceEntryId === "string" ? body.sourceEntryId : "";
  const targetProjectId = typeof body?.targetProjectId === "string" ? body.targetProjectId : "";
  if (!sourceEntryId || !targetProjectId) {
    return NextResponse.json({ error: "sourceEntryId and targetProjectId are required." }, { status: 400 });
  }

  const source = await getEntry(sourceEntryId);
  if (!source || source.status !== "ready") {
    return NextResponse.json({ error: "That reference isn't available to copy." }, { status: 404 });
  }

  const targetProject = await getProject(targetProjectId);
  if (!targetProject) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }

  if (await entryExistsInProject(targetProjectId, source.sourceUrl)) {
    return NextResponse.json({ error: "Already on that board." }, { status: 409 });
  }

  const entry = await insertResolvedEntry({
    projectId: targetProjectId,
    sourceUrl: source.sourceUrl,
    platform: source.platform,
    title: source.title,
    thumbnailUrl: source.thumbnailUrl,
    durationSeconds: source.durationSeconds,
    snippetStartSeconds: source.snippetStartSeconds,
    snippetLengthSeconds: source.snippetLengthSeconds,
  });
  await touchProject(targetProjectId);

  return NextResponse.json({ entry }, { status: 201 });
}
