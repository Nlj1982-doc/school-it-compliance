"use client";

import { useParams } from "next/navigation";
import SchoolNav from "@/components/SchoolNav";
import { useState, useEffect } from "react";

export default function AdminHelpdeskRedirect() {
  const params = useParams();
  const schoolId = params.id as string;
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    fetch(`/api/admin/schools/${schoolId}`)
      .then(r => r.json())
      .then(d => setSchoolName(d?.name ?? ""));
  }, [schoolId]);

  return (
    <main className="min-h-screen bg-gray-50">
      <SchoolNav schoolId={schoolId} schoolName={schoolName} />
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🎫</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Helpdesk is school-managed</h2>
        <p className="text-gray-500 mb-6">
          The helpdesk is managed by the school&apos;s IT coordinator directly from their user portal.
          Staff submit requests and the IT coordinator tracks and resolves them — all from the school login.
        </p>
        <p className="text-sm text-gray-400">
          To grant helpdesk access to a user, go to the <strong>Users</strong> tab in the Admin Portal and toggle <strong>Helpdesk</strong> on for the relevant account.
        </p>
      </div>
    </main>
  );
}
