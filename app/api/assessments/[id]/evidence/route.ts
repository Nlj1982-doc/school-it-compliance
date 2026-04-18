import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const rows = db
    .prepare(
      "SELECT question_id, notes, auto_evidence, reviewed_at, review_due, updated_at FROM assessment_evidence WHERE assessment_id = ?"
    )
    .all(id);

  return NextResponse.json(rows);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    questionId: string;
    notes?: string | null;
    reviewed_at?: string | null;
    review_due?: string | null;
  };

  const { questionId, notes, reviewed_at, review_due } = body;
  if (!questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO assessment_evidence (id, assessment_id, question_id, notes, auto_evidence, reviewed_at, review_due, updated_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
    ON CONFLICT(assessment_id, question_id) DO UPDATE SET
      notes = COALESCE(excluded.notes, notes),
      reviewed_at = COALESCE(excluded.reviewed_at, reviewed_at),
      review_due = COALESCE(excluded.review_due, review_due),
      updated_at = excluded.updated_at
  `).run(randomUUID(), id, questionId, notes ?? null, reviewed_at ?? null, review_due ?? null, now);

  return NextResponse.json({ ok: true });
}
