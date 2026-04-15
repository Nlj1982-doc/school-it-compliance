"use client";

import { useState, useEffect, useRef } from "react";
import UserNav from "@/components/UserNav";

interface Asset {
  id: string;
  school_id: string;
  device_type: string;
  asset_tag: string | null;
  device_name: string | null;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  os: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  warranty_type: string | null;
  assigned_to: string | null;
  location: string | null;
  status: string;
  notes: string | null;
}

interface ImportRow {
  device_type: string;
  asset_tag: string;
  device_name: string;
  make: string;
  model: string;
  serial_number: string;
  os: string;
  purchase_date: string;
  warranty_end_date: string;
  warranty_type: string;
  assigned_to: string;
  location: string;
  status: string;
  notes: string;
  _error?: string;
}

const DEVICE_TYPES = ["Laptop", "Desktop", "Tablet", "Server", "Network Switch", "Wireless Access Point", "Firewall / Router", "Printer / MFD", "Interactive Display", "Chromebook", "Other"];
const WARRANTY_TYPES = ["Manufacturer", "Extended", "Accidental Damage", "On-site", "Return to Base", "None"];
const STATUSES = ["Active", "In Repair", "Spare", "Retired", "Disposed"];
const OS_OPTIONS = ["Windows 11", "Windows 10", "Windows Server 2022", "Windows Server 2019", "macOS", "Chrome OS", "iPadOS", "Android", "Linux", "Other"];

const CSV_HEADERS = ["device_type", "asset_tag", "device_name", "make", "model", "serial_number", "os", "purchase_date", "warranty_end_date", "warranty_type", "assigned_to", "location", "status", "notes"];
const CSV_TEMPLATE = [
  CSV_HEADERS.join(","),
  'Laptop,LT-001,LT-RECEPTION-01,Dell,Latitude 5520,ABC12345,Windows 11,2022-09-01,2025-09-01,Manufacturer,Reception / Mrs Smith,Reception,Active,',
  'Tablet,TB-001,TB-CLASS3-01,Apple,iPad 10th Gen,XYZ99887,iPadOS,2023-01-15,2026-01-15,Manufacturer,Class 3,Room 3,Active,',
].join("\n");

const EMPTY_ASSET: Omit<Asset, "id" | "school_id"> = {
  device_type: "", asset_tag: "", device_name: "", make: "", model: "",
  serial_number: "", os: "", purchase_date: "", warranty_end_date: "",
  warranty_type: "", assigned_to: "", location: "", status: "Active", notes: "",
};

// --- Helpers ---
function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function WarrantyBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-gray-300 text-xs">—</span>;
  const days = daysUntil(dateStr);
  if (days === null) return null;
  const label = new Date(dateStr).toLocaleDateString("en-GB");
  if (days < 0) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Expired {label}</span>;
  if (days <= 90) return <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">{label} ({days}d)</span>;
  return <span className="text-xs text-gray-600">{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    Active: "bg-green-100 text-green-700",
    "In Repair": "bg-yellow-100 text-yellow-700",
    Spare: "bg-blue-100 text-blue-700",
    Retired: "bg-gray-100 text-gray-500",
    Disposed: "bg-red-100 text-red-700",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colours[status] ?? "bg-gray-100 text-gray-500"}`}>{status}</span>;
}

// --- CSV parsing ---
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

// Accept ISO (YYYY-MM-DD) or UK (DD/MM/YYYY)
function parseDate(val: string): string {
  if (!val.trim()) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const m = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return val.trim();
}

// Normalise a CSV header to a known field name
const HEADER_MAP: Record<string, string> = {
  "device type": "device_type", "type": "device_type",
  "asset tag": "asset_tag", "tag": "asset_tag", "asset_no": "asset_tag",
  "device name": "device_name", "hostname": "device_name", "name": "device_name",
  "make": "make", "manufacturer": "make",
  "model": "model",
  "serial number": "serial_number", "serial": "serial_number", "serial_no": "serial_number",
  "os": "os", "operating system": "os",
  "purchase date": "purchase_date", "bought": "purchase_date",
  "warranty end date": "warranty_end_date", "warranty end": "warranty_end_date", "warranty expiry": "warranty_end_date",
  "warranty type": "warranty_type",
  "assigned to": "assigned_to", "user": "assigned_to", "assigned": "assigned_to",
  "location": "location", "room": "location",
  "status": "status",
  "notes": "notes", "note": "notes",
};

function normaliseHeader(h: string): string {
  const lower = h.toLowerCase().trim().replace(/_/g, " ");
  return HEADER_MAP[lower] ?? lower.replace(/ /g, "_");
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(normaliseHeader);
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = vals[idx]?.trim() ?? ""; });
    const row: ImportRow = {
      device_type: raw.device_type ?? "",
      asset_tag: raw.asset_tag ?? "",
      device_name: raw.device_name ?? "",
      make: raw.make ?? "",
      model: raw.model ?? "",
      serial_number: raw.serial_number ?? "",
      os: raw.os ?? "",
      purchase_date: parseDate(raw.purchase_date ?? ""),
      warranty_end_date: parseDate(raw.warranty_end_date ?? ""),
      warranty_type: raw.warranty_type ?? "",
      assigned_to: raw.assigned_to ?? "",
      location: raw.location ?? "",
      status: raw.status || "Active",
      notes: raw.notes ?? "",
    };
    if (!row.device_type) row._error = "Missing device type";
    rows.push(row);
  }
  return rows;
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "asset_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Main component ---
export default function UserAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Omit<Asset, "id" | "school_id">>(EMPTY_ASSET);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function load() {
    const rows = await fetch("/api/my/assets").then(r => r.json());
    setAssets(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() { setForm({ ...EMPTY_ASSET }); setEditingId("new"); setError(""); }
  function startEdit(a: Asset) {
    setForm({ ...EMPTY_ASSET, ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v ?? ""])) as Omit<Asset, "id" | "school_id"> });
    setEditingId(a.id); setError("");
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
    const res = await fetch("/api/my/assets", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return; }
    setEditingId(null); load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete asset "${name}"?`)) return;
    await fetch("/api/my/assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  // CSV import handlers
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(""); setImportResult(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) { setImportError("No data rows found. Make sure your CSV has a header row and at least one data row."); return; }
      setImportRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImportConfirm() {
    if (!importRows) return;
    const valid = importRows.filter(r => !r._error);
    if (valid.length === 0) { setImportError("No valid rows to import."); return; }
    setImporting(true); setImportError("");
    const res = await fetch("/api/my/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valid),
    });
    setImporting(false);
    if (!res.ok) { setImportError("Import failed. Please try again."); return; }
    const data = await res.json();
    setImportResult(`✓ ${data.imported} asset${data.imported !== 1 ? "s" : ""} imported successfully.`);
    setImportRows(null);
    load();
  }

  const filtered = assets.filter(a => {
    if (filterType && a.device_type !== filterType) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return [a.device_name, a.asset_tag, a.make, a.model, a.serial_number, a.assigned_to, a.location]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const expiredWarranty = assets.filter(a => (daysUntil(a.warranty_end_date) ?? 1) < 0).length;
  const warrantyExpiringSoon = assets.filter(a => { const d = daysUntil(a.warranty_end_date); return d !== null && d >= 0 && d <= 90; }).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-800">{assets.length}</div>
            <div className="text-sm text-gray-500">Total Assets</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-700">{assets.filter(a => a.status === "Active").length}</div>
            <div className="text-sm text-gray-500">Active</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${warrantyExpiringSoon > 0 ? "text-yellow-600" : "text-gray-400"}`}>{warrantyExpiringSoon}</div>
            <div className="text-sm text-gray-500">Warranty Expiring Soon</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${expiredWarranty > 0 ? "text-red-600" : "text-gray-400"}`}>{expiredWarranty}</div>
            <div className="text-sm text-gray-500">Warranty Expired</div>
          </div>
        </div>

        {/* CSV import result banner */}
        {importResult && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg flex justify-between items-center">
            {importResult}
            <button onClick={() => setImportResult(null)} className="text-green-600 hover:text-green-800 ml-4">✕</button>
          </div>
        )}

        {/* CSV import preview panel */}
        {importRows !== null && (
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">CSV Import Preview</h3>
              <button onClick={() => setImportRows(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Cancel</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {importRows.length} row{importRows.length !== 1 ? "s" : ""} found ·{" "}
              <span className="text-green-700 font-medium">{importRows.filter(r => !r._error).length} valid</span>
              {importRows.filter(r => r._error).length > 0 && (
                <span className="text-red-600 font-medium"> · {importRows.filter(r => r._error).length} skipped (see below)</span>
              )}
            </p>
            <div className="overflow-x-auto max-h-60 overflow-y-auto border rounded-lg mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b text-gray-500">
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Tag</th>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Make / Model</th>
                    <th className="px-3 py-2 text-left font-medium">Serial</th>
                    <th className="px-3 py-2 text-left font-medium">OS</th>
                    <th className="px-3 py-2 text-left font-medium">Warranty End</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importRows.map((r, i) => (
                    <tr key={i} className={r._error ? "bg-red-50" : "hover:bg-gray-50"}>
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-gray-700">{r.device_type || <span className="text-red-400">—</span>}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{r.asset_tag || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-700">{r.device_name || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{[r.make, r.model].filter(Boolean).join(" ") || "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{r.serial_number || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.os || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.warranty_end_date ? new Date(r.warranty_end_date).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="px-3 py-1.5">{r.status}</td>
                      <td className="px-3 py-1.5 text-red-600">{r._error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importError && <div className="text-red-600 text-sm mb-3">{importError}</div>}
            <div className="flex gap-2">
              <button onClick={handleImportConfirm} disabled={importing || importRows.filter(r => !r._error).length === 0}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                {importing ? "Importing…" : `Import ${importRows.filter(r => !r._error).length} Asset${importRows.filter(r => !r._error).length !== 1 ? "s" : ""}`}
              </button>
              <button onClick={() => setImportRows(null)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Types</option>
              {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={downloadTemplate}
              className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              ↓ CSV Template
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="border border-blue-600 text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              ↑ Import CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
            <button onClick={startNew}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              + Add Asset
            </button>
          </div>
        </div>

        {/* Add / Edit form */}
        {editingId !== null && (
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
            <h3 className="font-semibold text-gray-800 mb-4">{editingId === "new" ? "New Asset" : "Edit Asset"}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Device Type *</label>
                  <select value={form.device_type} onChange={set("device_type")} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Asset Tag</label>
                  <input type="text" value={form.asset_tag ?? ""} onChange={set("asset_tag")} placeholder="e.g. LT-001"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Device Name / Hostname</label>
                  <input type="text" value={form.device_name ?? ""} onChange={set("device_name")} placeholder="e.g. LT-RECEPTION-01"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Make</label>
                  <input type="text" value={form.make ?? ""} onChange={set("make")} placeholder="e.g. Dell"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                  <input type="text" value={form.model ?? ""} onChange={set("model")} placeholder="e.g. Latitude 5520"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
                  <input type="text" value={form.serial_number ?? ""} onChange={set("serial_number")} placeholder="e.g. ABC12345"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Operating System</label>
                  <select value={form.os ?? ""} onChange={set("os")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {OS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchase_date ?? ""} onChange={set("purchase_date")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Warranty End Date</label>
                  <input type="date" value={form.warranty_end_date ?? ""} onChange={set("warranty_end_date")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Warranty Type</label>
                  <select value={form.warranty_type ?? ""} onChange={set("warranty_type")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {WARRANTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                  <input type="text" value={form.assigned_to ?? ""} onChange={set("assigned_to")} placeholder="e.g. Class 3 / Mrs Brown"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input type="text" value={form.location ?? ""} onChange={set("location")} placeholder="e.g. Room 4 / IT Suite"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={set("status")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
                <button type="submit" disabled={saving}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                  {saving ? "Saving…" : "Save Asset"}
                </button>
                <button type="button" onClick={() => setEditingId(null)}
                  className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Assets table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {assets.length === 0
                ? <>No assets yet. Click <strong>+ Add Asset</strong> or <strong>↑ Import CSV</strong> to get started.</>
                : "No assets match your filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 text-left">
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Tag</th>
                    <th className="px-4 py-3 font-medium">Name / Make / Model</th>
                    <th className="px-4 py-3 font-medium">Serial No.</th>
                    <th className="px-4 py-3 font-medium">OS</th>
                    <th className="px-4 py-3 font-medium">Purchased</th>
                    <th className="px-4 py-3 font-medium">Warranty</th>
                    <th className="px-4 py-3 font-medium">Assigned / Location</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{a.device_type}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.asset_tag ?? "—"}</td>
                      <td className="px-4 py-3">
                        {a.device_name && <div className="font-medium text-gray-800">{a.device_name}</div>}
                        <div className="text-xs text-gray-500">{[a.make, a.model].filter(Boolean).join(" ") || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.serial_number ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.os ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {a.purchase_date ? new Date(a.purchase_date).toLocaleDateString("en-GB") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <WarrantyBadge dateStr={a.warranty_end_date} />
                        {a.warranty_type && <div className="text-xs text-gray-400 mt-0.5">{a.warranty_type}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {a.assigned_to && <div className="text-xs text-gray-700">{a.assigned_to}</div>}
                        {a.location && <div className="text-xs text-gray-400">{a.location}</div>}
                        {!a.assigned_to && !a.location && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => startEdit(a)} className="text-blue-500 hover:text-blue-700 text-xs font-medium mr-3">Edit</button>
                        <button onClick={() => handleDelete(a.id, a.device_name ?? a.asset_tag ?? a.device_type)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > 0 && (
          <p className="text-xs text-gray-400 text-right mt-2">{filtered.length} asset{filtered.length !== 1 ? "s" : ""} shown</p>
        )}
      </div>
    </main>
  );
}
