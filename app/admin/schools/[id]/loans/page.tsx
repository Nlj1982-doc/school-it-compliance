"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import SchoolNav from "@/components/SchoolNav";

// ── Types ──────────────────────────────────────────────────────────────────

interface PoolItem {
  id: string;
  name: string;
  device_type: string | null;
  asset_tag: string | null;
  serial_number: string | null;
  make: string | null;
  model: string | null;
  notes: string | null;
}

interface Loan {
  id: string;
  pool_item_id: string | null;
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

// ── Constants ──────────────────────────────────────────────────────────────

const DEVICE_TYPES = ["Laptop", "Chromebook", "iPad / Tablet", "MacBook", "Camera", "Hotspot", "Other"];
const BORROWER_TYPES = ["Student", "Staff", "Other"];
const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"];

const POOL_EMPTY = { name: "", device_type: "", asset_tag: "", serial_number: "", make: "", model: "", notes: "" };
const LOAN_EMPTY = {
  pool_item_id: null as string | null,
  borrower_name: "", borrower_type: "Student", borrower_group: "",
  equipment: "", asset_tag: "",
  date_out: new Date().toISOString().slice(0, 10),
  date_due: "", date_returned: "", condition_out: "Good", condition_in: "",
  authorised_by: "", notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function loanStatus(loan: Loan): "Returned" | "Overdue" | "On Loan" {
  if (loan.date_returned) return "Returned";
  if (loan.date_due && new Date(loan.date_due) < new Date()) return "Overdue";
  return "On Loan";
}

function poolStatus(item: PoolItem, loans: Loan[]): { status: "Available" | "On Loan" | "Overdue"; loan: Loan | null } {
  const active = loans.find(l => l.pool_item_id === item.id && !l.date_returned) ?? null;
  if (!active) return { status: "Available", loan: null };
  return { status: loanStatus(active) === "Overdue" ? "Overdue" : "On Loan", loan: active };
}

function StatusBadge({ loan }: { loan: Loan }) {
  const s = loanStatus(loan);
  const styles = { Returned: "bg-green-100 text-green-700", Overdue: "bg-red-100 text-red-700", "On Loan": "bg-blue-100 text-blue-700" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[s]}`}>{s}</span>;
}

interface ReturnState { loanId: string; date: string; condition: string; }

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminLoansPage() {
  const params = useParams();
  const schoolId = params.id as string;

  const [schoolName, setSchoolName] = useState("");
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pool" | "history">("pool");

  const [poolEditId, setPoolEditId] = useState<string | "new" | null>(null);
  const [poolForm, setPoolForm] = useState({ ...POOL_EMPTY });
  const [poolSaving, setPoolSaving] = useState(false);
  const [poolError, setPoolError] = useState("");

  const [loanOutState, setLoanOutState] = useState<typeof LOAN_EMPTY | null>(null);
  const [loanOutSaving, setLoanOutSaving] = useState(false);
  const [loanOutError, setLoanOutError] = useState("");

  const [editingLoanId, setEditingLoanId] = useState<string | "new" | null>(null);
  const [loanForm, setLoanForm] = useState({ ...LOAN_EMPTY });
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanError, setLoanError] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [returnState, setReturnState] = useState<ReturnState | null>(null);

  async function load() {
    const [school, p, l] = await Promise.all([
      fetch(`/api/admin/schools/${schoolId}`).then(r => r.json()),
      fetch(`/api/admin/schools/${schoolId}/loan-pool`).then(r => r.json()),
      fetch(`/api/admin/schools/${schoolId}/loans`).then(r => r.json()),
    ]);
    setSchoolName(school?.name ?? "");
    setPool(Array.isArray(p) ? p : []);
    setLoans(Array.isArray(l) ? l : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [schoolId]);

  // ── Pool CRUD ──

  function pSet(field: keyof typeof POOL_EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setPoolForm(f => ({ ...f, [field]: e.target.value }));
  }
  function startNewPoolItem() { setPoolForm({ ...POOL_EMPTY }); setPoolEditId("new"); setPoolError(""); }
  function startEditPoolItem(item: PoolItem) {
    setPoolForm({ name: item.name, device_type: item.device_type ?? "", asset_tag: item.asset_tag ?? "",
      serial_number: item.serial_number ?? "", make: item.make ?? "", model: item.model ?? "", notes: item.notes ?? "" });
    setPoolEditId(item.id); setPoolError("");
  }
  async function handlePoolSave(e: React.FormEvent) {
    e.preventDefault(); setPoolSaving(true); setPoolError("");
    const isNew = poolEditId === "new";
    const res = await fetch(`/api/admin/schools/${schoolId}/loan-pool`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? poolForm : { id: poolEditId, ...poolForm }),
    });
    setPoolSaving(false);
    if (!res.ok) { setPoolError((await res.json()).error ?? "Failed to save"); return; }
    setPoolEditId(null); load();
  }
  async function handlePoolDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the equipment pool?`)) return;
    const res = await fetch(`/api/admin/schools/${schoolId}/loan-pool`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    if (!res.ok) { alert((await res.json()).error ?? "Cannot delete"); return; }
    load();
  }

  // ── Loan Out ──

  function startLoanOut(item: PoolItem) {
    setLoanOutState({ ...LOAN_EMPTY,
      pool_item_id: item.id,
      equipment: [item.device_type, item.make, item.model, item.name].filter(Boolean).join(" ") || item.name,
      asset_tag: item.asset_tag ?? "",
      date_out: new Date().toISOString().slice(0, 10),
    });
    setLoanOutError("");
  }
  function loSet(field: keyof typeof LOAN_EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setLoanOutState(s => s ? { ...s, [field]: e.target.value } : s);
  }
  async function handleLoanOut(e: React.FormEvent) {
    e.preventDefault();
    if (!loanOutState) return;
    setLoanOutSaving(true); setLoanOutError("");
    const body = { ...loanOutState, date_due: loanOutState.date_due || null, date_returned: loanOutState.date_returned || null, condition_in: loanOutState.condition_in || null };
    const res = await fetch(`/api/admin/schools/${schoolId}/loans`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setLoanOutSaving(false);
    if (!res.ok) { setLoanOutError((await res.json()).error ?? "Failed"); return; }
    setLoanOutState(null); load();
  }

  // ── History CRUD ──

  function lSet(field: keyof typeof LOAN_EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setLoanForm(f => ({ ...f, [field]: e.target.value }));
  }
  function startNewLoan() { setLoanForm({ ...LOAN_EMPTY, date_out: new Date().toISOString().slice(0, 10) }); setEditingLoanId("new"); setLoanError(""); }
  function startEditLoan(l: Loan) {
    setLoanForm({ pool_item_id: l.pool_item_id, borrower_name: l.borrower_name, borrower_type: l.borrower_type,
      borrower_group: l.borrower_group ?? "", equipment: l.equipment, asset_tag: l.asset_tag ?? "",
      date_out: l.date_out, date_due: l.date_due ?? "", date_returned: l.date_returned ?? "",
      condition_out: l.condition_out ?? "Good", condition_in: l.condition_in ?? "",
      authorised_by: l.authorised_by ?? "", notes: l.notes ?? "" });
    setEditingLoanId(l.id); setLoanError("");
  }
  async function handleLoanSave(e: React.FormEvent) {
    e.preventDefault(); setLoanSaving(true); setLoanError("");
    const isNew = editingLoanId === "new";
    const body = { ...loanForm, date_due: loanForm.date_due || null, date_returned: loanForm.date_returned || null, condition_in: loanForm.condition_in || null };
    const res = await fetch(`/api/admin/schools/${schoolId}/loans`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? body : { id: editingLoanId, ...body }),
    });
    setLoanSaving(false);
    if (!res.ok) { setLoanError((await res.json()).error ?? "Failed to save"); return; }
    setEditingLoanId(null); load();
  }
  async function handleLoanDelete(id: string, name: string) {
    if (!confirm(`Delete loan record for "${name}"?`)) return;
    await fetch(`/api/admin/schools/${schoolId}/loans`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }
  async function handleReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnState) return;
    const loan = loans.find(l => l.id === returnState.loanId);
    if (!loan) return;
    await fetch(`/api/admin/schools/${schoolId}/loans`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...loan, id: loan.id, date_returned: returnState.date, condition_in: returnState.condition || null }),
    });
    setReturnState(null); load();
  }

  // ── Counts ──

  const onLoan = loans.filter(l => !l.date_returned).length;
  const overdue = loans.filter(l => loanStatus(l) === "Overdue").length;
  const returned = loans.filter(l => !!l.date_returned).length;
  const filteredLoans = loans.filter(l => {
    if (filterStatus === "active") return !l.date_returned;
    if (filterStatus === "overdue") return loanStatus(l) === "Overdue";
    if (filterStatus === "returned") return !!l.date_returned;
    return true;
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <SchoolNav schoolId={schoolId} schoolName={schoolName} />
      <div className="max-w-6xl mx-auto px-4 py-6">

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

        <div className="flex gap-1 bg-white border rounded-xl p-1 w-fit shadow-sm mb-6">
          <button onClick={() => setTab("pool")} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "pool" ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            Equipment Pool {pool.length > 0 && <span className="ml-1 opacity-70">({pool.length})</span>}
          </button>
          <button onClick={() => setTab("history")} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "history" ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            Loan History {loans.length > 0 && <span className="ml-1 opacity-70">({loans.length})</span>}
          </button>
        </div>

        {/* ═══════════ POOL TAB ═══════════ */}
        {tab === "pool" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Equipment registered in the loan pool for this school.</p>
              <button onClick={startNewPoolItem} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add to Pool</button>
            </div>

            {poolEditId !== null && (
              <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
                <h3 className="font-semibold text-gray-800 mb-4">{poolEditId === "new" ? "Add Equipment to Pool" : "Edit Pool Item"}</h3>
                <form onSubmit={handlePoolSave} className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Item Name / Label *</label>
                      <input type="text" value={poolForm.name} onChange={pSet("name")} required placeholder="e.g. Dell Laptop 01"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Device Type</label>
                      <select value={poolForm.device_type} onChange={pSet("device_type")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">— Select —</option>
                        {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Make</label>
                      <input type="text" value={poolForm.make} onChange={pSet("make")} placeholder="e.g. Dell"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                      <input type="text" value={poolForm.model} onChange={pSet("model")} placeholder="e.g. Latitude 3420"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Asset Tag</label>
                      <input type="text" value={poolForm.asset_tag} onChange={pSet("asset_tag")} placeholder="e.g. LT-001"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
                      <input type="text" value={poolForm.serial_number} onChange={pSet("serial_number")} placeholder="S/N"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <input type="text" value={poolForm.notes} onChange={pSet("notes")} placeholder="Optional notes"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {poolError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{poolError}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={poolSaving} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{poolSaving ? "Saving…" : "Save"}</button>
                    <button type="button" onClick={() => setPoolEditId(null)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Loading…</div>
            ) : pool.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <div className="text-gray-300 text-4xl mb-3">📦</div>
                <p className="text-gray-500 font-medium">No equipment in pool yet</p>
                <p className="text-gray-400 text-sm mt-1">Click <strong>+ Add to Pool</strong> to register loanable devices.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pool.map(item => {
                  const { status, loan } = poolStatus(item, loans);
                  const statusStyle = status === "Available" ? "bg-green-100 text-green-700" : status === "Overdue" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
                  return (
                    <div key={item.id} className={`bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-3 ${status === "Overdue" ? "border-red-200" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{item.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{[item.device_type, item.make, item.model].filter(Boolean).join(" · ") || "—"}</div>
                          {item.asset_tag && <div className="text-xs font-mono text-gray-400 mt-0.5">{item.asset_tag}</div>}
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${statusStyle}`}>{status}</span>
                      </div>
                      {loan && (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-0.5">
                          <div className="font-medium text-gray-800">{loan.borrower_name}</div>
                          <div>{loan.borrower_type}{loan.borrower_group ? ` · ${loan.borrower_group}` : ""}</div>
                          {loan.date_due && <div className={loanStatus(loan) === "Overdue" ? "text-red-600 font-medium" : ""}>Due: {new Date(loan.date_due).toLocaleDateString("en-GB")}</div>}
                        </div>
                      )}
                      {item.notes && <p className="text-xs text-gray-400 italic">{item.notes}</p>}
                      <div className="flex gap-2 mt-auto pt-2 border-t flex-wrap">
                        {status === "Available" ? (
                          <button onClick={() => startLoanOut(item)} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium text-center">Loan Out</button>
                        ) : (
                          <button onClick={() => loan && setReturnState({ loanId: loan.id, date: new Date().toISOString().slice(0, 10), condition: "" })} className="flex-1 bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium text-center">Mark Returned</button>
                        )}
                        <button onClick={() => startEditPoolItem(item)} className="text-blue-500 hover:text-blue-700 text-xs font-medium px-2">Edit</button>
                        <button onClick={() => handlePoolDelete(item.id, item.name)} className="text-red-400 hover:text-red-600 text-xs px-2">Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ HISTORY TAB ═══════════ */}
        {tab === "history" && (
          <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
              <div className="flex gap-1 bg-white border rounded-lg p-1 shadow-sm">
                {[{ value: "active", label: "Active" }, { value: "overdue", label: "Overdue" }, { value: "returned", label: "Returned" }, { value: "", label: "All" }].map(opt => (
                  <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${filterStatus === opt.value ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{opt.label}</button>
                ))}
              </div>
              <button onClick={startNewLoan} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Ad-hoc Loan</button>
            </div>

            {editingLoanId !== null && (
              <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
                <h3 className="font-semibold text-gray-800 mb-4">{editingLoanId === "new" ? "New Ad-hoc Loan" : "Edit Loan"}</h3>
                <form onSubmit={handleLoanSave} className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Borrower Name *</label>
                      <input type="text" value={loanForm.borrower_name} onChange={lSet("borrower_name")} required placeholder="e.g. James Smith"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select value={loanForm.borrower_type} onChange={lSet("borrower_type")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {BORROWER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Year / Class / Dept</label>
                      <input type="text" value={loanForm.borrower_group ?? ""} onChange={lSet("borrower_group")} placeholder="e.g. 6B"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Equipment *</label>
                      <input type="text" value={loanForm.equipment} onChange={lSet("equipment")} required placeholder="e.g. Dell Laptop"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Asset Tag</label>
                      <input type="text" value={loanForm.asset_tag ?? ""} onChange={lSet("asset_tag")} placeholder="e.g. LT-012"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Authorised By</label>
                      <input type="text" value={loanForm.authorised_by ?? ""} onChange={lSet("authorised_by")} placeholder="e.g. Mrs Jones"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date Out *</label>
                      <input type="date" value={loanForm.date_out} onChange={lSet("date_out")} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Expected Return</label>
                      <input type="date" value={loanForm.date_due ?? ""} onChange={lSet("date_due")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Condition Out</label>
                      <select value={loanForm.condition_out ?? ""} onChange={lSet("condition_out")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">— Select —</option>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date Returned</label>
                      <input type="date" value={loanForm.date_returned ?? ""} onChange={lSet("date_returned")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Condition In</label>
                      <select value={loanForm.condition_in ?? ""} onChange={lSet("condition_in")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">— Select —</option>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <textarea value={loanForm.notes ?? ""} onChange={lSet("notes")} rows={2} placeholder="Any additional notes…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {loanError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{loanError}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={loanSaving} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{loanSaving ? "Saving…" : "Save Loan"}</button>
                    <button type="button" onClick={() => setEditingLoanId(null)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : filteredLoans.length === 0 ? (
                <div className="p-8 text-center text-gray-400">{loans.length === 0 ? "No loan records yet." : "No loans match the current filter."}</div>
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
                      {filteredLoans.map(l => (
                        <tr key={l.id} className={`hover:bg-gray-50 ${loanStatus(l) === "Overdue" ? "bg-red-50" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{l.borrower_name}</div>
                            <div className="text-xs text-gray-400">{l.borrower_type}{l.borrower_group ? ` · ${l.borrower_group}` : ""}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-700">{l.equipment}</div>
                            {l.asset_tag && <div className="text-xs font-mono text-gray-400">{l.asset_tag}</div>}
                            {l.pool_item_id && <div className="text-xs text-blue-400">Pool item</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{new Date(l.date_out).toLocaleDateString("en-GB")}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{l.date_due ? <span className={loanStatus(l) === "Overdue" ? "text-red-600 font-medium" : ""}>{new Date(l.date_due).toLocaleDateString("en-GB")}</span> : "—"}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{l.date_returned ? new Date(l.date_returned).toLocaleDateString("en-GB") : "—"}</td>
                          <td className="px-4 py-3 text-xs">
                            <div className="text-gray-500">{l.condition_out ?? "—"}</div>
                            {l.condition_in && <div className="text-gray-500">→ {l.condition_in}</div>}
                          </td>
                          <td className="px-4 py-3"><StatusBadge loan={l} /></td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {!l.date_returned && (
                              <button onClick={() => setReturnState({ loanId: l.id, date: new Date().toISOString().slice(0, 10), condition: "" })} className="text-green-600 hover:text-green-800 text-xs font-medium mr-3">Mark Returned</button>
                            )}
                            <button onClick={() => startEditLoan(l)} className="text-blue-500 hover:text-blue-700 text-xs font-medium mr-3">Edit</button>
                            <button onClick={() => handleLoanDelete(l.id, l.borrower_name)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {filteredLoans.length > 0 && <p className="text-xs text-gray-400 text-right mt-2">{filteredLoans.length} record{filteredLoans.length !== 1 ? "s" : ""}</p>}
          </div>
        )}
      </div>

      {/* Loan Out Modal */}
      {loanOutState && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Loan Out</h3>
            <p className="text-sm text-gray-500 mb-4">{loanOutState.equipment}</p>
            <form onSubmit={handleLoanOut} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Borrower Name *</label>
                  <input type="text" value={loanOutState.borrower_name} onChange={loSet("borrower_name")} required placeholder="e.g. James Smith"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={loanOutState.borrower_type} onChange={loSet("borrower_type")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {BORROWER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Year / Class / Dept</label>
                  <input type="text" value={loanOutState.borrower_group} onChange={loSet("borrower_group")} placeholder="e.g. 6B"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date Out *</label>
                  <input type="date" value={loanOutState.date_out} onChange={loSet("date_out")} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expected Return</label>
                  <input type="date" value={loanOutState.date_due} onChange={loSet("date_due")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Condition Out</label>
                  <select value={loanOutState.condition_out} onChange={loSet("condition_out")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Authorised By</label>
                  <input type="text" value={loanOutState.authorised_by} onChange={loSet("authorised_by")} placeholder="e.g. Mrs Jones"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={loanOutState.notes} onChange={loSet("notes")} placeholder="Optional notes"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {loanOutError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{loanOutError}</div>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={loanOutSaving} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{loanOutSaving ? "Recording…" : "Confirm Loan Out"}</button>
                <button type="button" onClick={() => setLoanOutState(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnState && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Mark as Returned</h3>
            <form onSubmit={handleReturn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                <input type="date" value={returnState.date} onChange={e => setReturnState(s => s ? { ...s, date: e.target.value } : s)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition on Return</label>
                <select value={returnState.condition} onChange={e => setReturnState(s => s ? { ...s, condition: e.target.value } : s)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select —</option>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg text-sm font-medium">Confirm Return</button>
                <button type="button" onClick={() => setReturnState(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
