"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { frameworks, getFrameworkScore, getTotalQuestions } from "@/lib/frameworks";
import type { QuestionStatus } from "@/lib/frameworks";

interface Assessment {
  id: string;
  school_name: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  answers: string;
}

interface User {
  id: string;
  username: string;
  role: string;
  school_name: string | null;
  created_at: string;
}

type Tab = "schools" | "users";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("schools");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newSchool, setNewSchool] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const totalQuestions = getTotalQuestions();

  useEffect(() => {
    Promise.all([
      fetch("/api/assessments").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]).then(([a, u]) => {
      setAssessments(a);
      setUsers(u);
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        password: newPassword,
        role: newRole,
        school_name: newSchool || null,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setCreateError(data.error ?? "Failed to create user");
      return;
    }
    setNewUsername("");
    setNewPassword("");
    setNewRole("user");
    setNewSchool("");
    const updated = await fetch("/api/admin/users").then((r) => r.json());
    setUsers(updated);
  }

  async function handleDeleteUser(id: string, username: string) {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  function getOverallScore(answers: Record<string, QuestionStatus>) {
    const scores = frameworks.map((f) => getFrameworkScore(f.id, answers));
    const valid = scores.filter(Boolean);
    if (!valid.length) return null;
    const avg = Math.round(
      valid.reduce((a, s) => a + (s?.percentage ?? 0), 0) / valid.length
    );
    const rag = avg >= 75 ? "green" : avg >= 50 ? "amber" : "red";
    return { avg, rag };
  }

  const compliant = assessments.filter((a) => {
    const s = getOverallScore(JSON.parse(a.answers));
    return s?.rag === "green";
  }).length;

  const atRisk = assessments.filter((a) => {
    const s = getOverallScore(JSON.parse(a.answers));
    return s?.rag === "red";
  }).length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-800 text-white px-4 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏫</span>
            <div>
              <h1 className="font-bold text-lg">Admin Portal</h1>
              <p className="text-blue-200 text-sm">UK School IT Compliance</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-blue-800">{assessments.length}</div>
            <div className="text-sm text-gray-500">Total Assessments</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-green-700">{compliant}</div>
            <div className="text-sm text-gray-500">Compliant Schools</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-red-600">{atRisk}</div>
            <div className="text-sm text-gray-500">At Risk Schools</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-gray-700">{users.length}</div>
            <div className="text-sm text-gray-500">User Accounts</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border rounded-xl p-1 w-fit shadow-sm">
          <button
            onClick={() => setTab("schools")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "schools" ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Schools & Assessments
          </button>
          <button
            onClick={() => setTab("users")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "users" ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            User Management
          </button>
        </div>

        {/* Schools tab */}
        {tab === "schools" && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">All School Assessments</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : assessments.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No assessments yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 text-left">
                    <th className="px-5 py-3 font-medium">School</th>
                    <th className="px-5 py-3 font-medium">Progress</th>
                    {frameworks.map((f) => (
                      <th key={f.id} className="px-3 py-3 font-medium text-center">
                        {f.shortTitle}
                      </th>
                    ))}
                    <th className="px-5 py-3 font-medium">Overall</th>
                    <th className="px-5 py-3 font-medium">Last Updated</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assessments.map((a) => {
                    const answers = JSON.parse(a.answers) as Record<string, QuestionStatus>;
                    const answered = Object.values(answers).filter((v) => v !== null).length;
                    const overall = getOverallScore(answers);
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{a.school_name}</td>
                        <td className="px-5 py-3 text-gray-500">
                          {answered}/{totalQuestions}
                        </td>
                        {frameworks.map((f) => {
                          const score = getFrameworkScore(f.id, answers);
                          return (
                            <td key={f.id} className="px-3 py-3 text-center">
                              {score && score.answered > 0 ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                    score.rag === "green"
                                      ? "bg-green-100 text-green-700"
                                      : score.rag === "amber"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {score.percentage}%
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-5 py-3">
                          {overall ? (
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                                overall.rag === "green"
                                  ? "bg-green-100 text-green-700"
                                  : overall.rag === "amber"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {overall.avg}%
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">
                          {new Date(a.updated_at).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => router.push(`/report/${a.id}`)}
                            className="text-blue-600 hover:underline text-xs font-medium mr-3"
                          >
                            Report
                          </button>
                          <button
                            onClick={() => router.push(`/assess/${a.id}`)}
                            className="text-gray-500 hover:underline text-xs"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Users tab */}
        {tab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User list */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-800">All Users</h2>
              </div>
              {loading ? (
                <div className="p-6 text-center text-gray-400">Loading...</div>
              ) : (
                <div className="divide-y">
                  {users.map((u) => (
                    <div key={u.id} className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800">{u.username}</div>
                        {u.school_name && (
                          <div className="text-xs text-gray-500">{u.school_name}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              u.role === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {u.role}
                          </span>
                          <span className="text-xs text-gray-400">
                            Created {new Date(u.created_at).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                      </div>
                      {u.username !== "admin" && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create user form */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Create New User</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. stjohns-it"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Set a strong password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="user">School User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    School Name <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newSchool}
                    onChange={(e) => setNewSchool(e.target.value)}
                    placeholder="e.g. St John's Primary School"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                {createError && (
                  <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                    {createError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create User"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
