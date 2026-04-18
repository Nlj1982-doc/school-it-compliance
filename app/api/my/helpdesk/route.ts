import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function getAuthed() {
  const session = await getSession();
  if (!session.userId || !session.schoolId) return null;
  return session;
}

function canManage(session: NonNullable<Awaited<ReturnType<typeof getAuthed>>>) {
  return session.role === "admin" || !!session.canHelpdesk;
}

export async function GET() {
  const session = await getAuthed();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const db = getDb();
  const rows = canManage(session)
    ? db.prepare("SELECT * FROM helpdesk_tickets WHERE school_id = ? ORDER BY created_at DESC").all(session.schoolId)
    : db.prepare("SELECT * FROM helpdesk_tickets WHERE school_id = ? AND created_by = ? ORDER BY created_at DESC").all(session.schoolId, session.username);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getAuthed();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const now = new Date().toISOString();
  const id = randomUUID();
  const manage = canManage(session);
  getDb().prepare(`
    INSERT INTO helpdesk_tickets (id, school_id, created_by, title, description, category, priority, status, assigned_to, resolution, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, session.schoolId, session.username,
    body.title.trim(), body.description?.trim() ?? null,
    body.category?.trim() ?? null, body.priority?.trim() ?? "Normal",
    manage ? (body.status?.trim() ?? "Open") : "Open",
    manage ? (body.assigned_to?.trim() ?? null) : null,
    manage ? (body.resolution?.trim() ?? null) : null,
    now, now
  );
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthed();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { id, ...f } = body;
  if (!id) return NextResponse.json({ error: "Ticket id required" }, { status: 400 });
  const existing = getDb().prepare("SELECT id FROM helpdesk_tickets WHERE id = ? AND school_id = ?").get(id, session.schoolId);
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
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Ticket id required" }, { status: 400 });
  if (canManage(session)) {
    getDb().prepare("DELETE FROM helpdesk_tickets WHERE id = ? AND school_id = ?").run(id, session.schoolId);
  } else {
    // Regular users can only delete their own tickets
    getDb().prepare("DELETE FROM helpdesk_tickets WHERE id = ? AND school_id = ? AND created_by = ?").run(id, session.schoolId, session.username);
  }
  return NextResponse.json({ ok: true });
}
