import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || session.role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const schools = db.prepare(`
    SELECT s.*, COUNT(u.id) as user_count
    FROM schools s
    LEFT JOIN users u ON u.school_id = s.id
    GROUP BY s.id
    ORDER BY s.name ASC
  `).all();
  return NextResponse.json(schools);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { name, urn, address } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "School name is required" }, { status: 400 });
  }
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO schools (id, name, urn, address, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name.trim(), urn?.trim() || null, address?.trim() || null, now);

  // Auto-create an assessment for this school
  const assessmentId = randomUUID();
  db.prepare(
    "INSERT INTO assessments (id, school_id, school_name, created_at, updated_at, answers) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(assessmentId, id, name.trim(), now, now, "{}");

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await req.json();
  const db = getDb();
  db.prepare("UPDATE users SET school_id = NULL WHERE school_id = ?").run(id);
  db.prepare("DELETE FROM assessments WHERE school_id = ?").run(id);
  db.prepare("DELETE FROM schools WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
