"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { frameworks, getTotalQuestions, getFrameworkScore } from "@/lib/frameworks";
import type { QuestionStatus } from "@/lib/frameworks";
import NavBar from "@/components/NavBar";

interface Assessment {
  id: string;
  school_id: string | null;
  school_name: string;
  updated_at: string;
  answers: string;
}

interface SessionUser {
  userId: string;
  username: string;
  role: string;
  schoolId: string | null;
  schoolName: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r => r.json()),
      fetch("/api/assessments").then(r => r.json()),
    ]).then(([me, a]) => {
      setUser(me.user);
      setAssessments(Array.isArray(a) ? a : []);
      setFetching(false);
    });
  }, []);

  function getOverallRag(answers: Record<string, QuestionStatus>) {
    const scores = frameworks.map((f) => getFrameworkScore(f.id, answers));
    const valid = scores.filter(Boolean);
    if (!valid.length) return null;
    const avg = valid.reduce((a, s) => a + (s?.percentage ?? 0), 0) / valid.length;
    return avg >= 75 ? "green" : avg >= 50 ? "amber" : "red";
  }

  const totalQuestions = getTotalQuestions();

  // School users go straight to their assessment; this page is mainly a dashboard
  const myAssessment = assessments[0] ?? null;

  if (fetching) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-800 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏫</span>
              <div>
                <h1 className="text-2xl font-bold">UK School IT Compliance</h1>
                {user?.schoolName && <p className="text-blue-200 mt-0.5">{user.schoolName}</p>}
              </div>
            </div>
            <NavBar />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 text-center shadow-sm border">
            <div className="text-2xl font-bold text-blue-800">{frameworks.length}</div>
            <div className="text-sm text-gray-500">Frameworks Covered</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm border">
            <div className="text-2xl font-bold text-blue-800">{totalQuestions}</div>
            <div className="text-sm text-gray-500">Compliance Checks</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm border">
            {myAssessment ? (() => {
              const answers = JSON.parse(myAssessment.answers) as Record<string, QuestionStatus>;
              const answered = Object.values(answers).filter(v => v !== null).length;
              const pct = Math.round((answered / totalQuestions) * 100);
              return <>
                <div className="text-2xl font-bold text-blue-800">{pct}%</div>
                <div className="text-sm text-gray-500">Assessment Complete</div>
              </>;
            })() : <>
              <div className="text-2xl font-bold text-gray-400">0%</div>
              <div className="text-sm text-gray-500">Assessment Complete</div>
            </>}
          </div>
        </div>

        {/* Assessment card */}
        {myAssessment ? (() => {
          const answers = JSON.parse(myAssessment.answers) as Record<string, QuestionStatus>;
          const rag = getOverallRag(answers);
          const answered = Object.values(answers).filter(v => v !== null).length;
          return (
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Your Compliance Assessment</h2>
                {rag && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${rag === "green" ? "bg-green-100 text-green-800" : rag === "amber" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                    {rag === "green" ? "Compliant" : rag === "amber" ? "Needs Work" : "At Risk"}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4">{answered} of {totalQuestions} questions answered · Last updated {new Date(myAssessment.updated_at).toLocaleDateString("en-GB")}</p>
              <div className="h-2 bg-gray-100 rounded-full mb-5">
                <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${Math.round((answered / totalQuestions) * 100)}%` }} />
              </div>
              {/* Per-framework scores */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {frameworks.map(f => {
                  const s = getFrameworkScore(f.id, answers);
                  return (
                    <div key={f.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">{f.shortTitle}</div>
                      {s && s.answered > 0 ? (
                        <div className={`text-sm font-bold ${s.rag === "green" ? "text-green-700" : s.rag === "amber" ? "text-yellow-600" : "text-red-600"}`}>
                          {s.percentage}%
                        </div>
                      ) : <div className="text-sm text-gray-300">Not started</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => router.push(`/assess/${myAssessment.id}`)}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors">
                  {answered === 0 ? "Start Assessment" : "Continue Assessment"}
                </button>
                {answered > 0 && (
                  <button onClick={() => router.push(`/report/${myAssessment.id}`)}
                    className="border border-blue-700 text-blue-700 hover:bg-blue-50 px-5 py-2 rounded-lg font-medium text-sm transition-colors">
                    View Report
                  </button>
                )}
              </div>
            </div>
          );
        })() : (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center mb-8">
            <div className="text-4xl mb-3">📋</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No assessment yet</h2>
            <p className="text-gray-500 text-sm">Your school hasn&apos;t been set up yet. Contact your administrator.</p>
          </div>
        )}

        {/* Frameworks overview */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Frameworks Covered</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {frameworks.map((f) => (
              <div key={f.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-lg mt-0.5">
                  {f.colour === "blue" ? "🔵" : f.colour === "purple" ? "🟣" : f.colour === "green" ? "🟢" : f.colour === "orange" ? "🟠" : f.colour === "red" ? "🔴" : "🟡"}
                </span>
                <div>
                  <div className="font-medium text-gray-800 text-sm">{f.shortTitle}</div>
                  <div className="text-xs text-gray-500">{f.description.slice(0, 80)}...</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
