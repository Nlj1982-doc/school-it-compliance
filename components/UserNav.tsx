"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface SessionUser {
  userId: string;
  username: string;
  role: string;
  schoolName: string | null;
}

export default function UserNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const tabs = [
    { label: "Dashboard", href: "/" },
    { label: "Contracts", href: "/contracts" },
    { label: "Asset Log", href: "/assets" },
    { label: "Network", href: "/network" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="bg-blue-800 text-white shadow-md">
      {/* Top bar */}
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏫</span>
          <div>
            <h1 className="font-bold text-lg leading-tight">UK School IT Compliance</h1>
            {user?.schoolName && (
              <p className="text-blue-200 text-sm leading-tight">{user.schoolName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "admin" && (
            <button
              onClick={() => { window.location.href = "/admin"; }}
              className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.href}
              onClick={() => router.push(t.href)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                isActive(t.href)
                  ? "bg-white text-blue-800"
                  : "text-blue-200 hover:text-white hover:bg-blue-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
