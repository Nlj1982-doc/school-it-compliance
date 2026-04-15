import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function getSchoolId(): Promise<string | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return session.schoolId ?? null;
}

export async function GET() {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const rows = getDb()
    .prepare("SELECT * FROM contracts WHERE school_id = ? ORDER BY end_date ASC, name ASC")
    .all(schoolId);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Contract name is required" }, { status: 400 });
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO contracts (id, school_id, name, supplier, type, start_date, end_date,
      value, contact_name, contact_email, contact_phone, auto_renew, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, schoolId,
    body.name.trim(),
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
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "Contract id required" }, { status: 400 });
  // Ensure the contract belongs to this school
  const existing = getDb().prepare("SELECT id FROM contracts WHERE id = ? AND school_id = ?").get(id, schoolId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  getDb().prepare(`
    UPDATE contracts SET name=?, supplier=?, type=?, start_date=?, end_date=?,
      value=?, contact_name=?, contact_email=?, contact_phone=?, auto_renew=?, notes=?
    WHERE id=?
  `).run(
    fields.name?.trim(),
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
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await req.json();
  getDb().prepare("DELETE FROM contracts WHERE id = ? AND school_id = ?").run(id, schoolId);
  return NextResponse.json({ ok: true });
}
