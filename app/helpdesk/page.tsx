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

const CATEGORIES = ["Hardware", "Software", "Network / Connectivity", "Account / Access", "Printing", "Interactive Display", "Email", "Other"];
const PRIORITIES = ["Low", "Normal", "High", "Critical"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

const EMPTY: Omit<Ticket, "id" | "created_by" | "created_at" | "updated_at"> = {
  title: "", description: "", category: "", priority: "Normal",
  status: "Open", assigned_to: "", resolution: "",
};

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

export default function HelpdeskPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    const rows = await fetch("/api/my/helpdesk").then(r => r.json());
    setTickets(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setForm({ ...EMPTY }); setEditingId("new"); setError(""); setExpandedId(null); }
  function startEdit(t: Ticket) {
    setForm({
      title: t.title, description: t.description ?? "", category: t.category ?? "",
      priority: t.priority, status: t.status, assigned_to: t.assigned_to ?? "", resolution: t.resolution ?? "",
    });
    setEditingId(t.id); setError(""); setExpandedId(null);
  }
  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const isNew = editingId === "new";
    const res = await fetch("/api/my/helpdesk", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? form : { id: editingId, ...form }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to save"); return; }
    setEditingId(null); load();
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

        {/* Form */}
        {editingId !== null && (
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
            <h3 className="font-semibold text-gray-800 mb-4">{editingId === "new" ? "New Ticket" : "Edit Ticket"}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={set("title")} required placeholder="Brief description of the issue"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={form.category ?? ""} onChange={set("category")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select value={form.priority} onChange={set("priority")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={set("status")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                  <input type="text" value={form.assigned_to ?? ""} onChange={set("assigned_to")} placeholder="e.g. IT Support"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea value={form.description ?? ""} onChange={set("description")} rows={3} placeholder="Full details of the issue…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {(form.status === "Resolved" || form.status === "Closed") && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Resolution Notes</label>
                  <textarea value={form.resolution ?? ""} onChange={set("resolution")} rows={2} placeholder="How was this resolved?"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving…" : "Save Ticket"}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Ticket list */}
        <div className="space-y-2">
          {loading ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
              {tickets.length === 0 ? "No tickets yet. Click + New Ticket to log an issue." : "No tickets match your filters."}
            </div>
          ) : filtered.map(t => (
            <div key={t.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Ticket header row */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_STYLES[t.priority] ?? "bg-gray-100 text-gray-600"}`}>{t.priority}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">{t.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.category && <span className="mr-2">{t.category}</span>}
                    Opened {new Date(t.created_at).toLocaleDateString("en-GB")} by {t.created_by}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[t.status] ?? "bg-gray-100 text-gray-500"}`}>{t.status}</span>
                <span className="text-gray-400 text-xs">{expandedId === t.id ? "▲" : "▼"}</span>
              </div>

              {/* Expanded detail */}
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

                  {/* Quick status change */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t">
                    <span className="text-xs text-gray-500 self-center">Move to:</span>
                    {STATUSES.filter(s => s !== t.status).map(s => (
                      <button key={s} onClick={() => handleStatusChange(t, s)}
                        className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${STATUS_STYLES[s] ?? "bg-gray-100 text-gray-600"} hover:opacity-80`}>{s}</button>
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
      </div>
    </main>
  );
}
