"use client";

import { useState, useEffect, useCallback } from "react";
import UserNav from "@/components/UserNav";

// ── Types ──────────────────────────────────────────────────────────────────

interface Connection {
  id: string;
  provider: "microsoft" | "google";
  user_count: number;
  last_synced: string | null;
  last_error: string | null;
}

interface DirUser {
  id: string;
  provider: string;
  display_name: string;
  email: string | null;
  role: "student" | "teacher" | "staff" | "admin";
  department: string | null;
  job_title: string | null;
  ou_path: string | null;
}

type RoleFilter = "all" | "student" | "teacher" | "staff" | "admin";

// ── Role & provider helpers ────────────────────────────────────────────────

const ROLE_STYLE: Record<string, string> = {
  student: "bg-blue-100 text-blue-700",
  teacher: "bg-green-100 text-green-700",
  staff:   "bg-gray-100 text-gray-600",
  admin:   "bg-purple-100 text-purple-700",
};

const PROVIDER_LABEL: Record<string, string> = {
  microsoft: "Microsoft 365",
  google: "Google Workspace",
};

const PROVIDER_COLOR: Record<string, string> = {
  microsoft: "bg-blue-600",
  google: "bg-red-500",
};

const PROVIDER_ICON: Record<string, string> = {
  microsoft: "M",
  google: "G",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

// ── Microsoft setup form ───────────────────────────────────────────────────

function MicrosoftForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ tenantId: "", clientId: "", clientSecret: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const res = await fetch("/api/my/directory/connections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "microsoft", config: form }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to save"); return; }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button type="button" onClick={() => setShowHelp(!showHelp)}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
        {showHelp ? "▲" : "▼"} How to set up an Azure App Registration
      </button>
      {showHelp && (
        <ol className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-1.5 list-decimal list-inside">
          <li>Sign in to <strong>portal.azure.com</strong> as a Global Admin</li>
          <li>Go to <strong>Microsoft Entra ID → App registrations → New registration</strong></li>
          <li>Name: &quot;School IT Manager&quot;, supported account type: this organisation only → Register</li>
          <li>Copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong> from the Overview page</li>
          <li>Go to <strong>Certificates &amp; secrets → New client secret</strong> → copy the <strong>Value</strong></li>
          <li>Go to <strong>API permissions → Add a permission → Microsoft Graph → Application permissions</strong></li>
          <li>Add: <code>User.Read.All</code> and <code>Directory.Read.All</code></li>
          <li>Click <strong>Grant admin consent for [your organisation]</strong></li>
        </ol>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Directory (Tenant) ID *</label>
          <input type="text" value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))} required
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Application (Client) ID *</label>
          <input type="text" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret Value *</label>
          <input type="password" value={form.clientSecret} onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))} required
            placeholder="Paste the secret value (not the secret ID)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? "Saving…" : "Save Connection"}
        </button>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
      </div>
    </form>
  );
}

// ── Google setup form ──────────────────────────────────────────────────────

function GoogleForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ adminEmail: "", domain: "", serviceAccountJson: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    // Validate JSON before saving
    try { JSON.parse(form.serviceAccountJson); } catch { setError("Service account JSON is not valid JSON"); setSaving(false); return; }
    const res = await fetch("/api/my/directory/connections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", config: form }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to save"); return; }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button type="button" onClick={() => setShowHelp(!showHelp)}
        className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1">
        {showHelp ? "▲" : "▼"} How to set up a Service Account
      </button>
      {showHelp && (
        <ol className="text-xs text-gray-600 bg-red-50 border border-red-100 rounded-lg p-4 space-y-1.5 list-decimal list-inside">
          <li>Go to <strong>console.cloud.google.com</strong> → create or select a project</li>
          <li>Enable the <strong>Admin SDK API</strong> for your project</li>
          <li>Go to <strong>IAM &amp; Admin → Service Accounts → Create Service Account</strong></li>
          <li>Create and download a <strong>JSON key</strong> for the service account</li>
          <li>In <strong>Google Workspace Admin (admin.google.com)</strong>:</li>
          <li className="ml-4">Security → Access and data control → <strong>API controls → Manage Domain Wide Delegation</strong></li>
          <li className="ml-4">Add the service account <strong>Client ID</strong> (numeric) with scope:<br />
            <code className="bg-white px-1 rounded">https://www.googleapis.com/auth/admin.directory.user.readonly</code></li>
          <li>The <strong>admin email</strong> below must be a Super Admin in Google Workspace</li>
        </ol>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Super Admin Email *</label>
          <input type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} required
            placeholder="admin@school.co.uk"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Domain *</label>
          <input type="text" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} required
            placeholder="school.co.uk"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Service Account JSON *</label>
          <textarea value={form.serviceAccountJson} onChange={e => setForm(f => ({ ...f, serviceAccountJson: e.target.value }))} required
            rows={6} placeholder={`Paste the contents of the downloaded JSON key file:\n{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "-----BEGIN RSA PRIVATE KEY-----\\n..."\n  ...\n}`}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? "Saving…" : "Save Connection"}
        </button>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
      </div>
    </form>
  );
}

// ── Provider card ──────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  connection,
  onSetup,
  onSync,
  onDisconnect,
  syncing,
}: {
  provider: "microsoft" | "google";
  connection: Connection | undefined;
  onSetup: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
}) {
  const connected = !!connection;
  const hasError = !!connection?.last_error;

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-4 ${hasError ? "border-red-200" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${PROVIDER_COLOR[provider]}`}>
          {PROVIDER_ICON[provider]}
        </div>
        <div>
          <div className="font-semibold text-gray-800">{PROVIDER_LABEL[provider]}</div>
          <div className={`text-xs font-medium ${connected ? "text-green-600" : "text-gray-400"}`}>
            {connected ? "● Connected" : "○ Not connected"}
          </div>
        </div>
      </div>

      {connected && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Accounts imported</span>
            <span className="font-semibold text-gray-800">{connection.user_count.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Last synced</span>
            <span className="text-gray-600">{connection.last_synced ? timeAgo(connection.last_synced) : "Never"}</span>
          </div>
        </div>
      )}

      {hasError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <strong>Last sync failed:</strong> {connection!.last_error}
        </div>
      )}

      {!connected ? (
        <button onClick={onSetup}
          className={`w-full py-2 rounded-lg text-sm font-medium text-white transition-colors ${provider === "microsoft" ? "bg-blue-700 hover:bg-blue-800" : "bg-red-600 hover:bg-red-700"}`}>
          Connect {PROVIDER_LABEL[provider]}
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={onSync} disabled={syncing}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
            {syncing ? "Syncing…" : "↻ Sync Now"}
          </button>
          <button onClick={onSetup} className="text-gray-500 hover:text-gray-700 text-xs border border-gray-200 rounded-lg px-3">Update</button>
          <button onClick={onDisconnect} className="text-red-400 hover:text-red-600 text-xs border border-red-100 rounded-lg px-3">Remove</button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [users, setUsers] = useState<DirUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupProvider, setSetupProvider] = useState<"microsoft" | "google" | null>(null);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncResult, setSyncResult] = useState<Record<string, string>>({});
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const [c, u] = await Promise.all([
      fetch("/api/my/directory/connections").then(r => r.json()),
      fetch("/api/my/directory/users").then(r => r.json()),
    ]);
    setConnections(Array.isArray(c) ? c : []);
    setUsers(Array.isArray(u) ? u : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSync(provider: string) {
    setSyncing(s => ({ ...s, [provider]: true }));
    setSyncResult(r => ({ ...r, [provider]: "" }));
    const res = await fetch("/api/my/directory/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    setSyncing(s => ({ ...s, [provider]: false }));
    if (!res.ok) {
      setSyncResult(r => ({ ...r, [provider]: `Error: ${data.error}` }));
    } else {
      setSyncResult(r => ({ ...r, [provider]: `✓ ${data.total} accounts imported (${data.student} students, ${data.teacher} teachers, ${data.staff} staff, ${data.admin} admins)` }));
    }
    load();
  }

  async function handleDisconnect(provider: string) {
    if (!confirm(`Remove the ${PROVIDER_LABEL[provider]} connection and all imported accounts?`)) return;
    await fetch("/api/my/directory/connections", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }),
    });
    load();
  }

  const msConn = connections.find(c => c.provider === "microsoft");
  const gConn = connections.find(c => c.provider === "google");

  const roleCounts = {
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
      return (u.display_name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />
      <div className="max-w-5xl mx-auto px-4 py-6">

        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800">Directory Sync</h2>
          <p className="text-sm text-gray-500 mt-1">
            Import staff and student accounts from Microsoft 365 or Google Workspace. Sync regularly to keep the list up to date.
          </p>
        </div>

        {/* Provider cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <ProviderCard provider="microsoft" connection={msConn} syncing={!!syncing["microsoft"]}
              onSetup={() => setSetupProvider(setupProvider === "microsoft" ? null : "microsoft")}
              onSync={() => handleSync("microsoft")}
              onDisconnect={() => handleDisconnect("microsoft")} />
            {syncResult["microsoft"] && (
              <p className={`text-xs mt-2 px-1 ${syncResult["microsoft"].startsWith("Error") ? "text-red-600" : "text-green-700"}`}>
                {syncResult["microsoft"]}
              </p>
            )}
          </div>
          <div>
            <ProviderCard provider="google" connection={gConn} syncing={!!syncing["google"]}
              onSetup={() => setSetupProvider(setupProvider === "google" ? null : "google")}
              onSync={() => handleSync("google")}
              onDisconnect={() => handleDisconnect("google")} />
            {syncResult["google"] && (
              <p className={`text-xs mt-2 px-1 ${syncResult["google"].startsWith("Error") ? "text-red-600" : "text-green-700"}`}>
                {syncResult["google"]}
              </p>
            )}
          </div>
        </div>

        {/* Setup forms */}
        {setupProvider === "microsoft" && (
          <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Microsoft 365 Connection</h3>
            <MicrosoftForm onSave={() => { setSetupProvider(null); load(); }} onCancel={() => setSetupProvider(null)} />
          </div>
        )}
        {setupProvider === "google" && (
          <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Google Workspace Connection</h3>
            <GoogleForm onSave={() => { setSetupProvider(null); load(); }} onCancel={() => setSetupProvider(null)} />
          </div>
        )}

        {/* User list */}
        {users.length > 0 && (
          <>
            {/* Role filter tabs */}
            <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
              <div className="flex gap-1 bg-white border rounded-xl p-1 shadow-sm flex-wrap">
                {(["all", "student", "teacher", "staff", "admin"] as RoleFilter[]).map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${roleFilter === r ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                    {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1) + "s"}{" "}
                    <span className="opacity-70">({roleCounts[r]})</span>
                  </button>
                ))}
              </div>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, department…"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No accounts match your filter.</div>
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
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${ROLE_STYLE[u.role]?.includes("blue") ? "bg-blue-500" : ROLE_STYLE[u.role]?.includes("green") ? "bg-green-500" : ROLE_STYLE[u.role]?.includes("purple") ? "bg-purple-500" : "bg-gray-400"}`}>
                                {u.display_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-800">{u.display_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_STYLE[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            <div>{u.department ?? ""}</div>
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

        {/* Empty state — no connections yet */}
        {!loading && users.length === 0 && connections.length === 0 && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-4xl mb-3">🔗</div>
            <p className="text-gray-500 font-medium">No directory connected yet</p>
            <p className="text-gray-400 text-sm mt-1">Connect Microsoft 365 or Google Workspace above to import your school&apos;s accounts.</p>
          </div>
        )}

        {/* Connected but never synced */}
        {!loading && users.length === 0 && connections.length > 0 && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-4xl mb-3">↻</div>
            <p className="text-gray-500 font-medium">Ready to sync</p>
            <p className="text-gray-400 text-sm mt-1">Click <strong>Sync Now</strong> on a connected provider to import accounts.</p>
          </div>
        )}

        {/* Role detection note */}
        {users.length > 0 && (
          <div className="mt-4 text-xs text-gray-400 bg-white border rounded-xl px-4 py-3">
            <strong>Role detection:</strong> Roles are automatically inferred from job title, department, and organisational unit.
            Microsoft 365 tenants using School Data Sync will have accurate student/teacher roles.
            For other tenants, adjust user job titles or departments in your directory if roles are incorrect.
          </div>
        )}
      </div>
    </main>
  );
}
