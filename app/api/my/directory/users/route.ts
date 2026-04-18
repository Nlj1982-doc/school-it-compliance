import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.schoolId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const rows = getDb()
    .prepare(
      "SELECT id, provider, external_id, display_name, email, role, department, job_title, ou_path, synced_at FROM directory_users WHERE school_id = ? ORDER BY role, display_name"
    )
    .all(session.schoolId);
  return NextResponse.json(rows);
}
