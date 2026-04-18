import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { encryptConfig } from "@/lib/config-crypto";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const s = await getSession();
  return s.userId && s.role === "admin" ? s : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: schoolId } = await params;
  const rows = getDb()
    .prepare("SELECT id, provider, user_count, last_synced, last_error, created_at FROM directory_connections WHERE school_id = ?")
    .all(schoolId);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: schoolId } = await params;
  const { provider, config } = await req.json();
  if (!provider || !config) return NextResponse.json({ error: "provider and config required" }, { status: 400 });

  const existing = getDb()
    .prepare("SELECT id FROM directory_connections WHERE school_id = ? AND provider = ?")
    .get(schoolId, provider);
  if (existing) {
    getDb().prepare("UPDATE directory_connections SET config = ?, last_error = NULL WHERE school_id = ? AND provider = ?")
      .run(encryptConfig(config), schoolId, provider);
  } else {
    getDb().prepare("INSERT INTO directory_connections (id, school_id, provider, config, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), schoolId, provider, encryptConfig(config), new Date().toISOString());
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: schoolId } = await params;
  const { provider } = await req.json();
  getDb().prepare("DELETE FROM directory_users WHERE school_id = ? AND provider = ?").run(schoolId, provider);
  getDb().prepare("DELETE FROM directory_connections WHERE school_id = ? AND provider = ?").run(schoolId, provider);
  return NextResponse.json({ ok: true });
}
