import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getProject, insertEntry, touchProject } from "@/lib/db";
import { detectPlatform } from "@/lib/ytdlp";
import { resolveEntry } from "@/lib/processEntry";
import { DEFAULT_SNIPPET_LENGTH, SNIPPET_LENGTH_OPTIONS } from "@/lib/snippet";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const snippetLengthSeconds = SNIPPET_LENGTH_OPTIONS.includes(body?.snippetLengthSeconds)
    ? body.snippetLengthSeconds
    : DEFAULT_SNIPPET_LENGTH;

  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "That doesn't look like a YouTube or Vimeo link." },
      { status: 400 }
    );
  }

  const entry = await insertEntry({ projectId, sourceUrl: url, platform, snippetLengthSeconds });
  await touchProject(projectId);

  after(() => resolveEntry(entry.id));

  return NextResponse.json({ entry }, { status: 201 });
}
