"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  frameworks,
  getTotalQuestions,
  getFrameworkScore,
  calculateScore,
  type QuestionStatus,
} from "@/lib/frameworks";

export default function ReportPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [answers, setAnswers] = useState<Record<string, QuestionStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/assessments/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSchoolName(data.school_name);
        setAnswers(JSON.parse(data.answers || "{}"));
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading report...</div>
      </div>
    );
  }

  const totalQuestions = getTotalQuestions();
  const totalAnswered = Object.values(answers).filter((v) => v !== null).length;
  const overallScore = calculateScore(answers);

  const criticalFails = frameworks.flatMap((f) =>
    f.sections.flatMap((s) =>
      s.questions
        .filter((q) => q.priority === "critical" && answers[q.id] === "no")
        .map((q) => ({ framework: f.shortTitle, question: q.text, guidance: q.guidance }))
    )
  );

  const highFails = frameworks.flatMap((f) =>
    f.sections.flatMap((s) =>
      s.questions
        .filter((q) => q.priority === "high" && answers[q.id] === "no")
        .map((q) => ({ framework: f.shortTitle, question: q.text, guidance: q.guidance }))
    )
  );

  const partials = frameworks.flatMap((f) =>
    f.sections.flatMap((s) =>
      s.questions
        .filter((q) => answers[q.id] === "partial")
        .map((q) => ({ framework: f.shortTitle, question: q.text, guidance: q.guidance }))
    )
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-800 text-white px-4 py-6 print:bg-blue-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2 print:hidden">
            <button onClick={() => router.push("/compliance")} className="text-blue-200 text-sm hover:text-white">
              ← Compliance
            </button>
            <span className="text-blue-600">|</span>
            <button onClick={() => router.push(`/assess/${id}`)} className="text-blue-200 text-sm hover:text-white">
              Back to assessment
            </button>
          </div>
          <h1 className="text-2xl font-bold">IT Compliance Report</h1>
          <p className="text-blue-200">{schoolName} · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Print button */}
        <div className="flex justify-end mb-6 print:hidden">
          <button
            onClick={() => window.print()}
            className="bg-blue-700 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-800 transition-colors"
          >
            Print / Save as PDF
          </button>
        </div>

        {/* Overall score */}
        <div
          className={`rounded-xl p-6 mb-6 border-2 ${
            overallScore.rag === "green"
              ? "bg-green-50 border-green-300"
              : overallScore.rag === "amber"
              ? "bg-yellow-50 border-yellow-300"
              : "bg-red-50 border-red-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Overall Compliance Score</h2>
              <p className="text-gray-600 mt-1">
                {totalAnswered} of {totalQuestions} questions answered
              </p>
            </div>
            <div className="text-right">
              <div
                className={`text-5xl font-bold ${
                  overallScore.rag === "green"
                    ? "text-green-700"
                    : overallScore.rag === "amber"
                    ? "text-yellow-700"
                    : "text-red-700"
                }`}
              >
                {overallScore.percentage}%
              </div>
              <div
                className={`text-lg font-semibold ${
                  overallScore.rag === "green"
                    ? "text-green-700"
                    : overallScore.rag === "amber"
                    ? "text-yellow-700"
                    : "text-red-700"
                }`}
              >
                {overallScore.rag === "green"
                  ? "Compliant"
                  : overallScore.rag === "amber"
                  ? "Partially Compliant"
                  : "Non-Compliant"}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{overallScore.yes}</div>
              <div className="text-sm text-gray-500">Fully Met</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-600">{overallScore.partial}</div>
              <div className="text-sm text-gray-500">Partially Met</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-red-700">{overallScore.no}</div>
              <div className="text-sm text-gray-500">Not Met</div>
            </div>
          </div>
        </div>

        {/* Framework breakdown */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Framework Breakdown</h2>
          <div className="space-y-3">
            {frameworks.map((f) => {
              const score = getFrameworkScore(f.id, answers);
              if (!score) return null;
              return (
                <div key={f.id} className="flex items-center gap-4">
                  <div className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">
                    {f.shortTitle}
                  </div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        score.rag === "green"
                          ? "bg-green-500"
                          : score.rag === "amber"
                          ? "bg-yellow-400"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${score.percentage}%` }}
                    />
                  </div>
                  <div className="w-12 text-sm font-bold text-right text-gray-700">
                    {score.percentage}%
                  </div>
                  <div
                    className={`w-24 text-xs text-center px-2 py-1 rounded-full font-medium ${
                      score.rag === "green"
                        ? "bg-green-100 text-green-700"
                        : score.rag === "amber"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {score.rag === "green" ? "Compliant" : score.rag === "amber" ? "Partial" : "At Risk"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Critical gaps */}
        {criticalFails.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-red-800 mb-1">
              Critical Gaps ({criticalFails.length})
            </h2>
            <p className="text-sm text-red-600 mb-4">
              These must be addressed as a priority — they represent the highest risk to your school.
            </p>
            <div className="space-y-3">
              {criticalFails.map((item, i) => (
                <div key={i} className="border border-red-100 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start gap-2">
                    <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-medium flex-shrink-0 mt-0.5">
                      {item.framework}
                    </span>
                    <p className="text-sm font-medium text-gray-800">{item.question}</p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">{item.guidance}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* High priority gaps */}
        {highFails.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-orange-800 mb-1">
              High Priority Gaps ({highFails.length})
            </h2>
            <p className="text-sm text-orange-600 mb-4">
              These should be addressed soon to improve your compliance posture.
            </p>
            <div className="space-y-3">
              {highFails.map((item, i) => (
                <div key={i} className="border border-orange-100 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-start gap-2">
                    <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded font-medium flex-shrink-0 mt-0.5">
                      {item.framework}
                    </span>
                    <p className="text-sm font-medium text-gray-800">{item.question}</p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">{item.guidance}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Partial items */}
        {partials.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-yellow-800 mb-1">
              Partially Met ({partials.length})
            </h2>
            <p className="text-sm text-yellow-700 mb-4">
              These areas have been started but need further work to be fully compliant.
            </p>
            <div className="space-y-3">
              {partials.map((item, i) => (
                <div key={i} className="border border-yellow-100 rounded-lg p-4 bg-yellow-50">
                  <div className="flex items-start gap-2">
                    <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded font-medium flex-shrink-0 mt-0.5">
                      {item.framework}
                    </span>
                    <p className="text-sm font-medium text-gray-800">{item.question}</p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">{item.guidance}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {criticalFails.length === 0 && highFails.length === 0 && partials.length === 0 && totalAnswered > 0 && (
          <div className="bg-green-50 border border-green-300 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-xl font-bold text-green-800">Excellent compliance!</h2>
            <p className="text-green-700 mt-1">No critical or high priority gaps identified.</p>
          </div>
        )}

        {totalAnswered < totalQuestions && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center mt-4">
            <p className="text-blue-700 text-sm">
              {totalQuestions - totalAnswered} questions not yet answered.{" "}
              <button
                onClick={() => router.push(`/assess/${id}`)}
                className="font-medium underline"
              >
                Complete the assessment
              </button>{" "}
              for a full picture.
            </p>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 mt-8 print:block">
          Generated on {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · School IT Manager
        </div>
      </div>
    </main>
  );
}
