import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { encryptConfig } from "@/lib/config-crypto";

async function getSchoolId() {
  const session = await getSession();
  if (!session.userId) return null;
  return session.schoolId ?? null;
}

// GET — return sanitised connection info (never expose credentials)
export async function GET() {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rows = getDb()
    .prepare(
      "SELECT id, provider, user_count, last_synced, last_error, created_at FROM directory_connections WHERE school_id = ?"
    )
    .all(schoolId);
  return NextResponse.json(rows);
}

// POST — create or replace connection credentials
export async function POST(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { provider, config } = body as { provider: string; config: unknown };
  if (!provider || !config) return NextResponse.json({ error: "provider and config required" }, { status: 400 });

  const existing = getDb()
    .prepare("SELECT id FROM directory_connections WHERE school_id = ? AND provider = ?")
    .get(schoolId, provider);

  if (existing) {
    getDb()
      .prepare("UPDATE directory_connections SET config = ?, last_error = NULL WHERE school_id = ? AND provider = ?")
      .run(encryptConfig(config), schoolId, provider);
  } else {
    getDb()
      .prepare(
        "INSERT INTO directory_connections (id, school_id, provider, config, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(randomUUID(), schoolId, provider, encryptConfig(config), new Date().toISOString());
  }
  return NextResponse.json({ ok: true });
}

// DELETE — remove connection + its imported users
export async function DELETE(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { provider } = await req.json();
  getDb().prepare("DELETE FROM directory_users WHERE school_id = ? AND provider = ?").run(schoolId, provider);
  getDb().prepare("DELETE FROM directory_connections WHERE school_id = ? AND provider = ?").run(schoolId, provider);
  return NextResponse.json({ ok: true });
}
