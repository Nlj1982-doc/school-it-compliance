"use client";

import { useState, useEffect } from "react";
import UserNav from "@/components/UserNav";

interface Loan {
  id: string;
  borrower_name: string;
  borrower_type: string;
  borrower_group: string | null;
  equipment: string;
  asset_tag: string | null;
  date_out: string;
  date_due: string | null;
  date_returned: string | null;
  condition_out: string | null;
  condition_in: string | null;
  authorised_by: string | null;
  notes: string | null;
  created_at: string;
}

const BORROWER_TYPES = ["Student", "Staff", "Other"];
const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"];

const EMPTY: Omit<Loan, "id" | "created_at"> = {
  borrower_name: "", borrower_type: "Student", borrower_group: "",
  equipment: "", asset_tag: "", date_out: new Date().toISOString().slice(0, 10),
  date_due: "", date_returned: "", condition_out: "Good", condition_in: "",
  authorised_by: "", notes: "",
};

function loanStatus(loan: Loan): "Returned" | "Overdue" | "On Loan" {
  if (loan.date_returned) return "Returned";
  if (loan.date_due && new Date(loan.date_due) < new Date()) return "Overdue";
  return "On Loan";
}

function StatusBadge({ loan }: { loan: Loan }) {
  const s = loanStatus(loan);
  const styles = {
    Returned: "bg-green-100 text-green-700",
    Overdue: "bg-red-100 text-red-700",
    "On Loan": "bg-blue-100 text-blue-700",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[s]}`}>{s}</span>;
}

// Quick return modal state
interface ReturnState { loanId: string; date: string; condition: string; }

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [returnState, setReturnState] = useState<ReturnState | null>(null);

  async function load() {
    const rows = await fetch("/api/my/loans").then(r => r.json());
    setLoans(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startNew() {
    setForm({ ...EMPTY, date_out: new Date().toISOString().slice(0, 10) });
    setEditingId("new"); setError("");
  }
  function startEdit(l: Loan) {
    setForm({
      borrower_name: l.borrower_name, borrower_type: l.borrower_type,
      borrower_group: l.borrower_group ?? "", equipment: l.equipment,
      asset_tag: l.asset_tag ?? "", date_out: l.date_out,
      date_due: l.date_due ?? "", date_returned: l.date_returned ?? "",
      condition_out: l.condition_out ?? "Good", condition_in: l.condition_in ?? "",
      authorised_by: l.authorised_by ?? "", notes: l.notes ?? "",
    });
    setEditingId(l.id); setError("");
  }
  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const isNew = editingId === "new";
    const body = {
      ...form,
      date_due: form.date_due || null,
      date_returned: form.date_returned || null,
      condition_in: form.condition_in || null,
    };
    const res = await fetch("/api/my/loans", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? body : { id: editingId, ...body }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to save"); return; }
    setEditingId(null); load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete loan for "${name}"?`)) return;
    await fetch("/api/my/loans", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    load();
  }

  async function handleReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnState) return;
    const loan = loans.find(l => l.id === returnState.loanId);
    if (!loan) return;
    await fetch("/api/my/loans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...loan,
        id: loan.id,
        date_returned: returnState.date,
        condition_in: returnState.condition || null,
      }),
    });
    setReturnState(null);
    load();
  }

  const filtered = loans.filter(l => {
    if (filterStatus === "active") return !l.date_returned;
    if (filterStatus === "overdue") return loanStatus(l) === "Overdue";
    if (filterStatus === "returned") return !!l.date_returned;
    return true;
  });

  const onLoan = loans.filter(l => !l.date_returned).length;
  const overdue = loans.filter(l => loanStatus(l) === "Overdue").length;
  const returned = loans.filter(l => !!l.date_returned).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${onLoan > 0 ? "text-blue-700" : "text-gray-400"}`}>{onLoan}</div>
            <div className="text-sm text-gray-500">Currently on Loan</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${overdue > 0 ? "text-red-600" : "text-gray-400"}`}>{overdue}</div>
            <div className="text-sm text-gray-500">Overdue</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-700">{returned}</div>
            <div className="text-sm text-gray-500">Returned</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div className="flex gap-1 bg-white border rounded-lg p-1 shadow-sm">
            {[
              { value: "active", label: "Active" },
              { value: "overdue", label: "Overdue" },
              { value: "returned", label: "Returned" },
              { value: "", label: "All" },
            ].map(opt => (
              <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filterStatus === opt.value ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={startNew} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + New Loan
          </button>
        </div>

        {/* Form */}
        {editingId !== null && (
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
            <h3 className="font-semibold text-gray-800 mb-4">{editingId === "new" ? "New Equipment Loan" : "Edit Loan"}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Borrower Name *</label>
                  <input type="text" value={form.borrower_name} onChange={set("borrower_name")} required placeholder="e.g. James Smith"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={form.borrower_type} onChange={set("borrower_type")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {BORROWER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year / Class / Dept</label>
                  <input type="text" value={form.borrower_group ?? ""} onChange={set("borrower_group")} placeholder="e.g. Year 6 / 6B"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Equipment Description *</label>
                  <input type="text" value={form.equipment} onChange={set("equipment")} required placeholder="e.g. Dell Laptop, iPad, Keyboard"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Asset Tag</label>
                  <input type="text" value={form.asset_tag ?? ""} onChange={set("asset_tag")} placeholder="e.g. LT-012"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Authorised By</label>
                  <input type="text" value={form.authorised_by ?? ""} onChange={set("authorised_by")} placeholder="e.g. Mrs Jones"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date Out *</label>
                  <input type="date" value={form.date_out} onChange={set("date_out")} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expected Return Date</label>
                  <input type="date" value={form.date_due ?? ""} onChange={set("date_due")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Condition Out</label>
                  <select value={form.condition_out ?? ""} onChange={set("condition_out")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date Returned</label>
                  <input type="date" value={form.date_returned ?? ""} onChange={set("date_returned")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Condition In</label>
                  <select value={form.condition_in ?? ""} onChange={set("condition_in")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes ?? ""} onChange={set("notes")} rows={2} placeholder="Any additional notes…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving…" : "Save Loan"}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Loans table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {loans.length === 0 ? "No loans recorded yet. Click + New Loan to get started." : "No loans match the current filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 text-left text-xs">
                    <th className="px-4 py-3 font-medium">Borrower</th>
                    <th className="px-4 py-3 font-medium">Equipment</th>
                    <th className="px-4 py-3 font-medium">Date Out</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">Returned</th>
                    <th className="px-4 py-3 font-medium">Condition</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(l => (
                    <tr key={l.id} className={`hover:bg-gray-50 ${loanStatus(l) === "Overdue" ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{l.borrower_name}</div>
                        <div className="text-xs text-gray-400">{l.borrower_type}{l.borrower_group ? ` · ${l.borrower_group}` : ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{l.equipment}</div>
                        {l.asset_tag && <div className="text-xs font-mono text-gray-400">{l.asset_tag}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{new Date(l.date_out).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {l.date_due ? (
                          <span className={loanStatus(l) === "Overdue" ? "text-red-600 font-medium" : ""}>
                            {new Date(l.date_due).toLocaleDateString("en-GB")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{l.date_returned ? new Date(l.date_returned).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-gray-500">{l.condition_out ?? "—"}</div>
                        {l.condition_in && <div className="text-gray-500">→ {l.condition_in}</div>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge loan={l} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!l.date_returned && (
                          <button onClick={() => setReturnState({ loanId: l.id, date: new Date().toISOString().slice(0, 10), condition: "" })}
                            className="text-green-600 hover:text-green-800 text-xs font-medium mr-3">
                            Mark Returned
                          </button>
                        )}
                        <button onClick={() => startEdit(l)} className="text-blue-500 hover:text-blue-700 text-xs font-medium mr-3">Edit</button>
                        <button onClick={() => handleDelete(l.id, l.borrower_name)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > 0 && <p className="text-xs text-gray-400 text-right mt-2">{filtered.length} loan{filtered.length !== 1 ? "s" : ""}</p>}
      </div>

      {/* Mark Returned modal */}
      {returnState && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Mark as Returned</h3>
            <form onSubmit={handleReturn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                <input type="date" value={returnState.date}
                  onChange={e => setReturnState(s => s ? { ...s, date: e.target.value } : s)}
                  required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition on Return</label>
                <select value={returnState.condition}
                  onChange={e => setReturnState(s => s ? { ...s, condition: e.target.value } : s)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select —</option>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg text-sm font-medium">
                  Confirm Return
                </button>
                <button type="button" onClick={() => setReturnState(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
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
