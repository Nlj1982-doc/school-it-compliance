import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || session.role !== "admin") {
    return null;
  }
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const users = db
    .prepare("SELECT id, username, role, school_name, created_at FROM users ORDER BY created_at DESC")
    .all();
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { username, password, role, school_name } = await req.json();
  if (!username?.trim() || !password || !role) {
    return NextResponse.json({ error: "Username, password and role are required" }, { status: 400 });
  }
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username.trim().toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }
  const hash = bcrypt.hashSync(password, 10);
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users (id, username, password_hash, role, school_name, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, username.trim().toLowerCase(), hash, role, school_name ?? null, new Date().toISOString());
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await req.json();
  if (id === session.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
