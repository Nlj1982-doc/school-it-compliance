"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserNav from "@/components/UserNav";
import { frameworks, getFrameworkScore } from "@/lib/frameworks";
import type { QuestionStatus } from "@/lib/frameworks";

interface Assessment { id: string; updated_at: string; answers: string; }
interface Asset { warranty_end_date: string | null; status: string; }
interface NetworkDevice { warranty_end_date: string | null; support_expiry: string | null; status: string; }
interface Contract { end_date: string | null; name: string; }
interface SessionUser {
  role: string;
  canCompliance?: boolean;
  canContracts?: boolean;
  canAssets?: boolean;
  canNetwork?: boolean;
}

function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function getOverallRag(answers: Record<string, QuestionStatus>) {
  const scores = frameworks.map(f => getFrameworkScore(f.id, answers)).filter(Boolean);
  if (!scores.length) return null;
  const avg = scores.reduce((a, s) => a + (s?.percentage ?? 0), 0) / scores.length;
  return avg >= 75 ? "green" : avg >= 50 ? "amber" : "red";
}

function RagBadge({ rag }: { rag: string | null }) {
  if (!rag) return <span className="text-xs text-gray-400">Not started</span>;
  const styles = { green: "bg-green-100 text-green-700", amber: "bg-yellow-100 text-yellow-700", red: "bg-red-100 text-red-700" };
  const labels = { green: "Compliant", amber: "Needs Work", red: "At Risk" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[rag as keyof typeof styles]}`}>{labels[rag as keyof typeof labels]}</span>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [network, setNetwork] = useState<NetworkDevice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r => r.json()),
      fetch("/api/assessments").then(r => r.json()),
      fetch("/api/my/assets").then(r => r.json()),
      fetch("/api/my/network").then(r => r.json()),
      fetch("/api/my/contracts").then(r => r.json()),
    ]).then(([meData, assess, ast, net, con]) => {
      setMe(meData.user ?? null);
      setAssessment(Array.isArray(assess) ? (assess[0] ?? null) : null);
      setAssets(Array.isArray(ast) ? ast : []);
      setNetwork(Array.isArray(net) ? net : []);
      setContracts(Array.isArray(con) ? con : []);
      setLoading(false);
    });
  }, []);

  const isAdmin = me?.role === "admin";
  const canCompliance = isAdmin || (me?.canCompliance ?? true);
  const canContracts  = isAdmin || (me?.canContracts  ?? true);
  const canAssets     = isAdmin || (me?.canAssets     ?? true);
  const canNetwork    = isAdmin || (me?.canNetwork    ?? true);

  // Computed stats
  const answers = assessment ? JSON.parse(assessment.answers) as Record<string, QuestionStatus> : {};
  const rag = assessment ? getOverallRag(answers) : null;
  const answeredCount = Object.values(answers).filter(v => v !== null).length;
  const totalQ = frameworks.flatMap(f => f.sections.flatMap(s => s.questions)).length;
  const compliancePct = totalQ ? Math.round((answeredCount / totalQ) * 100) : 0;

  const assetWarrantyExpiring = assets.filter(a => { const d = daysUntil(a.warranty_end_date); return d !== null && d >= 0 && d <= 30; });
  const netWarrantyExpiring   = network.filter(n => { const d = daysUntil(n.warranty_end_date); return d !== null && d >= 0 && d <= 30; });
  const netSupportExpiring    = network.filter(n => { const d = daysUntil(n.support_expiry);    return d !== null && d >= 0 && d <= 30; });
  const contractsExpiring     = contracts.filter(c => { const d = daysUntil(c.end_date);        return d !== null && d >= 0 && d <= 30; });
  const contractsExpired      = contracts.filter(c => { const d = daysUntil(c.end_date);        return d !== null && d < 0; });

  // Only count alerts for sections the user can see (computed after me is set,
  // but safe to use during the loading render — they'll all be 0 then anyway)
  const totalAlerts =
    (canAssets    ? assetWarrantyExpiring.length : 0) +
    (canNetwork   ? netWarrantyExpiring.length + netSupportExpiring.length : 0) +
    (canContracts ? contractsExpiring.length + contractsExpired.length : 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <UserNav />
        <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <UserNav />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Module cards */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Management Areas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Compliance */}
            {canCompliance && (
              <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📋</span>
                  <span className="font-semibold text-gray-800">Compliance</span>
                </div>
                {assessment ? (
                  <>
                    <div className="mb-1"><RagBadge rag={rag} /></div>
                    <div className="text-xs text-gray-500 mb-1">{compliancePct}% complete · {answeredCount}/{totalQ} questions</div>
                    <div className="text-xs text-gray-400 mb-3">Updated {new Date(assessment.updated_at).toLocaleDateString("en-GB")}</div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mb-3 flex-1">No assessment started yet.</p>
                )}
                <button onClick={() => router.push("/compliance")}
                  className="mt-auto w-full text-center bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-1.5 rounded-lg transition-colors">
                  {assessment && answeredCount > 0 ? "View Compliance" : "Start Assessment"}
                </button>
              </div>
            )}

            {/* Assets */}
            {canAssets && (
              <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">💻</span>
                  <span className="font-semibold text-gray-800">Asset Log</span>
                </div>
                <div className="space-y-1 mb-3 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total devices</span>
                    <span className="font-semibold text-gray-800">{assets.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Active</span>
                    <span className="font-semibold text-green-700">{assets.filter(a => a.status === "Active").length}</span>
                  </div>
                  {assetWarrantyExpiring.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Warranty expiring</span>
                      <span className="font-semibold text-red-600">{assetWarrantyExpiring.length}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => router.push("/assets")}
                  className="mt-auto w-full text-center border border-blue-600 text-blue-700 hover:bg-blue-50 text-sm font-medium py-1.5 rounded-lg transition-colors">
                  View Assets
                </button>
              </div>
            )}

            {/* Network */}
            {canNetwork && (
              <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🌐</span>
                  <span className="font-semibold text-gray-800">Network</span>
                </div>
                <div className="space-y-1 mb-3 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total devices</span>
                    <span className="font-semibold text-gray-800">{network.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Active</span>
                    <span className="font-semibold text-green-700">{network.filter(n => n.status === "Active").length}</span>
                  </div>
                  {(netWarrantyExpiring.length + netSupportExpiring.length) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Expiring soon</span>
                      <span className="font-semibold text-red-600">{netWarrantyExpiring.length + netSupportExpiring.length}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => router.push("/network")}
                  className="mt-auto w-full text-center border border-blue-600 text-blue-700 hover:bg-blue-50 text-sm font-medium py-1.5 rounded-lg transition-colors">
                  View Network
                </button>
              </div>
            )}

            {/* Contracts */}
            {canContracts && (
              <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📄</span>
                  <span className="font-semibold text-gray-800">Contracts</span>
                </div>
                <div className="space-y-1 mb-3 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total contracts</span>
                    <span className="font-semibold text-gray-800">{contracts.length}</span>
                  </div>
                  {contractsExpiring.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Expiring soon</span>
                      <span className="font-semibold text-red-600">{contractsExpiring.length}</span>
                    </div>
                  )}
                  {contractsExpired.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Expired</span>
                      <span className="font-semibold text-red-700">{contractsExpired.length}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => router.push("/contracts")}
                  className="mt-auto w-full text-center border border-blue-600 text-blue-700 hover:bg-blue-50 text-sm font-medium py-1.5 rounded-lg transition-colors">
                  View Contracts
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Alerts panel */}
        {totalAlerts > 0 ? (
          <div className="bg-white rounded-xl border border-yellow-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">⚠️</span>
              <h2 className="font-semibold text-gray-800">
                {totalAlerts} item{totalAlerts !== 1 ? "s" : ""} need{totalAlerts === 1 ? "s" : ""} attention
              </h2>
              <span className="text-xs text-gray-400">(due within 30 days or already expired)</span>
            </div>
            <div className="space-y-2">
              {canContracts && contractsExpired.length > 0 && (
                <div className="flex items-center justify-between py-2 px-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Contracts</span>
                    <span className="text-sm text-gray-700">{contractsExpired.length} contract{contractsExpired.length !== 1 ? "s" : ""} have expired</span>
                  </div>
                  <button onClick={() => router.push("/contracts")} className="text-xs text-blue-600 hover:underline">Review →</button>
                </div>
              )}
              {canContracts && contractsExpiring.length > 0 && (
                <div className="flex items-center justify-between py-2 px-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Contracts</span>
                    <span className="text-sm text-gray-700">
                      {contractsExpiring.length} expiring within 30 days
                      {contractsExpiring.length <= 3 ? `: ${contractsExpiring.map(c => c.name).join(", ")}` : ""}
                    </span>
                  </div>
                  <button onClick={() => router.push("/contracts")} className="text-xs text-blue-600 hover:underline">Review →</button>
                </div>
              )}
              {canAssets && assetWarrantyExpiring.length > 0 && (
                <div className="flex items-center justify-between py-2 px-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Assets</span>
                    <span className="text-sm text-gray-700">{assetWarrantyExpiring.length} device warrant{assetWarrantyExpiring.length !== 1 ? "ies" : "y"} expiring within 30 days</span>
                  </div>
                  <button onClick={() => router.push("/assets")} className="text-xs text-blue-600 hover:underline">Review →</button>
                </div>
              )}
              {canNetwork && (netWarrantyExpiring.length + netSupportExpiring.length) > 0 && (
                <div className="flex items-center justify-between py-2 px-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Network</span>
                    <span className="text-sm text-gray-700">
                      {netWarrantyExpiring.length + netSupportExpiring.length} warranty / support item{(netWarrantyExpiring.length + netSupportExpiring.length) !== 1 ? "s" : ""} expiring within 30 days
                    </span>
                  </div>
                  <button onClick={() => router.push("/network")} className="text-xs text-blue-600 hover:underline">Review →</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          assets.length + network.length + contracts.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-xl">✅</span>
              <span className="text-sm text-green-800 font-medium">No contracts, warranties or support items due to expire within 30 days.</span>
            </div>
          )
        )}

        {/* Quick links */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Run Compliance Assessment", icon: "📋", href: assessment ? `/assess/${assessment.id}` : "/compliance", show: canCompliance },
              { label: "Add Asset", icon: "💻", href: "/assets", show: canAssets },
              { label: "Add Network Device", icon: "🌐", href: "/network", show: canNetwork },
              { label: "Add Contract", icon: "📄", href: "/contracts", show: canContracts },
            ].filter(l => l.show).map(l => (
              <button key={l.href} onClick={() => router.push(l.href)}
                className="bg-white border rounded-xl p-4 text-left hover:bg-gray-50 transition-colors shadow-sm">
                <div className="text-2xl mb-1">{l.icon}</div>
                <div className="text-sm font-medium text-gray-700">{l.label}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
