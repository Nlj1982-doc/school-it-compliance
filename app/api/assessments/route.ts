import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  const db = getDb();

  // Admins see all assessments; school users only see their school's
  let rows: unknown[];
  if (session.role === "admin") {
    rows = db.prepare("SELECT * FROM assessments ORDER BY updated_at DESC").all();
  } else if (session.schoolId) {
    rows = db.prepare(
      "SELECT * FROM assessments WHERE school_id = ? ORDER BY updated_at DESC"
    ).all(session.schoolId);
  } else {
    rows = [];
  }

  return NextResponse.json(rows);
}
