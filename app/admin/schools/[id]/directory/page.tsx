"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import SchoolNav from "@/components/SchoolNav";

interface Connection {
  id: string;
  provider: string;
  user_count: number;
  last_synced: string | null;
  last_error: string | null;
}

interface DirUser {
  id: string;
  provider: string;
  display_name: string;
  email: string | null;
  role: string;
  department: string | null;
  job_title: string | null;
  ou_path: string | null;
}

const ROLE_STYLE: Record<string, string> = {
  student: "bg-blue-100 text-blue-700",
  teacher: "bg-green-100 text-green-700",
  staff:   "bg-gray-100 text-gray-600",
  admin:   "bg-purple-100 text-purple-700",
};

const PROVIDER_COLOR: Record<string, string> = {
  microsoft: "bg-blue-600",
  google: "bg-red-500",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export default function AdminDirectoryPage() {
  const params = useParams();
  const schoolId = params.id as string;

  const [schoolName, setSchoolName] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [users, setUsers] = useState<DirUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncResult, setSyncResult] = useState<Record<string, string>>({});
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const [school, c, u] = await Promise.all([
      fetch(`/api/admin/schools/${schoolId}`).then(r => r.json()),
      fetch(`/api/admin/schools/${schoolId}/directory/connections`).then(r => r.json()),
      fetch(`/api/admin/schools/${schoolId}/directory/users`).then(r => r.json()),
    ]);
    setSchoolName(school?.name ?? "");
    setConnections(Array.isArray(c) ? c : []);
    setUsers(Array.isArray(u) ? u : []);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  async function handleSync(provider: string) {
    setSyncing(s => ({ ...s, [provider]: true }));
    setSyncResult(r => ({ ...r, [provider]: "" }));
    const res = await fetch(`/api/admin/schools/${schoolId}/directory/sync`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    setSyncing(s => ({ ...s, [provider]: false }));
    setSyncResult(r => ({
      ...r,
      [provider]: res.ok
        ? `✓ ${data.total} accounts (${data.student} students, ${data.teacher} teachers, ${data.staff} staff, ${data.admin} admins)`
        : `Error: ${data.error}`,
    }));
    load();
  }

  const roleCounts: Record<string, number> = {
    all: users.length,
    student: users.filter(u => u.role === "student").length,
    teacher: users.filter(u => u.role === "teacher").length,
    staff: users.filter(u => u.role === "staff").length,
    admin: users.filter(u => u.role === "admin").length,
  };

  const filtered = users.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (u.display_name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q) || (u.department ?? "").toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <SchoolNav schoolId={schoolId} schoolName={schoolName} />
      <div className="max-w-5xl mx-auto px-4 py-6">

        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-800">Directory Sync</h2>
          <p className="text-sm text-gray-500 mt-0.5">View and trigger directory sync for this school. Connections are configured by the school&apos;s IT coordinator from their portal.</p>
        </div>

        {/* Connection status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {["microsoft", "google"].map(provider => {
            const conn = connections.find(c => c.provider === provider);
            return (
              <div key={provider} className={`bg-white rounded-xl border shadow-sm p-4 ${conn?.last_error ? "border-red-200" : ""}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 ${PROVIDER_COLOR[provider]}`}>
                    {provider === "microsoft" ? "M" : "G"}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{provider === "microsoft" ? "Microsoft 365" : "Google Workspace"}</div>
                    <div className={`text-xs ${conn ? "text-green-600" : "text-gray-400"}`}>{conn ? "● Connected" : "○ Not connected"}</div>
                  </div>
                </div>
                {conn && (
                  <div className="text-xs text-gray-500 mb-3 space-y-0.5">
                    <div className="flex justify-between"><span>Accounts:</span><span className="font-medium text-gray-700">{conn.user_count.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Last synced:</span><span>{conn.last_synced ? timeAgo(conn.last_synced) : "Never"}</span></div>
                  </div>
                )}
                {conn?.last_error && <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-3">{conn.last_error}</div>}
                {conn && (
                  <>
                    <button onClick={() => handleSync(provider)} disabled={!!syncing[provider]}
                      className="w-full bg-blue-700 hover:bg-blue-800 text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                      {syncing[provider] ? "Syncing…" : "↻ Sync Now"}
                    </button>
                    {syncResult[provider] && (
                      <p className={`text-xs mt-1.5 ${syncResult[provider].startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{syncResult[provider]}</p>
                    )}
                  </>
                )}
                {!conn && <p className="text-xs text-gray-400">Configured by the school IT coordinator from their user portal.</p>}
              </div>
            );
          })}
        </div>

        {/* User list */}
        {users.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
              <div className="flex gap-1 bg-white border rounded-xl p-1 shadow-sm flex-wrap">
                {["all", "student", "teacher", "staff", "admin"].map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${roleFilter === r ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                    {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1) + "s"} <span className="opacity-70">({roleCounts[r]})</span>
                  </button>
                ))}
              </div>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-500 text-left text-xs">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Department / OU</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{u.display_name}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_STYLE[u.role] ?? "bg-gray-100 text-gray-600"}`}>{u.role}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {u.department && <div>{u.department}</div>}
                            {u.ou_path && <div className="text-gray-400 font-mono">{u.ou_path}</div>}
                            {u.job_title && <div className="text-gray-400">{u.job_title}</div>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium text-white ${PROVIDER_COLOR[u.provider] ?? "bg-gray-400"}`}>
                              {u.provider === "microsoft" ? "M365" : "Google"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 text-right mt-2">{filtered.length.toLocaleString()} account{filtered.length !== 1 ? "s" : ""}</p>
          </>
        )}

        {!loading && users.length === 0 && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-4xl mb-3">🔗</div>
            <p className="text-gray-500 font-medium">No directory data yet</p>
            <p className="text-gray-400 text-sm mt-1">The school IT coordinator connects and syncs their directory from their user portal. Sync Now above if a connection is already configured.</p>
          </div>
        )}
      </div>
    </main>
  );
}
