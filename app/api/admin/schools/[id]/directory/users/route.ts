import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session.userId || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: schoolId } = await params;
  const rows = getDb()
    .prepare("SELECT id, provider, external_id, display_name, email, role, department, job_title, ou_path, synced_at FROM directory_users WHERE school_id = ? ORDER BY role, display_name")
    .all(schoolId);
  return NextResponse.json(rows);
}
