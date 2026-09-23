import { NextResponse } from "next/server";
import { listAllEntries } from "@/lib/db";

export async function GET() {
  const entries = await listAllEntries();
  return NextResponse.json({ entries });
}
