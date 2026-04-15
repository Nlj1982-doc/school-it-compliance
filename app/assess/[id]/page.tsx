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

export default function AssessPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [answers, setAnswers] = useState<Record<string, QuestionStatus>>({});
  const [activeFramework, setActiveFramework] = useState<string>(frameworks[0].id);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    fetch(`/api/assessments/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSchoolName(data.school_name);
        setAnswers(JSON.parse(data.answers || "{}"));
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

  const totalQuestions = getTotalQuestions();
  const totalAnswered = Object.values(answers).filter((v) => v !== null).length;
  const progress = Math.round((totalAnswered / totalQuestions) * 100);

  const activeF = frameworks.find((f) => f.id === activeFramework) as Framework;
  const activeScore = getFrameworkScore(activeFramework, answers);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-800 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/")} className="text-blue-200 text-sm hover:text-white mb-1">
              ← Back to home
            </button>
            <h1 className="font-bold text-lg">{schoolName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-blue-200">Overall Progress</div>
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
