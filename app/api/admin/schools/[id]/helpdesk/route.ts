import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getSession();
  return session.userId && session.role === "admin" ? session : null;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const rows = getDb()
    .prepare("SELECT * FROM helpdesk_tickets WHERE school_id = ? ORDER BY created_at DESC")
    .all(id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const now = new Date().toISOString();
  const tid = randomUUID();
  getDb().prepare(`
    INSERT INTO helpdesk_tickets (id, school_id, created_by, title, description, category, priority, status, assigned_to, resolution, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tid, id, session.username, body.title.trim(), body.description?.trim() ?? null,
    body.category?.trim() ?? null, body.priority?.trim() ?? "Normal",
    body.status?.trim() ?? "Open", body.assigned_to?.trim() ?? null,
    body.resolution?.trim() ?? null, now, now);
  return NextResponse.json({ ok: true, id: tid });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const body = await req.json();
  const { id, ...f } = body;
  if (!id) return NextResponse.json({ error: "Ticket id required" }, { status: 400 });
  getDb().prepare(`
    UPDATE helpdesk_tickets SET title=?, description=?, category=?, priority=?, status=?, assigned_to=?, resolution=?, updated_at=?
    WHERE id=?
  `).run(f.title?.trim(), f.description?.trim() ?? null, f.category?.trim() ?? null,
    f.priority?.trim() ?? "Normal", f.status?.trim() ?? "Open",
    f.assigned_to?.trim() ?? null, f.resolution?.trim() ?? null,
    new Date().toISOString(), id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const { id } = await req.json();
  getDb().prepare("DELETE FROM helpdesk_tickets WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
