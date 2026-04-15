"use client";

import { useEffect, useState } from "react";

interface SessionUser {
  userId: string;
  username: string;
  role: string;
  schoolName: string | null;
}

export default function NavBar() {
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

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-blue-200 text-sm hidden sm:block">
        {user.schoolName ?? user.username}
      </span>
      {user.role === "admin" && (
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
  );
}
