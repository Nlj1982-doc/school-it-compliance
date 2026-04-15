"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { frameworks, getFrameworkScore, getTotalQuestions } from "@/lib/frameworks";
import type { QuestionStatus } from "@/lib/frameworks";

interface School {
  id: string;
  name: string;
  urn: string | null;
  address: string | null;
  created_at: string;
  user_count: number;
}

interface Assessment {
  id: string;
  school_id: string | null;
  school_name: string;
  created_at: string;
  updated_at: string;
  answers: string;
}

interface User {
  id: string;
  username: string;
  role: string;
  school_id: string | null;
  school_name: string | null;
  created_at: string;
}

type Tab = "schools" | "users";

interface ResetPasswordState {
  userId: string;
  username: string;
  newPassword: string;
  saving: boolean;
  error: string;
  success: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("schools");
  const [schools, setSchools] = useState<School[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetState, setResetState] = useState<ResetPasswordState | null>(null);

  // New school form
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolUrn, setNewSchoolUrn] = useState("");
  const [newSchoolAddress, setNewSchoolAddress] = useState("");
  const [schoolError, setSchoolError] = useState("");
  const [creatingSchool, setCreatingSchool] = useState(false);
  const [showSchoolForm, setShowSchoolForm] = useState(false);

  // New user form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newSchoolId, setNewSchoolId] = useState("");
  const [userError, setUserError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);

  const totalQuestions = getTotalQuestions();

  async function loadAll() {
    const [s, a, u] = await Promise.all([
      fetch("/api/admin/schools").then((r) => r.json()),
      fetch("/api/assessments").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]);
    setSchools(s);
    setAssessments(a);
    setUsers(u);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleCreateSchool(e: React.FormEvent) {
    e.preventDefault();
    setSchoolError("");
    setCreatingSchool(true);
    const res = await fetch("/api/admin/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSchoolName, urn: newSchoolUrn, address: newSchoolAddress }),
    });
    const data = await res.json();
    setCreatingSchool(false);
    if (!res.ok) { setSchoolError(data.error ?? "Failed to create school"); return; }
    setNewSchoolName(""); setNewSchoolUrn(""); setNewSchoolAddress("");
    setShowSchoolForm(false);
    loadAll();
  }

  async function handleDeleteSchool(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its data? This cannot be undone.`)) return;
    await fetch("/api/admin/schools", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadAll();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError("");
    setCreatingUser(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole, school_id: newSchoolId || null }),
    });
    const data = await res.json();
    setCreatingUser(false);
    if (!res.ok) { setUserError(data.error ?? "Failed to create user"); return; }
    setNewUsername(""); setNewPassword(""); setNewRole("user"); setNewSchoolId("");
    setShowUserForm(false);
    loadAll();
  }

  async function handleDeleteUser(id: string, username: string) {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadAll();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetState) return;
    setResetState(s => s ? { ...s, saving: true, error: "" } : s);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetState.userId, password: resetState.newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResetState(s => s ? { ...s, saving: false, error: data.error ?? "Failed to reset password" } : s);
    } else {
      setResetState(s => s ? { ...s, saving: false, success: true } : s);
      setTimeout(() => setResetState(null), 1500);
    }
  }

  function getSchoolScore(schoolId: string) {
    const a = assessments.find((a) => a.school_id === schoolId);
    if (!a) return null;
    const answers = JSON.parse(a.answers) as Record<string, QuestionStatus>;
    const answered = Object.values(answers).filter((v) => v !== null).length;
    if (answered === 0) return null;
    const scores = frameworks.map((f) => getFrameworkScore(f.id, answers)).filter(Boolean);
    const avg = Math.round(scores.reduce((a, s) => a + (s?.percentage ?? 0), 0) / scores.length);
    const rag = avg >= 75 ? "green" : avg >= 50 ? "amber" : "red";
    return { avg, rag, answered, assessmentId: a.id };
  }

  const compliant = schools.filter((s) => getSchoolScore(s.id)?.rag === "green").length;
  const atRisk = schools.filter((s) => getSchoolScore(s.id)?.rag === "red").length;

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
          <button onClick={handleLogout} className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-blue-800">{schools.length}</div>
            <div className="text-sm text-gray-500">Schools</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-green-700">{compliant}</div>
            <div className="text-sm text-gray-500">Compliant</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-red-600">{atRisk}</div>
            <div className="text-sm text-gray-500">At Risk</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-gray-700">{users.filter(u => u.role !== "admin").length}</div>
            <div className="text-sm text-gray-500">School Users</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border rounded-xl p-1 w-fit shadow-sm">
          {(["schools", "users"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {t === "schools" ? "Schools & Assessments" : "Users"}
            </button>
          ))}
        </div>

        {/* SCHOOLS TAB */}
        {tab === "schools" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-800 text-lg">All Schools</h2>
              <button onClick={() => setShowSchoolForm(!showSchoolForm)}
                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                + Add School
              </button>
            </div>

            {/* Add school form */}
            {showSchoolForm && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">New School</h3>
                <form onSubmit={handleCreateSchool} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">School Name *</label>
                    <input type="text" value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)}
                      placeholder="e.g. St John's Primary" required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">URN (optional)</label>
                    <input type="text" value={newSchoolUrn} onChange={e => setNewSchoolUrn(e.target.value)}
                      placeholder="e.g. 123456"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address (optional)</label>
                    <input type="text" value={newSchoolAddress} onChange={e => setNewSchoolAddress(e.target.value)}
                      placeholder="e.g. London, SW1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {schoolError && <div className="sm:col-span-3 text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{schoolError}</div>}
                  <div className="sm:col-span-3 flex gap-2">
                    <button type="submit" disabled={creatingSchool}
                      className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                      {creatingSchool ? "Creating..." : "Create School"}
                    </button>
                    <button type="button" onClick={() => setShowSchoolForm(false)}
                      className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Schools list */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading...</div>
              ) : schools.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No schools yet. Add one above.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-500 text-left">
                      <th className="px-5 py-3 font-medium">School</th>
                      <th className="px-4 py-3 font-medium">URN</th>
                      <th className="px-4 py-3 font-medium">Users</th>
                      {frameworks.map(f => (
                        <th key={f.id} className="px-3 py-3 font-medium text-center">{f.shortTitle}</th>
                      ))}
                      <th className="px-4 py-3 font-medium">Overall</th>
                      <th className="px-4 py-3 font-medium">Progress</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {schools.map((school) => {
                      const score = getSchoolScore(school.id);
                      const assessment = assessments.find(a => a.school_id === school.id);
                      const answers = assessment ? JSON.parse(assessment.answers) as Record<string, QuestionStatus> : {};
                      return (
                        <tr key={school.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <div className="font-medium text-gray-800">{school.name}</div>
                            {school.address && <div className="text-xs text-gray-400">{school.address}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{school.urn ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-500">{school.user_count}</td>
                          {frameworks.map(f => {
                            const fs = assessment ? getFrameworkScore(f.id, answers) : null;
                            return (
                              <td key={f.id} className="px-3 py-3 text-center">
                                {fs && fs.answered > 0 ? (
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${fs.rag === "green" ? "bg-green-100 text-green-700" : fs.rag === "amber" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                    {fs.percentage}%
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3">
                            {score ? (
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${score.rag === "green" ? "bg-green-100 text-green-700" : score.rag === "amber" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                {score.avg}%
                              </span>
                            ) : <span className="text-gray-300 text-xs">Not started</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {score ? `${score.answered}/${totalQuestions}` : "0/" + totalQuestions}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {assessment && (
                              <>
                                <button onClick={() => router.push(`/report/${assessment.id}`)} className="text-blue-600 hover:underline text-xs font-medium mr-3">Report</button>
                                <button onClick={() => router.push(`/assess/${assessment.id}`)} className="text-gray-500 hover:underline text-xs mr-3">Edit</button>
                              </>
                            )}
                            <button onClick={() => handleDeleteSchool(school.id, school.name)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-800 text-lg">All Users</h2>
              <button onClick={() => setShowUserForm(!showUserForm)}
                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                + Add User
              </button>
            </div>

            {/* Add user form */}
            {showUserForm && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">New User</h3>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
                    <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                      placeholder="e.g. stjohns.it" required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                    <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="Set a strong password" required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="user">School User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {newRole === "user" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">School *</label>
                      <select value={newSchoolId} onChange={e => setNewSchoolId(e.target.value)} required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">— Select a school —</option>
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {userError && <div className="sm:col-span-2 text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{userError}</div>}
                  <div className="sm:col-span-2 flex gap-2">
                    <button type="submit" disabled={creatingUser}
                      className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                      {creatingUser ? "Creating..." : "Create User"}
                    </button>
                    <button type="button" onClick={() => setShowUserForm(false)}
                      className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Users list */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {loading ? (
                <div className="p-6 text-center text-gray-400">Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-500 text-left">
                      <th className="px-5 py-3 font-medium">Username</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">School</th>
                      <th className="px-5 py-3 font-medium">Created</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{u.username}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500">{u.school_name ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString("en-GB")}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setResetState({ userId: u.id, username: u.username, newPassword: "", saving: false, error: "", success: false })}
                            className="text-blue-500 hover:text-blue-700 text-sm mr-3 font-medium"
                          >
                            Reset Password
                          </button>
                          {u.username !== "admin" && (
                            <button onClick={() => handleDeleteUser(u.id, u.username)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetState && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-5">
              Set a new password for <span className="font-medium text-gray-700">{resetState.username}</span>
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="text"
                  value={resetState.newPassword}
                  onChange={e => setResetState(s => s ? { ...s, newPassword: e.target.value } : s)}
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              {resetState.error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {resetState.error}
                </div>
              )}
              {resetState.success && (
                <div className="text-green-700 text-sm bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                  ✓ Password updated successfully
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={resetState.saving || resetState.success}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {resetState.saving ? "Saving..." : "Save New Password"}
                </button>
                <button
                  type="button"
                  onClick={() => setResetState(null)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
