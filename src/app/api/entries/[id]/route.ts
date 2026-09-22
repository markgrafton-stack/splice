import { NextRequest, NextResponse } from "next/server";
import { getEntry, updateEntry, deleteEntry, touchProject, type Rating } from "@/lib/db";

/**
 * Purely a metadata update — nudging the start offset, rating, or toggling
 * montage selection no longer triggers any download or render (that only
 * happens for selected entries when the montage is generated), so this can
 * just write straight to the DB and return.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const fields: Parameters<typeof updateEntry>[1] = {};

  if (body && "startSeconds" in body) {
    if (entry.durationSeconds == null) {
      return NextResponse.json({ error: "This entry hasn't resolved yet — try again once it's ready." }, { status: 409 });
    }
    const start = body.startSeconds;
    if (typeof start !== "number" || !Number.isFinite(start) || start < 0) {
      return NextResponse.json({ error: "startSeconds must be a non-negative number." }, { status: 400 });
    }
    fields.snippetStartSeconds = Math.min(start, entry.durationSeconds);
  }

  if (body && "rating" in body) {
    const rating = body.rating;
    if (rating !== "up" && rating !== "down" && rating !== null) {
      return NextResponse.json({ error: "rating must be \"up\", \"down\", or null." }, { status: 400 });
    }
    fields.rating = rating as Rating;
  }

  if (body && "selectedForMontage" in body) {
    if (typeof body.selectedForMontage !== "boolean") {
      return NextResponse.json({ error: "selectedForMontage must be a boolean." }, { status: 400 });
    }
    fields.selectedForMontage = body.selectedForMontage;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await updateEntry(id, fields);
  await touchProject(entry.projectId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  await deleteEntry(id);
  await touchProject(entry.projectId);

  return NextResponse.json({ ok: true });
}
