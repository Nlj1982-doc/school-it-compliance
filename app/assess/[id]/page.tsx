"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  frameworks,
  getTotalQuestions,
  getFrameworkScore,
  type QuestionStatus,
  type Framework,
} from "@/lib/frameworks";
import { AUTO_EVIDENCE_QUESTIONS } from "@/lib/evidence-gather";

const RAG_COLOURS = {
  green: "bg-green-100 text-green-800 border-green-200",
  amber: "bg-yellow-100 text-yellow-800 border-yellow-200",
  red: "bg-red-100 text-red-800 border-red-200",
};

const ANSWER_OPTIONS: { value: QuestionStatus; label: string; colour: string }[] = [
  { value: "yes", label: "Yes", colour: "bg-green-500 text-white border-green-500" },
  { value: "partial", label: "Partial", colour: "bg-yellow-400 text-white border-yellow-400" },
  { value: "no", label: "No", colour: "bg-red-500 text-white border-red-500" },
  { value: "na", label: "N/A", colour: "bg-gray-400 text-white border-gray-400" },
];

interface EvidenceRow {
  question_id: string;
  notes: string | null;
  auto_evidence: string | null; // JSON string of EvidenceFact[]
  reviewed_at: string | null;
  review_due: string | null;
}

export default function AssessPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [answers, setAnswers] = useState<Record<string, QuestionStatus>>({});
  const [activeFramework, setActiveFramework] = useState<string>(frameworks[0].id);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Evidence state
  const [evidence, setEvidence] = useState<Record<string, EvidenceRow>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [gatheringEvidence, setGatheringEvidence] = useState<Record<string, boolean>>({});
  const [savingEvidence, setSavingEvidence] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/assessments/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSchoolName(data.school_name);
        setAnswers(JSON.parse(data.answers || "{}"));
      });

    fetch(`/api/assessments/${id}/evidence`)
      .then(r => r.json())
      .then((rows: EvidenceRow[]) => {
        const map: Record<string, EvidenceRow> = {};
        for (const row of rows) map[row.question_id] = row;
        setEvidence(map);
      });
  }, [id]);

  const saveAnswers = useCallback(
    async (updatedAnswers: Record<string, QuestionStatus>) => {
      setSaving(true);
      await fetch(`/api/assessments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: updatedAnswers }),
      });
      setSaving(false);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    },
    [id]
  );

  function handleAnswer(questionId: string, value: QuestionStatus) {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);
    saveAnswers(updated);
  }

  async function saveEvidence(questionId: string, patch: Partial<EvidenceRow>) {
    setSavingEvidence(s => ({ ...s, [questionId]: true }));
    await fetch(`/api/assessments/${id}/evidence`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, ...patch }),
    });
    setEvidence(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] ?? { question_id: questionId, notes: null, auto_evidence: null, reviewed_at: null, review_due: null }),
        ...patch,
      },
    }));
    setSavingEvidence(s => ({ ...s, [questionId]: false }));
  }

  async function gatherEvidenceForQuestion(questionId: string) {
    setGatheringEvidence(s => ({ ...s, [questionId]: true }));
    const res = await fetch(`/api/assessments/${id}/evidence/gather`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    });
    const data = await res.json() as { ok?: boolean; facts?: unknown[] };
    if (res.ok) {
      setEvidence(prev => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] ?? { question_id: questionId, notes: null, reviewed_at: null, review_due: null }),
          auto_evidence: JSON.stringify(data.facts),
        },
      }));
    }
    setGatheringEvidence(s => ({ ...s, [questionId]: false }));
  }

  // Helper functions
  function hasAnyEvidence(qId: string) {
    const e = evidence[qId];
    return e && (e.notes || e.auto_evidence || e.reviewed_at);
  }

  function hasReviewDue(qId: string) {
    return !!evidence[qId]?.review_due;
  }

  function isOverdue(qId: string) {
    const due = evidence[qId]?.review_due;
    return due ? new Date(due) < new Date() : false;
  }

  const totalQuestions = getTotalQuestions();
  const totalAnswered = Object.values(answers).filter((v) => v !== null).length;
  const progress = Math.round((totalAnswered / totalQuestions) * 100);

  const activeF = frameworks.find((f) => f.id === activeFramework) as Framework;
  const activeScore = getFrameworkScore(activeFramework, answers);

  // Total overdue across all frameworks
  const totalOverdue = Object.values(evidence).filter(
    e => e.review_due && new Date(e.review_due) < new Date()
  ).length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-800 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/compliance")} className="text-blue-200 text-sm hover:text-white mb-1">
              ← Compliance
            </button>
            <div className="flex items-baseline gap-2">
              <h1 className="font-bold text-lg">{schoolName}</h1>
              <span className="text-blue-300 text-xs">School IT Manager</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <div className="text-sm text-blue-200">Overall Progress</div>
                {totalOverdue > 0 && (
                  <div className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                    {totalOverdue} review{totalOverdue !== 1 ? "s" : ""} overdue
                  </div>
                )}
              </div>
              <div className="font-bold">{totalAnswered}/{totalQuestions} ({progress}%)</div>
            </div>
            <button
              onClick={() => router.push(`/report/${id}`)}
              className="bg-white text-blue-800 px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors"
            >
              View Report
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-5xl mx-auto mt-2">
          <div className="h-1.5 bg-blue-600 rounded-full">
            <div
              className="h-1.5 bg-white rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar — framework list */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden sticky top-24">
            <div className="p-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Frameworks
            </div>
            {frameworks.map((f) => {
              const score = getFrameworkScore(f.id, answers);
              const questionsInFramework = f.sections.reduce((a, s) => a + s.questions.length, 0);
              const answeredInFramework = f.sections
                .flatMap((s) => s.questions)
                .filter((q) => answers[q.id] !== undefined && answers[q.id] !== null).length;

              // Count overdue reviews in this framework
              const overdueInFramework = f.sections.flatMap(s => s.questions).filter(q => {
                const due = evidence[q.id]?.review_due;
                return due && new Date(due) < new Date();
              }).length;

              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFramework(f.id)}
                  className={`w-full text-left px-3 py-3 border-b last:border-b-0 transition-colors ${
                    activeFramework === f.id
                      ? "bg-blue-50 border-l-4 border-l-blue-600"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="text-sm font-medium text-gray-800">{f.shortTitle}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {answeredInFramework}/{questionsInFramework}
                  </div>
                  {score && answeredInFramework > 0 && (
                    <div
                      className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-block font-medium ${
                        score.rag === "green"
                          ? "bg-green-100 text-green-700"
                          : score.rag === "amber"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {score.percentage}%
                    </div>
                  )}
                  {overdueInFramework > 0 && (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      {overdueInFramework} review{overdueInFramework !== 1 ? "s" : ""} overdue
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Framework header */}
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-4">
            <h2 className="text-lg font-bold text-gray-900">{activeF.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{activeF.description}</p>
            {activeScore && (
              <div className="flex items-center gap-4 mt-3">
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${RAG_COLOURS[activeScore.rag]}`}
                >
                  {activeScore.rag === "green"
                    ? "Compliant"
                    : activeScore.rag === "amber"
                    ? "Partially Compliant"
                    : "Non-Compliant"}{" "}
                  — {activeScore.percentage}%
                </div>
                <span className="text-sm text-gray-500">
                  {activeScore.yes} Yes · {activeScore.partial} Partial · {activeScore.no} No
                </span>
              </div>
            )}
          </div>

          {/* Sections and questions */}
          {activeF.sections.map((section) => (
            <div key={section.id} className="bg-white rounded-xl shadow-sm border mb-4 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-700">{section.title}</h3>
              </div>
              <div className="divide-y">
                {section.questions.map((q) => {
                  const answer = answers[q.id] ?? null;
                  return (
                    <div key={q.id} className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <span
                          className={`mt-0.5 text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                            q.priority === "critical"
                              ? "bg-red-100 text-red-700"
                              : q.priority === "high"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {q.priority}
                        </span>
                        <p className="text-gray-800 font-medium text-sm leading-relaxed">{q.text}</p>
                      </div>
                      <p className="text-xs text-gray-500 mb-3 ml-0 leading-relaxed bg-gray-50 p-2 rounded">
                        {q.guidance}
                      </p>
                      <div className="flex gap-2">
                        {ANSWER_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() =>
                              handleAnswer(q.id, answer === opt.value ? null : opt.value)
                            }
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                              answer === opt.value
                                ? opt.colour
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Evidence toggle button */}
                      <button
                        onClick={() => setExpandedEvidence(e => ({ ...e, [q.id]: !e[q.id] }))}
                        className={`mt-3 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                          hasAnyEvidence(q.id)
                            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {expandedEvidence[q.id] ? "▲" : "▼"} Evidence & Review
                        {hasReviewDue(q.id) && (
                          <span
                            className={`ml-1 w-2 h-2 rounded-full ${
                              isOverdue(q.id) ? "bg-red-500" : "bg-amber-400"
                            }`}
                          />
                        )}
                      </button>

                      {/* Expanded evidence panel */}
                      {expandedEvidence[q.id] && (
                        <div className="mt-3 border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">

                          {/* Auto-evidence section */}
                          {AUTO_EVIDENCE_QUESTIONS[q.id] && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  {AUTO_EVIDENCE_QUESTIONS[q.id].needsLiveApi ? "🔄 Live Data" : "📊 Directory Data"}
                                </span>
                                <button
                                  onClick={() => gatherEvidenceForQuestion(q.id)}
                                  disabled={gatheringEvidence[q.id]}
                                  className="text-xs px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                                >
                                  {gatheringEvidence[q.id]
                                    ? "Gathering…"
                                    : AUTO_EVIDENCE_QUESTIONS[q.id].needsLiveApi
                                    ? "↻ Fetch Live Data"
                                    : "↻ Gather from Directory"}
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mb-2">
                                {AUTO_EVIDENCE_QUESTIONS[q.id].label}
                              </p>
                              {evidence[q.id]?.auto_evidence ? (
                                <div className="space-y-2">
                                  {(() => {
                                    try {
                                      const parsed = JSON.parse(evidence[q.id].auto_evidence!) as Array<{
                                        source: string;
                                        gathered_at: string;
                                        facts: string[];
                                      }>;
                                      return parsed.map((ef, i) => (
                                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                              {ef.source}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                              {new Date(ef.gathered_at).toLocaleString("en-GB")}
                                            </span>
                                          </div>
                                          <ul className="space-y-0.5">
                                            {ef.facts.map((f, j) => (
                                              <li key={j} className="text-xs text-gray-700 flex gap-1.5">
                                                <span className="text-gray-400 flex-shrink-0">•</span>
                                                {f}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ));
                                    } catch {
                                      return (
                                        <p className="text-xs text-red-500 italic">
                                          Could not parse stored evidence data.
                                        </p>
                                      );
                                    }
                                  })()}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No data gathered yet. Click the button above to gather evidence.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Manual notes */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                              Evidence Notes
                            </label>
                            <textarea
                              rows={3}
                              defaultValue={evidence[q.id]?.notes ?? ""}
                              onBlur={e => {
                                if (e.target.value !== (evidence[q.id]?.notes ?? "")) {
                                  saveEvidence(q.id, { notes: e.target.value || null });
                                }
                              }}
                              placeholder="Add evidence, document references, policy links, or notes…"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                            />
                          </div>

                          {/* Review dates */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                Last Reviewed
                              </label>
                              <input
                                type="date"
                                defaultValue={evidence[q.id]?.reviewed_at?.slice(0, 10) ?? ""}
                                onBlur={e => saveEvidence(q.id, { reviewed_at: e.target.value || null })}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                Next Review Due
                                {isOverdue(q.id) && (
                                  <span className="ml-1 text-red-600 font-bold">OVERDUE</span>
                                )}
                              </label>
                              <input
                                type="date"
                                defaultValue={evidence[q.id]?.review_due?.slice(0, 10) ?? ""}
                                onBlur={e => saveEvidence(q.id, { review_due: e.target.value || null })}
                                className={`w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                                  isOverdue(q.id) ? "border-red-300" : "border-gray-200"
                                }`}
                              />
                            </div>
                          </div>
                          {savingEvidence[q.id] && (
                            <p className="text-xs text-gray-400">Saving…</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Save indicator */}
          <div className="text-center py-2 text-sm text-gray-400">
            {saving ? "Saving..." : saveMsg ? "✓ Saved" : "Progress saves automatically"}
          </div>
        </div>
      </div>
    </main>
  );
}
