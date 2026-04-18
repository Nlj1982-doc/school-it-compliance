"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserNav from "@/components/UserNav";
import { frameworks, getTotalQuestions, getFrameworkScore, calculateScore } from "@/lib/frameworks";
import type { QuestionStatus } from "@/lib/frameworks";

interface Assessment {
  id: string;
  school_id: string | null;
  school_name: string;
  updated_at: string;
  answers: string;
}

export default function CompliancePage() {
  const router = useRouter();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assessments")
      .then(r => r.json())
      .then(a => {
        setAssessment(Array.isArray(a) ? (a[0] ?? null) : null);
        setLoading(false);
      });
  }, []);

  const totalQuestions = getTotalQuestions();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <UserNav />
        <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <main className="min-h-screen bg-gray-50">
        <UserNav />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No compliance assessment yet</h2>
          <p className="text-gray-500 text-sm">Your school hasn&apos;t been set up with an assessment. Contact your administrator.</p>
        </div>
      </main>
    );
  }

  const answers = JSON.parse(assessment.answers) as Record<string, QuestionStatus>;
  const answered = Object.values(answers).filter(v => v !== null).length;
  const pct = Math.round((answered / totalQuestions) * 100);
  const overall = calculateScore(answers);

  const ragStyles = {
    green: { bar: "bg-green-500", badge: "bg-green-100 text-green-800 border-green-200", label: "Compliant" },
    amber: { bar: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Needs Work" },
    red:   { bar: "bg-red-500",   badge: "bg-red-100   text-red-800   border-red-200",   label: "At Risk"   },
  };
  const rs = ragStyles[overall.rag];

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Overall score card */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">IT Compliance</h2>
              <p className="text-sm text-gray-500">
                {answered} of {totalQuestions} questions answered · Last updated {new Date(assessment.updated_at).toLocaleDateString("en-GB")}
              </p>
            </div>
            {answered > 0 && (
              <span className={`text-sm font-medium px-3 py-1 rounded-full border ${rs.badge}`}>{rs.label}</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${rs.bar}`} style={{ width: `${pct}%` }} />
          </div>

          {/* Score tiles */}
          {answered > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="text-center bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-700">{overall.yes}</div>
                <div className="text-xs text-gray-500">Fully Met</div>
              </div>
              <div className="text-center bg-yellow-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-600">{overall.partial}</div>
                <div className="text-xs text-gray-500">Partially Met</div>
              </div>
              <div className="text-center bg-red-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-600">{overall.no}</div>
                <div className="text-xs text-gray-500">Not Met</div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => router.push(`/assess/${assessment.id}`)}
              className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors">
              {answered === 0 ? "Start Assessment" : "Continue Assessment"}
            </button>
            {answered > 0 && (
              <button onClick={() => router.push(`/report/${assessment.id}`)}
                className="border border-blue-700 text-blue-700 hover:bg-blue-50 px-5 py-2 rounded-lg font-medium text-sm transition-colors">
                View Full Report
              </button>
            )}
          </div>
        </div>

        {/* Per-framework breakdown */}
        {answered > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Framework Scores</h3>
            <div className="space-y-3">
              {frameworks.map(f => {
                const s = getFrameworkScore(f.id, answers);
                const questionsInF = f.sections.flatMap(sec => sec.questions).length;
                const answeredInF = f.sections.flatMap(sec => sec.questions)
                  .filter(q => answers[q.id] !== undefined && answers[q.id] !== null).length;
                return (
                  <div key={f.id} className="flex items-center gap-3">
                    <div className="w-32 flex-shrink-0">
                      <div className="text-sm font-medium text-gray-700">{f.shortTitle}</div>
                      <div className="text-xs text-gray-400">{answeredInF}/{questionsInF} answered</div>
                    </div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      {s && answeredInF > 0 ? (
                        <div className={`h-full rounded-full ${s.rag === "green" ? "bg-green-500" : s.rag === "amber" ? "bg-yellow-400" : "bg-red-500"}`}
                          style={{ width: `${s.percentage}%` }} />
                      ) : <div className="h-full" />}
                    </div>
                    {s && answeredInF > 0 ? (
                      <>
                        <div className="w-10 text-sm font-bold text-right text-gray-700">{s.percentage}%</div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-20 text-center ${
                          s.rag === "green" ? "bg-green-100 text-green-700" : s.rag === "amber" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                        }`}>{s.rag === "green" ? "Compliant" : s.rag === "amber" ? "Partial" : "At Risk"}</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-300 w-32">Not started</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Frameworks overview */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Frameworks Covered</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {frameworks.map(f => (
              <div key={f.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-lg mt-0.5">
                  {f.colour === "blue" ? "🔵" : f.colour === "purple" ? "🟣" : f.colour === "green" ? "🟢" : f.colour === "orange" ? "🟠" : f.colour === "red" ? "🔴" : "🟡"}
                </span>
                <div>
                  <div className="font-medium text-gray-800 text-sm">{f.shortTitle}</div>
                  <div className="text-xs text-gray-500">{f.description.slice(0, 90)}…</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
