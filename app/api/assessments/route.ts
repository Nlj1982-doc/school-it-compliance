import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM assessments ORDER BY updated_at DESC")
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { school_name } = await req.json();
  if (!school_name?.trim()) {
    return NextResponse.json({ error: "School name is required" }, { status: 400 });
  }
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO assessments (id, school_name, created_at, updated_at, answers) VALUES (?, ?, ?, ?, ?)"
  ).run(id, school_name.trim(), now, now, "{}");
  return NextResponse.json({ id });
}
