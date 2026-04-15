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
  const db = getDb();
  const rows = db.prepare("SELECT * FROM contracts WHERE school_id = ? ORDER BY end_date ASC").all(id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Contract name is required" }, { status: 400 });
  const db = getDb();
  const cid = randomUUID();
  db.prepare(`
    INSERT INTO contracts (id, school_id, name, supplier, type, start_date, end_date, value,
      contact_name, contact_email, contact_phone, auto_renew, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cid, id,
    body.name?.trim() ?? null,
    body.supplier?.trim() ?? null,
    body.type?.trim() ?? null,
    body.start_date ?? null,
    body.end_date ?? null,
    body.value?.trim() ?? null,
    body.contact_name?.trim() ?? null,
    body.contact_email?.trim() ?? null,
    body.contact_phone?.trim() ?? null,
    body.auto_renew ? 1 : 0,
    body.notes?.trim() ?? null,
    new Date().toISOString()
  );
  return NextResponse.json({ ok: true, id: cid });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const body = await req.json();
  const { id: cid, ...fields } = body;
  if (!cid) return NextResponse.json({ error: "Contract id required" }, { status: 400 });
  const db = getDb();
  db.prepare(`
    UPDATE contracts SET name=?, supplier=?, type=?, start_date=?, end_date=?, value=?,
      contact_name=?, contact_email=?, contact_phone=?, auto_renew=?, notes=?
    WHERE id=?
  `).run(
    fields.name?.trim() ?? null,
    fields.supplier?.trim() ?? null,
    fields.type?.trim() ?? null,
    fields.start_date ?? null,
    fields.end_date ?? null,
    fields.value?.trim() ?? null,
    fields.contact_name?.trim() ?? null,
    fields.contact_email?.trim() ?? null,
    fields.contact_phone?.trim() ?? null,
    fields.auto_renew ? 1 : 0,
    fields.notes?.trim() ?? null,
    cid
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const { id: cid } = await req.json();
  getDb().prepare("DELETE FROM contracts WHERE id = ?").run(cid);
  return NextResponse.json({ ok: true });
}
