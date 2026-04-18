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
    .prepare("SELECT * FROM equipment_loans WHERE school_id = ? ORDER BY date_out DESC")
    .all(id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  if (!body.borrower_name?.trim()) return NextResponse.json({ error: "Borrower name is required" }, { status: 400 });
  if (!body.equipment?.trim()) return NextResponse.json({ error: "Equipment description is required" }, { status: 400 });
  if (!body.date_out) return NextResponse.json({ error: "Loan date is required" }, { status: 400 });
  const lid = randomUUID();
  getDb().prepare(`
    INSERT INTO equipment_loans (id, school_id, pool_item_id, borrower_name, borrower_type, borrower_group, equipment, asset_tag, date_out, date_due, date_returned, condition_out, condition_in, authorised_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lid, id, body.pool_item_id ?? null, body.borrower_name.trim(), body.borrower_type?.trim() ?? "Student",
    body.borrower_group?.trim() ?? null, body.equipment.trim(),
    body.asset_tag?.trim() ?? null, body.date_out, body.date_due ?? null,
    body.date_returned ?? null, body.condition_out?.trim() ?? null,
    body.condition_in?.trim() ?? null, body.authorised_by?.trim() ?? null,
    body.notes?.trim() ?? null, new Date().toISOString());
  return NextResponse.json({ ok: true, id: lid });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const body = await req.json();
  const { id, ...f } = body;
  if (!id) return NextResponse.json({ error: "Loan id required" }, { status: 400 });
  getDb().prepare(`
    UPDATE equipment_loans SET borrower_name=?, borrower_type=?, borrower_group=?, equipment=?, asset_tag=?, date_out=?, date_due=?, date_returned=?, condition_out=?, condition_in=?, authorised_by=?, notes=?
    WHERE id=?
  `).run(f.borrower_name?.trim(), f.borrower_type?.trim() ?? "Student",
    f.borrower_group?.trim() ?? null, f.equipment?.trim(),
    f.asset_tag?.trim() ?? null, f.date_out, f.date_due ?? null,
    f.date_returned ?? null, f.condition_out?.trim() ?? null,
    f.condition_in?.trim() ?? null, f.authorised_by?.trim() ?? null,
    f.notes?.trim() ?? null, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await params;
  const { id } = await req.json();
  getDb().prepare("DELETE FROM equipment_loans WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
