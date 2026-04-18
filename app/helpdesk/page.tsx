"use client";

import { useState, useEffect } from "react";
import UserNav from "@/components/UserNav";

interface Ticket {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

interface Me {
  role: string;
  canHelpdesk: boolean;
}

const CATEGORIES = ["Hardware", "Software", "Network / Connectivity", "Account / Access", "Printing", "Interactive Display", "Email", "Other"];
const PRIORITIES = ["Low", "Normal", "High", "Critical"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Normal: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};
const STATUS_STYLES: Record<string, string> = {
  Open: "bg-yellow-100 text-yellow-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Resolved: "bg-green-100 text-green-700",
  Closed: "bg-gray-100 text-gray-500",
};

const MANAGER_EMPTY = { title: "", description: "", category: "", priority: "Normal", status: "Open", assigned_to: "", resolution: "" };
const USER_EMPTY = { title: "", description: "", category: "", priority: "Normal" };

export default function HelpdeskPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [managerForm, setManagerForm] = useState({ ...MANAGER_EMPTY });
  const [userForm, setUserForm] = useState({ ...USER_EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    const [meData, rows] = await Promise.all([
      fetch("/api/auth/me").then(r => r.json()),
      fetch("/api/my/helpdesk").then(r => r.json()),
    ]);
    setMe(meData.user);
    setTickets(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const isManager = me?.role === "admin" || me?.canHelpdesk;

  // Manager form helpers
  function mSet(field: keyof typeof MANAGER_EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setManagerForm(f => ({ ...f, [field]: e.target.value }));
  }
  function uSet(field: keyof typeof USER_EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setUserForm(f => ({ ...f, [field]: e.target.value }));
  }

  function startNew() {
    setManagerForm({ ...MANAGER_EMPTY }); setUserForm({ ...USER_EMPTY });
    setEditingId("new"); setError(""); setExpandedId(null);
  }
  function startEdit(t: Ticket) {
    setManagerForm({
      title: t.title, description: t.description ?? "", category: t.category ?? "",
      priority: t.priority, status: t.status, assigned_to: t.assigned_to ?? "", resolution: t.resolution ?? "",
    });
    setEditingId(t.id); setError(""); setExpandedId(null);
  }
  function cancelForm() { setEditingId(null); setShowForm(false); setError(""); }

  async function handleManagerSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const isNew = editingId === "new";
    const res = await fetch("/api/my/helpdesk", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? managerForm : { id: editingId, ...managerForm }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to save"); return; }
    setEditingId(null); load();
  }

  async function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const res = await fetch("/api/my/helpdesk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to submit"); return; }
    setShowForm(false); setUserForm({ ...USER_EMPTY }); load();
  }

  async function handleStatusChange(ticket: Ticket, newStatus: string) {
    await fetch("/api/my/helpdesk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ticket, id: ticket.id, status: newStatus }),
    });
    load();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete ticket "${title}"?`)) return;
    await fetch("/api/my/helpdesk", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    load();
  }

  const filtered = tickets.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const open = tickets.filter(t => t.status === "Open").length;
  const inProgress = tickets.filter(t => t.status === "In Progress").length;
  const resolved = tickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header + role badge */}
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-xl font-bold text-gray-800">Helpdesk</h2>
          {isManager ? (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Manager View</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">My Tickets</span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${open > 0 ? "text-yellow-600" : "text-gray-400"}`}>{open}</div>
            <div className="text-sm text-gray-500">Open</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${inProgress > 0 ? "text-blue-600" : "text-gray-400"}`}>{inProgress}</div>
            <div className="text-sm text-gray-500">In Progress</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-700">{resolved}</div>
            <div className="text-sm text-gray-500">Resolved / Closed</div>
          </div>
        </div>

        {/* ── MANAGER VIEW ── */}
        {isManager && (
          <>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
              <div className="flex gap-2 flex-wrap">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Priorities</option>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <button onClick={startNew} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
                + New Ticket
              </button>
            </div>

            {/* Manager form */}
            {editingId !== null && (
              <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
                <h3 className="font-semibold text-gray-800 mb-4">{editingId === "new" ? "New Ticket" : "Edit Ticket"}</h3>
                <form onSubmit={handleManagerSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                    <input type="text" value={managerForm.title} onChange={mSet("title")} required placeholder="Brief description of the issue"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <select value={managerForm.category} onChange={mSet("category")}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">— Select —</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                      <select value={managerForm.priority} onChange={mSet("priority")}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select value={managerForm.status} onChange={mSet("status")}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                      <input type="text" value={managerForm.assigned_to} onChange={mSet("assigned_to")} placeholder="e.g. IT Support"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <textarea value={managerForm.description} onChange={mSet("description")} rows={3} placeholder="Full details of the issue…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {(managerForm.status === "Resolved" || managerForm.status === "Closed") && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Resolution Notes</label>
                      <textarea value={managerForm.resolution} onChange={mSet("resolution")} rows={2} placeholder="How was this resolved?"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  )}
                  {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {saving ? "Saving…" : "Save Ticket"}
                    </button>
                    <button type="button" onClick={cancelForm} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Manager ticket list */}
            <div className="space-y-2">
              {loading ? (
                <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
                  {tickets.length === 0 ? "No tickets yet." : "No tickets match your filters."}
                </div>
              ) : filtered.map(t => (
                <div key={t.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_STYLES[t.priority] ?? "bg-gray-100"}`}>{t.priority}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{t.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {t.category && <span className="mr-2">{t.category}</span>}
                        {t.created_by} · {new Date(t.created_at).toLocaleDateString("en-GB")}
                      </div>
                    </div>
                    {t.assigned_to && <span className="text-xs text-gray-400 hidden sm:block">{t.assigned_to}</span>}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[t.status] ?? "bg-gray-100"}`}>{t.status}</span>
                    <span className="text-gray-400 text-xs">{expandedId === t.id ? "▲" : "▼"}</span>
                  </div>
                  {expandedId === t.id && (
                    <div className="border-t px-4 py-4 bg-gray-50 space-y-3">
                      {t.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.description}</p>}
                      {t.assigned_to && <p className="text-xs text-gray-500">Assigned to: <span className="font-medium text-gray-700">{t.assigned_to}</span></p>}
                      {t.resolution && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="text-xs font-semibold text-green-700 mb-1">Resolution</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.resolution}</p>
                        </div>
                      )}
                      <div className="text-xs text-gray-400">Updated {new Date(t.updated_at).toLocaleDateString("en-GB")}</div>
                      <div className="flex flex-wrap gap-2 pt-1 border-t">
                        <span className="text-xs text-gray-500 self-center">Move to:</span>
                        {STATUSES.filter(s => s !== t.status).map(s => (
                          <button key={s} onClick={() => handleStatusChange(t, s)}
                            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${STATUS_STYLES[s] ?? "bg-gray-100"} hover:opacity-80`}>{s}</button>
                        ))}
                        <div className="flex-1" />
                        <button onClick={() => startEdit(t)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
                        <button onClick={() => handleDelete(t.id, t.title)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {filtered.length > 0 && <p className="text-xs text-gray-400 text-right mt-2">{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</p>}
          </>
        )}

        {/* ── USER VIEW ── */}
        {!isManager && me !== null && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Submit IT support requests. Your tickets are visible to the IT team.</p>
              <button onClick={() => { setShowForm(true); setError(""); setUserForm({ ...USER_EMPTY }); }}
                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
                + New Request
              </button>
            </div>

            {/* User submission form */}
            {showForm && (
              <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
                <h3 className="font-semibold text-gray-800 mb-4">New IT Support Request</h3>
                <form onSubmit={handleUserSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Issue Summary *</label>
                    <input type="text" value={userForm.title} onChange={uSet("title")} required placeholder="e.g. Projector not working in Room 5"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <select value={userForm.category} onChange={uSet("category")}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">— Select —</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                      <select value={userForm.priority} onChange={uSet("priority")}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Details</label>
                    <textarea value={userForm.description} onChange={uSet("description")} rows={3}
                      placeholder="Please describe the issue in detail — what happened, what you were doing, any error messages…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {saving ? "Submitting…" : "Submit Request"}
                    </button>
                    <button type="button" onClick={cancelForm} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* User ticket list — read-only status */}
            <div className="space-y-2">
              {loading ? (
                <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Loading…</div>
              ) : tickets.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center">
                  <div className="text-gray-300 text-4xl mb-3">🎫</div>
                  <p className="text-gray-500 font-medium">No requests yet</p>
                  <p className="text-gray-400 text-sm mt-1">Click + New Request to report an issue to the IT team.</p>
                </div>
              ) : tickets.map(t => (
                <div key={t.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_STYLES[t.priority] ?? "bg-gray-100"}`}>{t.priority}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{t.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {t.category && <span className="mr-2">{t.category}</span>}
                        Submitted {new Date(t.created_at).toLocaleDateString("en-GB")}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[t.status] ?? "bg-gray-100"}`}>{t.status}</span>
                    <span className="text-gray-400 text-xs">{expandedId === t.id ? "▲" : "▼"}</span>
                  </div>
                  {expandedId === t.id && (
                    <div className="border-t px-4 py-4 bg-gray-50 space-y-3">
                      {t.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.description}</p>}
                      {t.assigned_to && (
                        <p className="text-xs text-gray-500">Being handled by: <span className="font-medium text-gray-700">{t.assigned_to}</span></p>
                      )}
                      {t.resolution && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="text-xs font-semibold text-green-700 mb-1">Resolution</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.resolution}</p>
                        </div>
                      )}
                      <div className="text-xs text-gray-400">Last updated {new Date(t.updated_at).toLocaleDateString("en-GB")}</div>
                      <div className="flex justify-end pt-1 border-t">
                        <button onClick={() => handleDelete(t.id, t.title)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {tickets.length > 0 && <p className="text-xs text-gray-400 text-right mt-2">{tickets.length} request{tickets.length !== 1 ? "s" : ""}</p>}
          </>
        )}
      </div>
    </main>
  );
}
