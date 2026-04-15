"use client";

import { useState, useEffect } from "react";
import UserNav from "@/components/UserNav";

interface Contract {
  id: string;
  school_id: string;
  name: string;
  supplier: string | null;
  type: string | null;
  start_date: string | null;
  end_date: string | null;
  value: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  auto_renew: number;
  notes: string | null;
}

const CONTRACT_TYPES = [
  "IT Support", "Broadband / Connectivity", "Software Licence", "Hardware Maintenance",
  "Cloud Services", "Cyber Security", "Data Protection / DPO", "Phone System",
  "Photocopier / Print", "CCTV / Security", "Website Hosting", "Other",
];

const EMPTY_CONTRACT: Omit<Contract, "id" | "school_id"> = {
  name: "", supplier: "", type: "", start_date: "", end_date: "",
  value: "", contact_name: "", contact_email: "", contact_phone: "",
  auto_renew: 0, notes: "",
};

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-gray-300 text-xs">—</span>;
  const days = daysUntil(dateStr);
  if (days === null) return null;
  const label = new Date(dateStr).toLocaleDateString("en-GB");
  if (days < 0)
    return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{label} (Expired)</span>;
  if (days <= 30)
    return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{label} ({days}d)</span>;
  if (days <= 90)
    return <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">{label} ({days}d)</span>;
  return <span className="text-xs text-gray-600">{label}</span>;
}

export default function UserContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Omit<Contract, "id" | "school_id">>(EMPTY_CONTRACT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const rows = await fetch("/api/my/contracts").then(r => r.json());
    setContracts(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() { setForm({ ...EMPTY_CONTRACT }); setEditingId("new"); setError(""); }

  function startEdit(c: Contract) {
    setForm({
      name: c.name ?? "", supplier: c.supplier ?? "", type: c.type ?? "",
      start_date: c.start_date ?? "", end_date: c.end_date ?? "",
      value: c.value ?? "", contact_name: c.contact_name ?? "",
      contact_email: c.contact_email ?? "", contact_phone: c.contact_phone ?? "",
      auto_renew: c.auto_renew ?? 0, notes: c.notes ?? "",
    });
    setEditingId(c.id); setError("");
  }

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const isNew = editingId === "new";
    const body = isNew ? form : { id: editingId, ...form };
    const res = await fetch("/api/my/contracts", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return; }
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete contract "${name}"?`)) return;
    await fetch("/api/my/contracts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const expiringSoon = contracts.filter(c => { const d = daysUntil(c.end_date); return d !== null && d >= 0 && d <= 90; }).length;
  const expired = contracts.filter(c => { const d = daysUntil(c.end_date); return d !== null && d < 0; }).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-800">{contracts.length}</div>
            <div className="text-sm text-gray-500">Total Contracts</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${expiringSoon > 0 ? "text-yellow-600" : "text-green-700"}`}>{expiringSoon}</div>
            <div className="text-sm text-gray-500">Expiring in 90 Days</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${expired > 0 ? "text-red-600" : "text-gray-400"}`}>{expired}</div>
            <div className="text-sm text-gray-500">Expired</div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-800 text-lg">Contracts</h2>
          <button onClick={startNew}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Add Contract
          </button>
        </div>

        {/* Add / Edit form */}
        {editingId !== null && (
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
            <h3 className="font-semibold text-gray-800 mb-4">{editingId === "new" ? "New Contract" : "Edit Contract"}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contract Name *</label>
                  <input type="text" value={form.name} onChange={set("name")} required placeholder="e.g. IT Support Agreement"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contract Type</label>
                  <select value={form.type ?? ""} onChange={set("type")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select type —</option>
                    {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Supplier</label>
                  <input type="text" value={form.supplier ?? ""} onChange={set("supplier")} placeholder="e.g. Acme IT Ltd"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Annual Value</label>
                  <input type="text" value={form.value ?? ""} onChange={set("value")} placeholder="e.g. £1,200/yr"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input type="date" value={form.start_date ?? ""} onChange={set("start_date")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End / Renewal Date</label>
                  <input type="date" value={form.end_date ?? ""} onChange={set("end_date")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" id="auto_renew" checked={!!form.auto_renew}
                    onChange={e => setForm(f => ({ ...f, auto_renew: e.target.checked ? 1 : 0 }))} className="rounded" />
                  <label htmlFor="auto_renew" className="text-sm text-gray-600">Auto-renews</label>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Supplier Contact</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
                    <input type="text" value={form.contact_name ?? ""} onChange={set("contact_name")} placeholder="e.g. Support Desk"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input type="email" value={form.contact_email ?? ""} onChange={set("contact_email")} placeholder="e.g. support@acme.co.uk"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input type="tel" value={form.contact_phone ?? ""} onChange={set("contact_phone")} placeholder="e.g. 0800 123 4567"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes ?? ""} onChange={set("notes")} rows={2} placeholder="Any additional notes…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                  {saving ? "Saving…" : "Save Contract"}
                </button>
                <button type="button" onClick={() => setEditingId(null)}
                  className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : contracts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No contracts yet. Click <strong>+ Add Contract</strong> to get started.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contracts.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{c.name}</div>
                      {c.auto_renew ? <span className="text-xs text-blue-600">Auto-renews</span> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.type ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{c.supplier ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{c.value ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.start_date ? new Date(c.start_date).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-3"><ExpiryBadge dateStr={c.end_date} /></td>
                    <td className="px-4 py-3">
                      {c.contact_name && <div className="text-xs text-gray-700 font-medium">{c.contact_name}</div>}
                      {c.contact_email && <div className="text-xs text-gray-500">{c.contact_email}</div>}
                      {c.contact_phone && <div className="text-xs text-gray-500">{c.contact_phone}</div>}
                      {!c.contact_name && !c.contact_email && !c.contact_phone && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => startEdit(c)} className="text-blue-500 hover:text-blue-700 text-xs font-medium mr-3">Edit</button>
                      <button onClick={() => handleDelete(c.id, c.name)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
