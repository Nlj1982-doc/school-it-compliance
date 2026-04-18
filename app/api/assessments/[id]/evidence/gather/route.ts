import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { AUTO_EVIDENCE_QUESTIONS, gatherEvidence } from "@/lib/evidence-gather";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { questionId?: string };
  const { questionId } = body;

  if (!questionId || !AUTO_EVIDENCE_QUESTIONS[questionId]) {
    return NextResponse.json({ error: "Invalid or unsupported questionId" }, { status: 400 });
  }

  const db = getDb();

  const assessment = db
    .prepare("SELECT school_id FROM assessments WHERE id = ?")
    .get(id) as { school_id: string | null } | undefined;

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  if (!assessment.school_id) {
    return NextResponse.json({ error: "Assessment has no associated school" }, { status: 400 });
  }

  const facts = await gatherEvidence(questionId, assessment.school_id, db);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO assessment_evidence (id, assessment_id, question_id, notes, auto_evidence, reviewed_at, review_due, updated_at)
    VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?)
    ON CONFLICT(assessment_id, question_id) DO UPDATE SET
      auto_evidence = excluded.auto_evidence,
      updated_at = excluded.updated_at
  `).run(randomUUID(), id, questionId, JSON.stringify(facts), now);

  return NextResponse.json({ ok: true, facts });
}
