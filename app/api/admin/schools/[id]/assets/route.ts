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
  const rows = db.prepare("SELECT * FROM assets WHERE school_id = ? ORDER BY device_type ASC, device_name ASC").all(id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  if (!body.device_type?.trim()) return NextResponse.json({ error: "Device type is required" }, { status: 400 });
  const db = getDb();
  const aid = randomUUID();
  db.prepare(`
    INSERT INTO assets (id, school_id, device_type, asset_tag, device_name, make, model,
      serial_number, os, purchase_date, warranty_end_date, warranty_type,
      assigned_to, location, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    aid, id,
    body.device_type?.trim(),
    body.asset_tag?.trim() ?? null,
    body.device_name?.trim() ?? null,
    body.make?.trim() ?? null,
    body.model?.trim() ?? null,
    body.serial_number?.trim() ?? null,
    body.os?.trim() ?? null,
    body.purchase_date ?? null,
    body.warranty_end_date ?? null,
    body.warranty_type?.trim() ?? null,
    body.assigned_to?.trim() ?? null,
    body.location?.trim() ?? null,
    body.status?.trim() ?? "active",
    body.notes?.trim() ?? null,
    new Date().toISOString()
  );
  return NextResponse.json({ ok: true, id: aid });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const body = await req.json();
  const { id: aid, ...fields } = body;
  if (!aid) return NextResponse.json({ error: "Asset id required" }, { status: 400 });
  const db = getDb();
  db.prepare(`
    UPDATE assets SET device_type=?, asset_tag=?, device_name=?, make=?, model=?,
      serial_number=?, os=?, purchase_date=?, warranty_end_date=?, warranty_type=?,
      assigned_to=?, location=?, status=?, notes=?
    WHERE id=?
  `).run(
    fields.device_type?.trim(),
    fields.asset_tag?.trim() ?? null,
    fields.device_name?.trim() ?? null,
    fields.make?.trim() ?? null,
    fields.model?.trim() ?? null,
    fields.serial_number?.trim() ?? null,
    fields.os?.trim() ?? null,
    fields.purchase_date ?? null,
    fields.warranty_end_date ?? null,
    fields.warranty_type?.trim() ?? null,
    fields.assigned_to?.trim() ?? null,
    fields.location?.trim() ?? null,
    fields.status?.trim() ?? "active",
    fields.notes?.trim() ?? null,
    aid
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const { id: aid } = await req.json();
  getDb().prepare("DELETE FROM assets WHERE id = ?").run(aid);
  return NextResponse.json({ ok: true });
}
