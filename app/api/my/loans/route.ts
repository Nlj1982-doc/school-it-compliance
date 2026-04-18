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
    .prepare("SELECT * FROM equipment_loans WHERE school_id = ? ORDER BY date_out DESC")
    .all(schoolId);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json();
  if (!body.borrower_name?.trim()) return NextResponse.json({ error: "Borrower name is required" }, { status: 400 });
  if (!body.equipment?.trim()) return NextResponse.json({ error: "Equipment description is required" }, { status: 400 });
  if (!body.date_out) return NextResponse.json({ error: "Loan date is required" }, { status: 400 });
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO equipment_loans (id, school_id, borrower_name, borrower_type, borrower_group, equipment, asset_tag, date_out, date_due, date_returned, condition_out, condition_in, authorised_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, schoolId,
    body.borrower_name.trim(), body.borrower_type?.trim() ?? "Student",
    body.borrower_group?.trim() ?? null, body.equipment.trim(),
    body.asset_tag?.trim() ?? null, body.date_out,
    body.date_due ?? null, body.date_returned ?? null,
    body.condition_out?.trim() ?? null, body.condition_in?.trim() ?? null,
    body.authorised_by?.trim() ?? null, body.notes?.trim() ?? null,
    new Date().toISOString()
  );
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json();
  const { id, ...f } = body;
  if (!id) return NextResponse.json({ error: "Loan id required" }, { status: 400 });
  const existing = getDb().prepare("SELECT id FROM equipment_loans WHERE id = ? AND school_id = ?").get(id, schoolId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  getDb().prepare(`
    UPDATE equipment_loans SET borrower_name=?, borrower_type=?, borrower_group=?, equipment=?, asset_tag=?, date_out=?, date_due=?, date_returned=?, condition_out=?, condition_in=?, authorised_by=?, notes=?
    WHERE id=?
  `).run(
    f.borrower_name?.trim(), f.borrower_type?.trim() ?? "Student",
    f.borrower_group?.trim() ?? null, f.equipment?.trim(),
    f.asset_tag?.trim() ?? null, f.date_out,
    f.date_due ?? null, f.date_returned ?? null,
    f.condition_out?.trim() ?? null, f.condition_in?.trim() ?? null,
    f.authorised_by?.trim() ?? null, f.notes?.trim() ?? null, id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await req.json();
  getDb().prepare("DELETE FROM equipment_loans WHERE id = ? AND school_id = ?").run(id, schoolId);
  return NextResponse.json({ ok: true });
}
