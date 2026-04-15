"use client";

import { useState, useEffect, useRef } from "react";
import UserNav from "@/components/UserNav";

interface NetworkDevice {
  id: string;
  school_id: string;
  device_type: string;
  asset_tag: string | null;
  device_name: string | null;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  ip_address: string | null;
  mac_address: string | null;
  management_url: string | null;
  vlan: string | null;
  port_count: string | null;
  firmware_version: string | null;
  location: string | null;
  cabinet: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  warranty_type: string | null;
  support_contract: string | null;
  support_expiry: string | null;
  status: string;
  notes: string | null;
}

const DEVICE_TYPES = [
  "Router / Firewall", "Managed Switch", "Unmanaged Switch", "Wireless Access Point",
  "Wireless Controller", "Patch Panel", "Network Attached Storage (NAS)",
  "UPS / Battery Backup", "Modem / ONT", "VoIP Gateway", "Load Balancer", "Other",
];
const WARRANTY_TYPES = ["Manufacturer", "Extended", "NBD On-site", "Return to Base", "Support Contract", "None"];
const STATUSES = ["Active", "In Repair", "Spare", "Decommissioned"];

const EMPTY: Omit<NetworkDevice, "id" | "school_id"> = {
  device_type: "", asset_tag: "", device_name: "", make: "", model: "", serial_number: "",
  ip_address: "", mac_address: "", management_url: "", vlan: "", port_count: "",
  firmware_version: "", location: "", cabinet: "", purchase_date: "", warranty_end_date: "",
  warranty_type: "", support_contract: "", support_expiry: "", status: "Active", notes: "",
};

const CSV_HEADERS = ["device_type","asset_tag","device_name","make","model","serial_number","ip_address","mac_address","vlan","port_count","firmware_version","location","cabinet","purchase_date","warranty_end_date","warranty_type","support_contract","support_expiry","status","notes"];
const CSV_TEMPLATE = [
  CSV_HEADERS.join(","),
  'Managed Switch,SW-001,CORE-SW-01,Cisco,Catalyst 2960X,FCW2301G0AB,192.168.1.2,AA:BB:CC:DD:EE:01,1,48,,Server Room,Rack A,2021-09-01,2024-09-01,NBD On-site,Cisco SMARTnet,2024-09-01,Active,Core distribution switch',
  'Wireless Access Point,AP-001,AP-HALL-01,Ubiquiti,UniFi U6 Pro,F09FC2A1B2C3,192.168.1.50,AA:BB:CC:DD:EE:02,10,,,Main Hall,,2022-03-01,2025-03-01,Manufacturer,,,Active,',
].join("\n");

function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-gray-300 text-xs">—</span>;
  const days = daysUntil(dateStr);
  if (days === null) return null;
  const fmt = new Date(dateStr).toLocaleDateString("en-GB");
  if (days < 0) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Expired {fmt}</span>;
  if (days <= 30) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{fmt} ({days}d)</span>;
  if (days <= 90) return <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">{fmt} ({days}d)</span>;
  return <span className="text-xs text-gray-600">{fmt}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
    Active: "bg-green-100 text-green-700", "In Repair": "bg-yellow-100 text-yellow-700",
    Spare: "bg-blue-100 text-blue-700", Decommissioned: "bg-gray-100 text-gray-500",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c[status] ?? "bg-gray-100 text-gray-500"}`}>{status}</span>;
}

// CSV parsing
function parseCSVLine(line: string): string[] {
  const r: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { r.push(cur); cur = ""; }
    else cur += ch;
  }
  r.push(cur); return r;
}
function parseDate(v: string): string {
  if (!v.trim()) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : v.trim();
}
const HDR: Record<string,string> = {
  "device type":"device_type","type":"device_type","asset tag":"asset_tag","tag":"asset_tag",
  "device name":"device_name","hostname":"device_name","name":"device_name",
  "make":"make","manufacturer":"make","model":"model","serial number":"serial_number","serial":"serial_number",
  "ip address":"ip_address","ip":"ip_address","mac address":"mac_address","mac":"mac_address",
  "management url":"management_url","mgmt url":"management_url","url":"management_url",
  "vlan":"vlan","port count":"port_count","ports":"port_count","firmware":"firmware_version","firmware version":"firmware_version",
  "location":"location","cabinet":"cabinet","rack":"cabinet",
  "purchase date":"purchase_date","warranty end date":"warranty_end_date","warranty end":"warranty_end_date",
  "warranty type":"warranty_type","support contract":"support_contract","support expiry":"support_expiry",
  "status":"status","notes":"notes",
};
function normH(h: string) { const l = h.toLowerCase().trim().replace(/_/g," "); return HDR[l] ?? l.replace(/ /g,"_"); }

interface ImportRow extends Omit<NetworkDevice,"id"|"school_id"> { _error?: string; }

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const hdrs = parseCSVLine(lines[0]).map(normH);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const raw: Record<string,string> = {};
    hdrs.forEach((h,i) => { raw[h] = vals[i]?.trim() ?? ""; });
    const row: ImportRow = {
      device_type: raw.device_type ?? "", asset_tag: raw.asset_tag ?? "",
      device_name: raw.device_name ?? "", make: raw.make ?? "", model: raw.model ?? "",
      serial_number: raw.serial_number ?? "", ip_address: raw.ip_address ?? "",
      mac_address: raw.mac_address ?? "", management_url: raw.management_url ?? "",
      vlan: raw.vlan ?? "", port_count: raw.port_count ?? "", firmware_version: raw.firmware_version ?? "",
      location: raw.location ?? "", cabinet: raw.cabinet ?? "",
      purchase_date: parseDate(raw.purchase_date ?? ""), warranty_end_date: parseDate(raw.warranty_end_date ?? ""),
      warranty_type: raw.warranty_type ?? "", support_contract: raw.support_contract ?? "",
      support_expiry: parseDate(raw.support_expiry ?? ""), status: raw.status || "Active", notes: raw.notes ?? "",
    };
    if (!row.device_type) row._error = "Missing device type";
    return row;
  });
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "network_import_template.csv" });
  a.click(); URL.revokeObjectURL(a.href);
}

export default function UserNetworkPage() {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Omit<NetworkDevice,"id"|"school_id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importErr, setImportErr] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function load() {
    const rows = await fetch("/api/my/network").then(r => r.json());
    setDevices(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setForm({...EMPTY}); setEditingId("new"); setError(""); }
  function startEdit(d: NetworkDevice) {
    setForm(Object.fromEntries(Object.entries(d).map(([k,v]) => [k, v ?? ""])) as Omit<NetworkDevice,"id"|"school_id">);
    setEditingId(d.id); setError("");
  }
  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(f => ({...f, [field]: e.target.value}));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const isNew = editingId === "new";
    const res = await fetch("/api/my/network", {
      method: isNew ? "POST" : "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(isNew ? form : {id: editingId, ...form}),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "Failed to save"); return; }
    setEditingId(null); load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch("/api/my/network", {
      method: "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({id}),
    });
    load();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportErr(""); setImportResult(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string);
      if (!rows.length) { setImportErr("No data rows found."); return; }
      setImportRows(rows);
    };
    reader.readAsText(file); e.target.value = "";
  }

  async function confirmImport() {
    if (!importRows) return;
    const valid = importRows.filter(r => !r._error);
    if (!valid.length) { setImportErr("No valid rows."); return; }
    setImporting(true); setImportErr("");
    const res = await fetch("/api/my/network", {
      method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(valid),
    });
    setImporting(false);
    if (!res.ok) { setImportErr("Import failed."); return; }
    const d = await res.json();
    setImportResult(`✓ ${d.imported} device${d.imported !== 1 ? "s" : ""} imported.`);
    setImportRows(null); load();
  }

  const filtered = devices.filter(d => {
    if (filterType && d.device_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return [d.device_name, d.asset_tag, d.ip_address, d.make, d.model, d.serial_number, d.location, d.cabinet]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const warrantyExpiring = devices.filter(d => { const x = daysUntil(d.warranty_end_date); return x !== null && x >= 0 && x <= 90; }).length;
  const supportExpiring  = devices.filter(d => { const x = daysUntil(d.support_expiry);    return x !== null && x >= 0 && x <= 90; }).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Devices", value: devices.length, color: "text-blue-800" },
            { label: "Active", value: devices.filter(d => d.status === "Active").length, color: "text-green-700" },
            { label: "Warranty Expiring", value: warrantyExpiring, color: warrantyExpiring > 0 ? "text-yellow-600" : "text-gray-400" },
            { label: "Support Expiring",  value: supportExpiring,  color: supportExpiring  > 0 ? "text-yellow-600" : "text-gray-400" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border p-4 text-center shadow-sm">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {importResult && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg flex justify-between">
            {importResult}
            <button onClick={() => setImportResult(null)} className="ml-4 text-green-600 hover:text-green-800">✕</button>
          </div>
        )}

        {/* Import preview */}
        {importRows !== null && (
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">CSV Import Preview</h3>
              <button onClick={() => setImportRows(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Cancel</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {importRows.length} row{importRows.length !== 1 ? "s" : ""} ·{" "}
              <span className="text-green-700 font-medium">{importRows.filter(r => !r._error).length} valid</span>
              {importRows.filter(r => r._error).length > 0 && <span className="text-red-600 font-medium"> · {importRows.filter(r => r._error).length} skipped</span>}
            </p>
            <div className="overflow-x-auto max-h-56 overflow-y-auto border rounded-lg mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b text-gray-500">
                    {["#","Type","Tag","Name","Make/Model","IP","MAC","VLAN","Location","Warranty End","Support Expiry","Status","Issue"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importRows.map((r, i) => (
                    <tr key={i} className={r._error ? "bg-red-50" : "hover:bg-gray-50"}>
                      <td className="px-3 py-1.5 text-gray-400">{i+1}</td>
                      <td className="px-3 py-1.5 text-gray-700">{r.device_type || <span className="text-red-400">—</span>}</td>
                      <td className="px-3 py-1.5 font-mono">{r.asset_tag||"—"}</td>
                      <td className="px-3 py-1.5">{r.device_name||"—"}</td>
                      <td className="px-3 py-1.5">{[r.make,r.model].filter(Boolean).join(" ")||"—"}</td>
                      <td className="px-3 py-1.5 font-mono">{r.ip_address||"—"}</td>
                      <td className="px-3 py-1.5 font-mono">{r.mac_address||"—"}</td>
                      <td className="px-3 py-1.5">{r.vlan||"—"}</td>
                      <td className="px-3 py-1.5">{[r.location,r.cabinet].filter(Boolean).join(" / ")||"—"}</td>
                      <td className="px-3 py-1.5">{r.warranty_end_date ? new Date(r.warranty_end_date).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="px-3 py-1.5">{r.support_expiry ? new Date(r.support_expiry).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="px-3 py-1.5">{r.status}</td>
                      <td className="px-3 py-1.5 text-red-600">{r._error??""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importErr && <p className="text-red-600 text-sm mb-3">{importErr}</p>}
            <div className="flex gap-2">
              <button onClick={confirmImport} disabled={importing || !importRows.filter(r=>!r._error).length}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {importing ? "Importing…" : `Import ${importRows.filter(r=>!r._error).length} Device${importRows.filter(r=>!r._error).length!==1?"s":""}`}
              </button>
              <button onClick={() => setImportRows(null)} className="text-gray-500 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:text-gray-700">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div className="flex gap-2 flex-wrap">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devices…"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Types</option>
              {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium">↓ CSV Template</button>
            <button onClick={() => fileRef.current?.click()} className="border border-blue-600 text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg text-sm font-medium">↑ Import CSV</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            <button onClick={startNew} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Device</button>
          </div>
        </div>

        {/* Form */}
        {editingId !== null && (
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-5">
            <h3 className="font-semibold text-gray-800 mb-4">{editingId === "new" ? "New Network Device" : "Edit Network Device"}</h3>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Device Details</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Device Type *</label>
                    <select value={form.device_type} onChange={set("device_type")} required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Select —</option>
                      {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Asset Tag</label>
                    <input type="text" value={form.asset_tag??""} onChange={set("asset_tag")} placeholder="e.g. SW-001"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Device Name / Hostname</label>
                    <input type="text" value={form.device_name??""} onChange={set("device_name")} placeholder="e.g. CORE-SW-01"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Make</label>
                    <input type="text" value={form.make??""} onChange={set("make")} placeholder="e.g. Cisco"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                    <input type="text" value={form.model??""} onChange={set("model")} placeholder="e.g. Catalyst 2960X"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
                    <input type="text" value={form.serial_number??""} onChange={set("serial_number")} placeholder="e.g. FCW2301G0AB"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Firmware Version</label>
                    <input type="text" value={form.firmware_version??""} onChange={set("firmware_version")} placeholder="e.g. 15.2(7)E5"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Network Information</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">IP Address</label>
                    <input type="text" value={form.ip_address??""} onChange={set("ip_address")} placeholder="e.g. 192.168.1.2"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">MAC Address</label>
                    <input type="text" value={form.mac_address??""} onChange={set("mac_address")} placeholder="e.g. AA:BB:CC:DD:EE:FF"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">VLAN</label>
                    <input type="text" value={form.vlan??""} onChange={set("vlan")} placeholder="e.g. 1 or Staff"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Port Count</label>
                    <input type="text" value={form.port_count??""} onChange={set("port_count")} placeholder="e.g. 48"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Management URL</label>
                    <input type="text" value={form.management_url??""} onChange={set("management_url")} placeholder="e.g. https://192.168.1.2"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                    <input type="text" value={form.location??""} onChange={set("location")} placeholder="e.g. Server Room"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Cabinet / Rack</label>
                    <input type="text" value={form.cabinet??""} onChange={set("cabinet")} placeholder="e.g. Rack A, U10"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Warranty &amp; Support</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date</label>
                    <input type="date" value={form.purchase_date??""} onChange={set("purchase_date")}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Warranty End Date</label>
                    <input type="date" value={form.warranty_end_date??""} onChange={set("warranty_end_date")}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Warranty Type</label>
                    <select value={form.warranty_type??""} onChange={set("warranty_type")}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— Select —</option>
                      {WARRANTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select value={form.status} onChange={set("status")}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Support Contract Name / Reference</label>
                    <input type="text" value={form.support_contract??""} onChange={set("support_contract")} placeholder="e.g. Cisco SMARTnet or SLA-001"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Support Expiry Date</label>
                    <input type="date" value={form.support_expiry??""} onChange={set("support_expiry")}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes??""} onChange={set("notes")} rows={2} placeholder="Any additional notes…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving…" : "Save Device"}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {devices.length === 0
                ? <>No network devices yet. Click <strong>+ Add Device</strong> or <strong>↑ Import CSV</strong> to get started.</>
                : "No devices match your filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 text-left text-xs">
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Tag</th>
                    <th className="px-4 py-3 font-medium">Name / Make / Model</th>
                    <th className="px-4 py-3 font-medium">IP / MAC</th>
                    <th className="px-4 py-3 font-medium">VLAN</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Firmware</th>
                    <th className="px-4 py-3 font-medium">Warranty</th>
                    <th className="px-4 py-3 font-medium">Support</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{d.device_type}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.asset_tag ?? "—"}</td>
                      <td className="px-4 py-3">
                        {d.device_name && <div className="font-medium text-gray-800">{d.device_name}</div>}
                        <div className="text-xs text-gray-500">{[d.make, d.model].filter(Boolean).join(" ") || "—"}</div>
                        {d.serial_number && <div className="text-xs text-gray-400 font-mono">{d.serial_number}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {d.ip_address && <div className="font-mono text-xs text-gray-700">{d.ip_address}</div>}
                        {d.mac_address && <div className="font-mono text-xs text-gray-400">{d.mac_address}</div>}
                        {d.management_url && (
                          <a href={d.management_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Manage ↗</a>
                        )}
                        {!d.ip_address && !d.mac_address && !d.management_url && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{d.vlan ?? "—"}{d.port_count ? <div className="text-gray-400">{d.port_count}p</div> : null}</td>
                      <td className="px-4 py-3 text-xs">
                        {d.location && <div className="text-gray-700">{d.location}</div>}
                        {d.cabinet && <div className="text-gray-400">{d.cabinet}</div>}
                        {!d.location && !d.cabinet && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{d.firmware_version ?? "—"}</td>
                      <td className="px-4 py-3">
                        <ExpiryBadge dateStr={d.warranty_end_date} />
                        {d.warranty_type && <div className="text-xs text-gray-400 mt-0.5">{d.warranty_type}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {d.support_contract && <div className="text-xs text-gray-700">{d.support_contract}</div>}
                        <ExpiryBadge dateStr={d.support_expiry} />
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => startEdit(d)} className="text-blue-500 hover:text-blue-700 text-xs font-medium mr-3">Edit</button>
                        <button onClick={() => handleDelete(d.id, d.device_name ?? d.asset_tag ?? d.device_type)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > 0 && <p className="text-xs text-gray-400 text-right mt-2">{filtered.length} device{filtered.length !== 1 ? "s" : ""} shown</p>}
      </div>
    </main>
  );
}
