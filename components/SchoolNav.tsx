"use client";

import { useRouter, usePathname } from "next/navigation";

interface Props {
  schoolId: string;
  schoolName: string;
}

export default function SchoolNav({ schoolId, schoolName }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { label: "Profile", href: `/admin/schools/${schoolId}` },
    { label: "Contracts", href: `/admin/schools/${schoolId}/contracts` },
    { label: "Asset Log", href: `/admin/schools/${schoolId}/assets` },
    { label: "Network", href: `/admin/schools/${schoolId}/network` },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="bg-blue-800 text-white px-4 pt-4 shadow-md">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.push("/admin")} className="text-blue-200 text-sm hover:text-white mb-2 block">
          ← Back to Admin Portal
        </button>
        <h1 className="font-bold text-xl mb-3">{schoolName || "School"}</h1>
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
