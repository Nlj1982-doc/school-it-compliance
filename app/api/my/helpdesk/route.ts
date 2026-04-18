import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function getAuthed() {
  const session = await getSession();
  if (!session.userId) return null;
  if (session.role !== "admin" && !session.canHelpdesk) return null;
  return session;
}

export async function GET() {
  const session = await getAuthed();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schoolId = session.schoolId;
  if (!schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });
  const rows = getDb()
    .prepare("SELECT * FROM helpdesk_tickets WHERE school_id = ? ORDER BY created_at DESC")
    .all(schoolId);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getAuthed();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schoolId = session.schoolId;
  if (!schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const now = new Date().toISOString();
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO helpdesk_tickets (id, school_id, created_by, title, description, category, priority, status, assigned_to, resolution, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, schoolId, session.username,
    body.title.trim(), body.description?.trim() ?? null,
    body.category?.trim() ?? null, body.priority?.trim() ?? "Normal",
    body.status?.trim() ?? "Open", body.assigned_to?.trim() ?? null,
    body.resolution?.trim() ?? null, now, now
  );
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthed();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schoolId = session.schoolId;
  if (!schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });
  const body = await req.json();
  const { id, ...f } = body;
  if (!id) return NextResponse.json({ error: "Ticket id required" }, { status: 400 });
  const existing = getDb().prepare("SELECT id FROM helpdesk_tickets WHERE id = ? AND school_id = ?").get(id, schoolId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  getDb().prepare(`
    UPDATE helpdesk_tickets SET title=?, description=?, category=?, priority=?, status=?, assigned_to=?, resolution=?, updated_at=?
    WHERE id=?
  `).run(
    f.title?.trim(), f.description?.trim() ?? null, f.category?.trim() ?? null,
    f.priority?.trim() ?? "Normal", f.status?.trim() ?? "Open",
    f.assigned_to?.trim() ?? null, f.resolution?.trim() ?? null,
    new Date().toISOString(), id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getAuthed();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schoolId = session.schoolId;
  if (!schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });
  const { id } = await req.json();
  getDb().prepare("DELETE FROM helpdesk_tickets WHERE id = ? AND school_id = ?").run(id, schoolId);
  return NextResponse.json({ ok: true });
}
