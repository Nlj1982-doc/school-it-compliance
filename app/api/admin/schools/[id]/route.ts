import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || session.role !== "admin") return null;
  return session;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const db = getDb();
  const school = db.prepare("SELECT * FROM schools WHERE id = ?").get(id);
  if (!school) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(school);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const fields = [
    "name", "urn",
    "address_line1", "address_line2", "city", "postcode", "phone", "website",
    "ht_name", "ht_email", "ht_phone",
    "dsl_name", "dsl_email", "dsl_phone",
    "tech_name", "tech_email", "tech_phone",
    "msp_name", "msp_contact", "msp_email", "msp_phone", "msp_contract_expiry",
  ];

  const setClauses = fields.map(f => `${f} = ?`).join(", ");
  const values = fields.map(f => body[f] ?? null);

  const db = getDb();

  // Keep school_name in sync on assessments if name changed
  if (body.name) {
    db.prepare("UPDATE assessments SET school_name = ? WHERE school_id = ?").run(body.name, id);
  }

  const result = db.prepare(`UPDATE schools SET ${setClauses} WHERE id = ?`).run(...values, id);
  if (result.changes === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
