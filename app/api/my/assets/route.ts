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
    .prepare("SELECT * FROM assets WHERE school_id = ? ORDER BY device_type ASC, device_name ASC")
    .all(schoolId);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json();

  // Bulk import: body is an array
  if (Array.isArray(body)) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO assets (id, school_id, device_type, asset_tag, device_name, make, model,
        serial_number, os, purchase_date, warranty_end_date, warranty_type,
        assigned_to, location, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((rows: typeof body) => {
      let count = 0;
      for (const row of rows) {
        if (!row.device_type?.trim()) continue;
        stmt.run(
          randomUUID(), schoolId,
          row.device_type.trim(),
          row.asset_tag?.trim() || null,
          row.device_name?.trim() || null,
          row.make?.trim() || null,
          row.model?.trim() || null,
          row.serial_number?.trim() || null,
          row.os?.trim() || null,
          row.purchase_date || null,
          row.warranty_end_date || null,
          row.warranty_type?.trim() || null,
          row.assigned_to?.trim() || null,
          row.location?.trim() || null,
          row.status?.trim() || "Active",
          row.notes?.trim() || null,
          new Date().toISOString()
        );
        count++;
      }
      return count;
    });
    const imported = insertMany(body);
    return NextResponse.json({ ok: true, imported });
  }

  // Single insert
  if (!body.device_type?.trim())
    return NextResponse.json({ error: "Device type is required" }, { status: 400 });
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO assets (id, school_id, device_type, asset_tag, device_name, make, model,
      serial_number, os, purchase_date, warranty_end_date, warranty_type,
      assigned_to, location, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, schoolId,
    body.device_type.trim(),
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
    body.status?.trim() ?? "Active",
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
  if (!id) return NextResponse.json({ error: "Asset id required" }, { status: 400 });
  const existing = getDb().prepare("SELECT id FROM assets WHERE id = ? AND school_id = ?").get(id, schoolId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  getDb().prepare(`
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
    fields.status?.trim() ?? "Active",
    fields.notes?.trim() ?? null,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await req.json();
  getDb().prepare("DELETE FROM assets WHERE id = ? AND school_id = ?").run(id, schoolId);
  return NextResponse.json({ ok: true });
}
