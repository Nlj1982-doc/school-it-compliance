import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { syncBackupProvider, type BackupProvider } from "@/lib/backup-sync";

async function requireSchool() {
  const session = await getSession();
  if (!session.userId || !session.schoolId) return null;
  return session.schoolId;
}

// GET — return all jobs + connections for the school
export async function GET() {
  const schoolId = await requireSchool();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const connections = getDb()
    .prepare(
      "SELECT id, provider, label, last_polled, last_error FROM backup_connections WHERE school_id = ?"
    )
    .all(schoolId);

  const jobs = getDb()
    .prepare(
      `SELECT j.*, c.provider, c.label
       FROM backup_jobs j
       JOIN backup_connections c ON c.id = j.connection_id
       WHERE j.school_id = ?
       ORDER BY j.polled_at DESC`
    )
    .all(schoolId);

  return NextResponse.json({ connections, jobs });
}

// POST — sync a specific connection
export async function POST(req: NextRequest) {
  const schoolId = await requireSchool();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json()) as { connectionId?: string };
  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  const conn = getDb()
    .prepare(
      "SELECT id, provider, config FROM backup_connections WHERE id = ? AND school_id = ?"
    )
    .get(body.connectionId, schoolId) as
    | { id: string; provider: string; config: string }
    | undefined;

  if (!conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  let jobs;
  try {
    const config = JSON.parse(conn.config) as unknown;
    jobs = await syncBackupProvider(conn.provider as BackupProvider, config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    getDb()
      .prepare("UPDATE backup_connections SET last_error = ? WHERE id = ? AND school_id = ?")
      .run(msg, conn.id, schoolId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const now = new Date().toISOString();

  // Delete old jobs for this connection
  getDb()
    .prepare("DELETE FROM backup_jobs WHERE connection_id = ?")
    .run(conn.id);

  // Insert new jobs
  const insert = getDb().prepare(
    `INSERT INTO backup_jobs (id, school_id, connection_id, job_name, job_type, status, started_at, ended_at, size_gb, protected_items, error_message, polled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAll = getDb().transaction(() => {
    for (const job of jobs) {
      insert.run(
        randomUUID(),
        schoolId,
        conn.id,
        job.job_name,
        job.job_type,
        job.status,
        job.started_at,
        job.ended_at,
        job.size_gb,
        job.protected_items,
        job.error_message,
        now
      );
    }
  });
  insertAll();

  // Update connection metadata
  getDb()
    .prepare(
      "UPDATE backup_connections SET last_polled = ?, last_error = NULL WHERE id = ? AND school_id = ?"
    )
    .run(now, conn.id, schoolId);

  return NextResponse.json({ ok: true, count: jobs.length });
}
