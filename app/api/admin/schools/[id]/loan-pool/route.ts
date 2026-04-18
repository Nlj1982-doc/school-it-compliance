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
    .prepare("SELECT * FROM loan_pool WHERE school_id = ? ORDER BY device_type, name")
    .all(id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const lid = randomUUID();
  getDb().prepare(`
    INSERT INTO loan_pool (id, school_id, name, device_type, asset_tag, serial_number, make, model, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lid, id, body.name.trim(), body.device_type?.trim() ?? null,
    body.asset_tag?.trim() ?? null, body.serial_number?.trim() ?? null,
    body.make?.trim() ?? null, body.model?.trim() ?? null,
    body.notes?.trim() ?? null, new Date().toISOString());
  return NextResponse.json({ ok: true, id: lid });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const body = await req.json();
  const { id, ...f } = body;
  if (!id) return NextResponse.json({ error: "Item id required" }, { status: 400 });
  getDb().prepare(`
    UPDATE loan_pool SET name=?, device_type=?, asset_tag=?, serial_number=?, make=?, model=?, notes=?
    WHERE id=?
  `).run(f.name?.trim(), f.device_type?.trim() ?? null, f.asset_tag?.trim() ?? null,
    f.serial_number?.trim() ?? null, f.make?.trim() ?? null,
    f.model?.trim() ?? null, f.notes?.trim() ?? null, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const { id } = await req.json();
  const active = getDb().prepare(
    "SELECT id FROM equipment_loans WHERE pool_item_id = ? AND date_returned IS NULL"
  ).get(id);
  if (active) return NextResponse.json({ error: "Cannot delete — item is currently on loan" }, { status: 409 });
  getDb().prepare("DELETE FROM loan_pool WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
