import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function requireSchool() {
  const session = await getSession();
  if (!session.userId || !session.schoolId) return null;
  return session.schoolId;
}

// GET — return all connections for this school (never expose config/credentials)
export async function GET() {
  const schoolId = await requireSchool();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows = getDb()
    .prepare(
      "SELECT id, provider, label, last_polled, last_error, created_at FROM netmgmt_connections WHERE school_id = ? ORDER BY created_at DESC"
    )
    .all(schoolId);
  return NextResponse.json(rows);
}

// POST — create a new network management connection
export async function POST(req: NextRequest) {
  const schoolId = await requireSchool();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json()) as { provider?: string; label?: string; config?: unknown };
  const { provider, label, config } = body;
  if (!provider || !label || !config) {
    return NextResponse.json({ error: "provider, label, and config are required" }, { status: 400 });
  }

  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO netmgmt_connections (id, school_id, provider, label, config, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, schoolId, provider, label, JSON.stringify(config), new Date().toISOString());

  return NextResponse.json({ ok: true, id });
}

// DELETE — remove a connection and all its devices
export async function DELETE(req: NextRequest) {
  const schoolId = await requireSchool();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  getDb().prepare("DELETE FROM netmgmt_devices WHERE connection_id = ? AND school_id = ?").run(body.id, schoolId);
  getDb().prepare("DELETE FROM netmgmt_connections WHERE id = ? AND school_id = ?").run(body.id, schoolId);

  return NextResponse.json({ ok: true });
}
