"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import SchoolNav from "@/components/SchoolNav";

interface SchoolProfile {
  id: string;
  name: string;
  urn: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  phone: string;
  website: string;
  ht_name: string;
  ht_email: string;
  ht_phone: string;
  dsl_name: string;
  dsl_email: string;
  dsl_phone: string;
  tech_name: string;
  tech_email: string;
  tech_phone: string;
  msp_name: string;
  msp_contact: string;
  msp_email: string;
  msp_phone: string;
  msp_contract_expiry: string;
}

const EMPTY: SchoolProfile = {
  id: "", name: "", urn: "",
  address_line1: "", address_line2: "", city: "", postcode: "", phone: "", website: "",
  ht_name: "", ht_email: "", ht_phone: "",
  dsl_name: "", dsl_email: "", dsl_phone: "",
  tech_name: "", tech_email: "", tech_phone: "",
  msp_name: "", msp_contact: "", msp_email: "", msp_phone: "", msp_contract_expiry: "",
};

function Field({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

export default function SchoolProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [form, setForm] = useState<SchoolProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/schools/${id}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          ...EMPTY,
          ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])),
        });
        setLoading(false);
      });
  }, [id]);

  function set(field: keyof SchoolProfile) {
    return (value: string) => setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/schools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <SchoolNav schoolId={id} schoolName={form.name} />
      <div className="max-w-5xl mx-auto px-4 pt-4 flex justify-end">
        <button
          form="school-profile-form"
          type="submit"
          disabled={saving}
          className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 mt-4"
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
        </button>
      </div>

      <form id="school-profile-form" onSubmit={handleSave}>
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* School Details */}
          <Section title="School Details" icon="🏫">
            <div className="sm:col-span-2">
              <Field label="School Name *" value={form.name} onChange={set("name")} placeholder="e.g. St John's Church of England Primary School" />
            </div>
            <Field label="URN" value={form.urn} onChange={set("urn")} placeholder="e.g. 123456" />
            <Field label="Address Line 1" value={form.address_line1} onChange={set("address_line1")} placeholder="e.g. 1 School Lane" />
            <Field label="Address Line 2" value={form.address_line2} onChange={set("address_line2")} placeholder="e.g. Anytown" />
            <Field label="City / Town" value={form.city} onChange={set("city")} placeholder="e.g. London" />
            <Field label="Postcode" value={form.postcode} onChange={set("postcode")} placeholder="e.g. SW1A 1AA" />
            <Field label="School Phone" value={form.phone} onChange={set("phone")} type="tel" placeholder="e.g. 020 1234 5678" />
            <Field label="Website" value={form.website} onChange={set("website")} placeholder="e.g. https://stjohns.sch.uk" />
          </Section>

          {/* Head Teacher */}
          <Section title="Head Teacher" icon="👤">
            <Field label="Full Name" value={form.ht_name} onChange={set("ht_name")} placeholder="e.g. Mrs Jane Smith" />
            <Field label="Email Address" value={form.ht_email} onChange={set("ht_email")} type="email" placeholder="e.g. j.smith@school.sch.uk" />
            <Field label="Phone Number" value={form.ht_phone} onChange={set("ht_phone")} type="tel" placeholder="e.g. 020 1234 5678" />
          </Section>

          {/* Designated Safeguarding Lead */}
          <Section title="Designated Safeguarding Lead (DSL)" icon="🛡️">
            <Field label="Full Name" value={form.dsl_name} onChange={set("dsl_name")} placeholder="e.g. Mr David Jones" />
            <Field label="Email Address" value={form.dsl_email} onChange={set("dsl_email")} type="email" placeholder="e.g. d.jones@school.sch.uk" />
            <Field label="Phone Number" value={form.dsl_phone} onChange={set("dsl_phone")} type="tel" placeholder="e.g. 020 1234 5679" />
          </Section>

          {/* Technical Lead */}
          <Section title="Technical Lead" icon="💻">
            <Field label="Full Name" value={form.tech_name} onChange={set("tech_name")} placeholder="e.g. Mr Sam Taylor" />
            <Field label="Email Address" value={form.tech_email} onChange={set("tech_email")} type="email" placeholder="e.g. s.taylor@school.sch.uk" />
            <Field label="Phone Number" value={form.tech_phone} onChange={set("tech_phone")} type="tel" placeholder="e.g. 07700 900000" />
          </Section>

          {/* Managed Service Provider */}
          <Section title="Managed Service Provider (MSP)" icon="🔧">
            <Field label="Company Name" value={form.msp_name} onChange={set("msp_name")} placeholder="e.g. Acme IT Solutions Ltd" />
            <Field label="Primary Contact Name" value={form.msp_contact} onChange={set("msp_contact")} placeholder="e.g. Support Team" />
            <Field label="Email Address" value={form.msp_email} onChange={set("msp_email")} type="email" placeholder="e.g. support@acme-it.co.uk" />
            <Field label="Phone Number" value={form.msp_phone} onChange={set("msp_phone")} type="tel" placeholder="e.g. 0800 123 4567" />
            <Field label="Contract Expiry Date" value={form.msp_contract_expiry} onChange={set("msp_contract_expiry")} type="date" />
          </Section>

          <div className="flex justify-end pb-4">
            <button type="submit" disabled={saving}
              className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
