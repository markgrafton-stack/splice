import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const clientTag = typeof body?.clientTag === "string" && body.clientTag.trim() ? body.clientTag.trim() : null;
  if (!name) {
    return NextResponse.json({ error: "A project name is required." }, { status: 400 });
  }
  const project = await createProject(name, clientTag);
  return NextResponse.json({ project }, { status: 201 });
}
