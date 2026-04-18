"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import UserNav from "@/components/UserNav";
import { frameworks, getTotalQuestions, getFrameworkScore, calculateScore } from "@/lib/frameworks";
import type { QuestionStatus } from "@/lib/frameworks";
import type { BackupProvider } from "@/lib/backup-sync";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assessment {
  id: string;
  school_id: string | null;
  school_name: string;
  updated_at: string;
  answers: string;
}

interface BackupConnection {
  id: string;
  provider: string;
  label: string;
  last_polled: string | null;
  last_error: string | null;
}

interface BackupJob {
  id: string;
  connection_id: string;
  provider: string;
  label: string;
  job_name: string;
  job_type: string | null;
  status: "Success" | "Warning" | "Failed" | "Running" | "Unknown";
  started_at: string | null;
  ended_at: string | null;
  size_gb: number | null;
  protected_items: number | null;
  error_message: string | null;
  polled_at: string;
}

interface DirectoryConnection {
  id: string;
  provider: string;
  user_count: number;
  last_synced: string | null;
  last_error: string | null;
}

interface DirectoryUser {
  id: string;
  provider: string;
  external_id: string;
  display_name: string;
  email: string | null;
  role: string;
  department: string | null;
  job_title: string | null;
  ou_path: string | null;
  synced_at: string;
}

// ─── Provider metadata ───────────────────────────────────────────────────────

const PROVIDER_META: Record<
  BackupProvider,
  { label: string; badge: string; badgeBg: string; fields: Array<{ key: string; label: string; type: string; placeholder?: string }>; instructions: string }
> = {
  veeam: {
    label: "Veeam",
    badge: "V",
    badgeBg: "bg-blue-600",
    fields: [
      { key: "server", label: "Server URL", type: "text", placeholder: "https://vbr-host:9419" },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
    ],
    instructions:
      "Enable the REST API in the Veeam Backup & Replication console under Configuration → REST API. The default port is 9419. Create a dedicated read-only user for API access.",
  },
  acronis: {
    label: "Acronis",
    badge: "A",
    badgeBg: "bg-orange-500",
    fields: [
      { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://cloud.acronis.com" },
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
    instructions:
      "Create an API client in the Acronis management portal under Settings → API clients. Choose the Client Credentials flow and grant backup read permissions.",
  },
  datto: {
    label: "Datto",
    badge: "D",
    badgeBg: "bg-green-600",
    fields: [
      { key: "apiKey", label: "API Key", type: "text" },
      { key: "apiSecretKey", label: "API Secret Key", type: "password" },
    ],
    instructions:
      "Retrieve your API keys from the Datto Partner Portal under Admin → API. Both the public API key and secret key are required.",
  },
  azure: {
    label: "Azure Backup",
    badge: "Az",
    badgeBg: "bg-blue-500",
    fields: [
      { key: "tenantId", label: "Tenant ID", type: "text" },
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
      { key: "subscriptionId", label: "Subscription ID", type: "text" },
      { key: "resourceGroup", label: "Resource Group", type: "text" },
      { key: "vaultName", label: "Recovery Services Vault Name", type: "text" },
    ],
    instructions:
      "Use the same service principal as your M365 directory sync (or create a new one). Assign the Recovery Services Reader role to the Recovery Services Vault in the Azure portal.",
  },
  manual: {
    label: "Manual",
    badge: "M",
    badgeBg: "bg-gray-500",
    fields: [],
    instructions:
      "Enter job status manually for air-gapped or unsupported backup software. Paste a JSON array of job objects.",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BackupJob["status"], string> = {
  Success: "bg-green-100 text-green-700",
  Warning: "bg-yellow-100 text-yellow-700",
  Failed: "bg-red-100 text-red-700",
  Running: "bg-blue-100 text-blue-700",
  Unknown: "bg-gray-100 text-gray-500",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ProviderBadge({ provider }: { provider: string }) {
  const meta = PROVIDER_META[provider as BackupProvider];
  if (!meta) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-400 text-white text-xs font-bold">
        ?
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${meta.badgeBg} text-white text-xs font-bold`}
    >
      {meta.badge}
    </span>
  );
}

// ─── Connect Provider Modal ───────────────────────────────────────────────────

interface ConnectModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function ConnectModal({ onClose, onSaved }: ConnectModalProps) {
  const [provider, setProvider] = useState<BackupProvider>("veeam");
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [manualJson, setManualJson] = useState(
    '[{"name":"Daily Backup","status":"Success","lastRun":"2024-01-15T02:00:00Z"}]'
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = PROVIDER_META[provider];

  function handleProviderChange(p: BackupProvider) {
    setProvider(p);
    setFields({});
    setError(null);
    setShowInstructions(false);
  }

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    if (!label.trim()) { setError("Label is required"); return; }

    let config: unknown;
    if (provider === "manual") {
      try {
        config = { jobs: JSON.parse(manualJson) };
      } catch {
        setError("Invalid JSON for manual jobs");
        return;
      }
    } else {
      config = fields;
      const missing = meta.fields.filter((f) => !fields[f.key]?.trim());
      if (missing.length > 0) {
        setError(`Missing: ${missing.map((f) => f.label).join(", ")}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/my/backup/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, label: label.trim(), config }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-800">Connect Backup Provider</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
              ×
            </button>
          </div>

          {/* Provider selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_META) as BackupProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    provider === p
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <ProviderBadge provider={p} />
                  {PROVIDER_META[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Friendly Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`e.g. School ${meta.label} Server`}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dynamic fields */}
          {provider !== "manual" ? (
            meta.fields.map((f) => (
              <div key={f.key} className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label} <span className="text-red-500">*</span>
                </label>
                <input
                  type={f.type}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jobs (JSON array) <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={5}
                value={manualJson}
                onChange={(e) => setManualJson(e.target.value)}
                placeholder='[{"name":"Daily Backup","status":"Success","lastRun":"2024-01-15T02:00:00Z"}]'
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Setup instructions (collapsible) */}
          <div className="mb-4">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>{showInstructions ? "▾" : "▸"}</span>
              Setup instructions
            </button>
            {showInstructions && (
              <p className="mt-2 text-xs text-gray-600 bg-blue-50 rounded-lg p-3 leading-relaxed">
                {meta.instructions}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              {saving ? "Saving…" : "Save Connection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const router = useRouter();

  // ── Assessment state
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Backup state
  const [backupConnections, setBackupConnections] = useState<BackupConnection[]>([]);
  const [backupJobs, setBackupJobs] = useState<BackupJob[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null); // connectionId being synced
  const [showConnectModal, setShowConnectModal] = useState(false);

  // ── Directory state
  const [dirConnections, setDirConnections] = useState<DirectoryConnection[]>([]);
  const [adminUsers, setAdminUsers] = useState<DirectoryUser[]>([]);

  const fetchBackup = useCallback(async () => {
    try {
      const res = await fetch("/api/my/backup/sync");
      if (res.ok) {
        const data = (await res.json()) as { connections: BackupConnection[]; jobs: BackupJob[] };
        setBackupConnections(data.connections ?? []);
        setBackupJobs(data.jobs ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchDirectory = useCallback(async () => {
    try {
      const [connsRes, usersRes] = await Promise.all([
        fetch("/api/my/directory/connections"),
        fetch("/api/my/directory/users"),
      ]);
      if (connsRes.ok) {
        setDirConnections((await connsRes.json()) as DirectoryConnection[]);
      }
      if (usersRes.ok) {
        const all = (await usersRes.json()) as DirectoryUser[];
        setAdminUsers(all.filter((u) => u.role === "admin"));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/assessments")
        .then((r) => r.json())
        .then((a: unknown) => {
          const arr = Array.isArray(a) ? (a as Assessment[]) : [];
          setAssessment(arr[0] ?? null);
          setLoading(false);
        }),
      fetchBackup(),
      fetchDirectory(),
    ]);
  }, [fetchBackup, fetchDirectory]);

  async function handleSyncNow(connectionId: string) {
    setSyncing(connectionId);
    try {
      const res = await fetch("/api/my/backup/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        alert(body.error ?? "Sync failed");
      }
    } catch {
      alert("Sync failed");
    } finally {
      setSyncing(null);
      await fetchBackup();
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    if (!confirm("Remove this backup connection and all its job history?")) return;
    await fetch("/api/my/backup/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: connectionId }),
    });
    await fetchBackup();
  }

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
          <p className="text-gray-500 text-sm">
            Your school hasn&apos;t been set up with an assessment. Contact your administrator.
          </p>
        </div>
      </main>
    );
  }

  const answers = JSON.parse(assessment.answers) as Record<string, QuestionStatus>;
  const answered = Object.values(answers).filter((v) => v !== null).length;
  const pct = Math.round((answered / totalQuestions) * 100);
  const overall = calculateScore(answers);

  const ragStyles = {
    green: { bar: "bg-green-500", badge: "bg-green-100 text-green-800 border-green-200", label: "Compliant" },
    amber: { bar: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Needs Work" },
    red: { bar: "bg-red-500", badge: "bg-red-100 text-red-800 border-red-200", label: "At Risk" },
  };
  const rs = ragStyles[overall.rag];

  // Most recent sync across all admin users
  const mostRecentSync = adminUsers.reduce<string | null>((best, u) => {
    if (!best || u.synced_at > best) return u.synced_at;
    return best;
  }, null);

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />

      {showConnectModal && (
        <ConnectModal
          onClose={() => setShowConnectModal(false)}
          onSaved={async () => {
            setShowConnectModal(false);
            await fetchBackup();
          }}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Overall score card */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">IT Compliance</h2>
              <p className="text-sm text-gray-500">
                {answered} of {totalQuestions} questions answered · Last updated{" "}
                {new Date(assessment.updated_at).toLocaleDateString("en-GB")}
              </p>
            </div>
            {answered > 0 && (
              <span className={`text-sm font-medium px-3 py-1 rounded-full border ${rs.badge}`}>
                {rs.label}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${rs.bar}`}
              style={{ width: `${pct}%` }}
            />
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
            <button
              onClick={() => router.push(`/assess/${assessment.id}`)}
              className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              {answered === 0 ? "Start Assessment" : "Continue Assessment"}
            </button>
            {answered > 0 && (
              <button
                onClick={() => router.push(`/report/${assessment.id}`)}
                className="border border-blue-700 text-blue-700 hover:bg-blue-50 px-5 py-2 rounded-lg font-medium text-sm transition-colors"
              >
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
              {frameworks.map((f) => {
                const s = getFrameworkScore(f.id, answers);
                const questionsInF = f.sections.flatMap((sec) => sec.questions).length;
                const answeredInF = f.sections
                  .flatMap((sec) => sec.questions)
                  .filter((q) => answers[q.id] !== undefined && answers[q.id] !== null).length;
                return (
                  <div key={f.id} className="flex items-center gap-3">
                    <div className="w-32 flex-shrink-0">
                      <div className="text-sm font-medium text-gray-700">{f.shortTitle}</div>
                      <div className="text-xs text-gray-400">
                        {answeredInF}/{questionsInF} answered
                      </div>
                    </div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      {s && answeredInF > 0 ? (
                        <div
                          className={`h-full rounded-full ${
                            s.rag === "green"
                              ? "bg-green-500"
                              : s.rag === "amber"
                              ? "bg-yellow-400"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${s.percentage}%` }}
                        />
                      ) : (
                        <div className="h-full" />
                      )}
                    </div>
                    {s && answeredInF > 0 ? (
                      <>
                        <div className="w-10 text-sm font-bold text-right text-gray-700">
                          {s.percentage}%
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full w-20 text-center ${
                            s.rag === "green"
                              ? "bg-green-100 text-green-700"
                              : s.rag === "amber"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {s.rag === "green" ? "Compliant" : s.rag === "amber" ? "Partial" : "At Risk"}
                        </span>
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
            {frameworks.map((f) => (
              <div key={f.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-lg mt-0.5">
                  {f.colour === "blue"
                    ? "🔵"
                    : f.colour === "purple"
                    ? "🟣"
                    : f.colour === "green"
                    ? "🟢"
                    : f.colour === "orange"
                    ? "🟠"
                    : f.colour === "red"
                    ? "🔴"
                    : "🟡"}
                </span>
                <div>
                  <div className="font-medium text-gray-800 text-sm">{f.shortTitle}</div>
                  <div className="text-xs text-gray-500">{f.description.slice(0, 90)}…</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Backup Status ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Backup Status</h3>
            <button
              onClick={() => setShowConnectModal(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              + Connect Provider
            </button>
          </div>

          {backupConnections.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">💾</div>
              <p className="text-gray-500 text-sm mb-4">No backup providers connected yet.</p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Connect Backup Provider
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {backupConnections.map((conn) => {
                const jobs = backupJobs.filter((j) => j.connection_id === conn.id);
                const isSyncing = syncing === conn.id;
                return (
                  <div key={conn.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Connection header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <ProviderBadge provider={conn.provider} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 text-sm truncate">{conn.label}</div>
                        <div className="text-xs text-gray-400">
                          {conn.last_polled
                            ? `Last synced ${fmtDate(conn.last_polled)}`
                            : "Never synced"}
                        </div>
                        {conn.last_error && (
                          <div className="text-xs text-red-600 mt-0.5 truncate">{conn.last_error}</div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleSyncNow(conn.id)}
                          disabled={isSyncing}
                          className="text-sm px-3 py-1 rounded-lg border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                        >
                          {isSyncing ? "Syncing…" : "Sync Now"}
                        </button>
                        <button
                          onClick={() => handleDeleteConnection(conn.id)}
                          className="text-sm px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Job rows */}
                    {jobs.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-gray-400 italic">
                        No job data yet — click Sync Now to fetch results.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {jobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-700 truncate">
                                {job.job_name}
                              </div>
                              {job.job_type && (
                                <div className="text-xs text-gray-400">{job.job_type}</div>
                              )}
                            </div>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                STATUS_STYLES[job.status]
                              }`}
                            >
                              {job.status}
                            </span>
                            <div className="text-xs text-gray-400 w-32 text-right hidden sm:block">
                              {fmtDate(job.started_at)}
                            </div>
                            {job.size_gb !== null && (
                              <div className="text-xs text-gray-500 w-16 text-right hidden md:block">
                                {job.size_gb.toFixed(1)} GB
                              </div>
                            )}
                            {job.error_message && (
                              <div
                                className="text-xs text-red-500 truncate max-w-[12rem]"
                                title={job.error_message}
                              >
                                {job.error_message}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Privileged Accounts ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">Privileged Accounts Register</h3>
            <button
              onClick={() => router.push("/directory")}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Refresh Directory
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Administrator accounts pulled from your connected directories. Review regularly to ensure
            only authorised staff hold elevated access.
          </p>

          {dirConnections.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">🔒</div>
              <p className="text-gray-500 text-sm mb-4">
                No directory connected. Connect a directory to automatically discover admin accounts.
              </p>
              <button
                onClick={() => router.push("/directory")}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Connect Directory
              </button>
            </div>
          ) : adminUsers.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 rounded-lg">
              <span className="text-green-600 font-bold">✓</span>
              <span className="text-sm text-green-700">No privileged accounts found in synced directories.</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Email</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Source</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Last Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adminUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{u.display_name}</td>
                        <td className="px-4 py-2.5 text-gray-600">{u.email ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {u.provider === "microsoft" ? (
                            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                              M365
                            </span>
                          ) : u.provider === "google" ? (
                            <span className="inline-block bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                              Google
                            </span>
                          ) : (
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                              {u.provider}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400">{fmtDate(u.synced_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mostRecentSync && (
                <p className="text-xs text-gray-400 mt-2">
                  Last synced: {fmtDate(mostRecentSync)}
                </p>
              )}
            </>
          )}
        </div>

      </div>
    </main>
  );
}
