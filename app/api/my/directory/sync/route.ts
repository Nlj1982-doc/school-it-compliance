import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  syncMicrosoft,
  syncGoogle,
  roleSummary,
  type MicrosoftConfig,
  type GoogleConfig,
} from "@/lib/directory-sync";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId || !session.schoolId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const schoolId = session.schoolId;

  const { provider } = (await req.json()) as { provider: string };
  if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

  const conn = getDb()
    .prepare("SELECT config FROM directory_connections WHERE school_id = ? AND provider = ?")
    .get(schoolId, provider) as { config: string } | undefined;

  if (!conn) return NextResponse.json({ error: "No connection configured for this provider" }, { status: 404 });

  let users;
  try {
    const config = JSON.parse(conn.config);
    if (provider === "microsoft") {
      users = await syncMicrosoft(config as MicrosoftConfig);
    } else if (provider === "google") {
      users = await syncGoogle(config as GoogleConfig);
    } else {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    getDb()
      .prepare("UPDATE directory_connections SET last_error = ? WHERE school_id = ? AND provider = ?")
      .run(msg, schoolId, provider);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Upsert all users
  const now = new Date().toISOString();
  const upsert = getDb().prepare(`
    INSERT INTO directory_users (id, school_id, provider, external_id, display_name, email, role, department, job_title, ou_path, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(school_id, provider, external_id) DO UPDATE SET
      display_name = excluded.display_name,
      email = excluded.email,
      role = excluded.role,
      department = excluded.department,
      job_title = excluded.job_title,
      ou_path = excluded.ou_path,
      synced_at = excluded.synced_at
  `);

  // Remove users no longer in the directory
  getDb()
    .prepare("DELETE FROM directory_users WHERE school_id = ? AND provider = ? AND synced_at < ?")
    .run(schoolId, provider, now);

  const insertMany = getDb().transaction(() => {
    for (const u of users) {
      upsert.run(
        randomUUID(), schoolId, provider,
        u.external_id, u.display_name, u.email ?? null,
        u.role, u.department ?? null, u.job_title ?? null,
        u.ou_path ?? null, now
      );
    }
  });
  insertMany();

  const summary = roleSummary(users);
  getDb()
    .prepare(
      "UPDATE directory_connections SET user_count = ?, last_synced = ?, last_error = NULL WHERE school_id = ? AND provider = ?"
    )
    .run(summary.total, now, schoolId, provider);

  return NextResponse.json({ ok: true, ...summary });
}
