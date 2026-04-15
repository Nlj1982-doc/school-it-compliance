"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { frameworks, getTotalQuestions, getFrameworkScore } from "@/lib/frameworks";
import type { QuestionStatus } from "@/lib/frameworks";
import NavBar from "@/components/NavBar";

interface Assessment {
  id: string;
  school_name: string;
  created_at: string;
  updated_at: string;
  answers: string;
}

export default function HomePage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch("/api/assessments")
      .then((r) => r.json())
      .then(setAssessments)
      .finally(() => setFetching(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school_name: schoolName }),
    });
    const { id } = await res.json();
    router.push(`/assess/${id}`);
  }

  function getOverallRag(answers: Record<string, QuestionStatus>) {
    const scores = frameworks.map((f) => getFrameworkScore(f.id, answers));
    const valid = scores.filter(Boolean);
    if (!valid.length) return null;
    const avg = valid.reduce((a, s) => a + (s?.percentage ?? 0), 0) / valid.length;
    return avg >= 75 ? "green" : avg >= 50 ? "amber" : "red";
  }

  const totalQuestions = getTotalQuestions();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-800 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🏫</span>
            <h1 className="text-2xl font-bold">UK Primary School IT Compliance Checker</h1>
          </div>
          <p className="text-blue-200 ml-12">
            Self-assessment tool covering all mandatory UK frameworks — KCSiE, DfE Filtering Standards,
            Cyber Essentials, UK GDPR, Online Safety Act 2023, and Ofsted requirements.
          </p>
          <div className="mt-3 ml-12">
            <NavBar />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
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
            <div className="text-2xl font-bold text-green-700">Free</div>
            <div className="text-sm text-gray-500">No Cost, No Login</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Start a New Assessment</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Enter your school name..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Starting..." : "Start Assessment"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Frameworks Included</h2>
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

        {!fetching && assessments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Previous Assessments</h2>
            <div className="space-y-3">
              {assessments.map((a) => {
                const answers = JSON.parse(a.answers) as Record<string, QuestionStatus>;
                const rag = getOverallRag(answers);
                const answered = Object.values(answers).filter((v) => v !== null).length;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/assess/${a.id}`)}
                  >
                    <div>
                      <div className="font-medium text-gray-800">{a.school_name}</div>
                      <div className="text-sm text-gray-500">
                        Last updated: {new Date(a.updated_at).toLocaleDateString("en-GB")} · {answered}/{totalQuestions} questions answered
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {rag && (
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            rag === "green"
                              ? "bg-green-100 text-green-800"
                              : rag === "amber"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {rag === "green" ? "Good" : rag === "amber" ? "Needs Work" : "At Risk"}
                        </span>
                      )}
                      <span className="text-blue-600 text-sm font-medium">Continue →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
