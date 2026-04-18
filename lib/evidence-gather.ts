import type Database from "better-sqlite3";

// ── Types ─────────────────────────────────────────────────────────────────

export interface EvidenceFact {
  source: string;      // e.g. "Microsoft 365" | "Google Workspace" | "Directory (cached)"
  gathered_at: string; // ISO timestamp
  facts: string[];     // human-readable bullets
}

// ── Auto-evidence question map ────────────────────────────────────────────

export const AUTO_EVIDENCE_QUESTIONS: Record<string, {
  label: string;
  needsLiveApi: boolean;
}> = {
  "ce-7":   { label: "User role breakdown from directory",        needsLiveApi: false },
  "ce-8":   { label: "Admin account list from directory",         needsLiveApi: false },
  "ce-9":   { label: "MFA / 2-Step Verification status",         needsLiveApi: true  },
  "ce-10":  { label: "Active account count from directory",       needsLiveApi: false },
  "gdpr-2": { label: "Admin role holders from directory",         needsLiveApi: false },
};

// ── Directory-based (cached) evidence ────────────────────────────────────

export function gatherFromDirectory(
  questionId: string,
  schoolId: string,
  db: Database.Database
): EvidenceFact[] {
  const now = new Date().toISOString();

  if (questionId === "ce-7") {
    type RoleRow = { provider: string; role: string; cnt: number };
    const rows = db
      .prepare(
        "SELECT provider, role, COUNT(*) as cnt FROM directory_users WHERE school_id = ? GROUP BY provider, role ORDER BY provider, role"
      )
      .all(schoolId) as RoleRow[];

    if (rows.length === 0) return [];

    // Group by provider
    const byProvider: Record<string, RoleRow[]> = {};
    for (const row of rows) {
      if (!byProvider[row.provider]) byProvider[row.provider] = [];
      byProvider[row.provider].push(row);
    }

    return Object.entries(byProvider).map(([provider, provRows]) => {
      const facts = provRows.map(r => `${r.cnt} ${r.role}${r.cnt !== 1 ? "s" : ""}`);
      return {
        source: provider === "microsoft" ? "Microsoft 365" : provider === "google" ? "Google Workspace" : provider,
        gathered_at: now,
        facts,
      };
    });
  }

  if (questionId === "ce-8" || questionId === "gdpr-2") {
    type AdminRow = { provider: string; display_name: string; email: string | null };
    const rows = db
      .prepare(
        "SELECT provider, display_name, email FROM directory_users WHERE school_id = ? AND role = 'admin' ORDER BY provider, display_name"
      )
      .all(schoolId) as AdminRow[];

    if (rows.length === 0) {
      return [{
        source: "Directory (cached)",
        gathered_at: now,
        facts: ["No admin accounts found in synced directory data."],
      }];
    }

    const byProvider: Record<string, AdminRow[]> = {};
    for (const row of rows) {
      if (!byProvider[row.provider]) byProvider[row.provider] = [];
      byProvider[row.provider].push(row);
    }

    return Object.entries(byProvider).map(([provider, provRows]) => ({
      source: provider === "microsoft" ? "Microsoft 365" : provider === "google" ? "Google Workspace" : provider,
      gathered_at: now,
      facts: provRows.map(r => r.email ? `${r.display_name} (${r.email})` : r.display_name),
    }));
  }

  if (questionId === "ce-10") {
    type CountRow = { provider: string; cnt: number };
    const rows = db
      .prepare(
        "SELECT provider, COUNT(*) as cnt FROM directory_users WHERE school_id = ? GROUP BY provider"
      )
      .all(schoolId) as CountRow[];

    if (rows.length === 0) return [];

    return rows.map(row => ({
      source: row.provider === "microsoft" ? "Microsoft 365" : row.provider === "google" ? "Google Workspace" : row.provider,
      gathered_at: now,
      facts: [
        `${row.cnt} active accounts synced. Review against current staff list to confirm no leavers remain active.`,
      ],
    }));
  }

  return [];
}

// ── Live MFA evidence — Microsoft 365 ────────────────────────────────────

export async function gatherMfaFromMicrosoft(
  schoolId: string,
  db: Database.Database
): Promise<EvidenceFact> {
  const now = new Date().toISOString();

  // Import server-only deps dynamically so this file stays importable client-side
  // for AUTO_EVIDENCE_QUESTIONS (only the plain object is used client-side).
  const { decryptConfig } = await import("./config-crypto");

  const row = db
    .prepare("SELECT config FROM directory_connections WHERE school_id = ? AND provider = 'microsoft'")
    .get(schoolId) as { config: string } | undefined;

  if (!row) throw new Error("No Microsoft connection found");

  const cfg = decryptConfig(row.config) as { tenantId: string; clientId: string; clientSecret: string };

  // Get token
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const tokenData = (await tokenRes.json()) as Record<string, string>;
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "Failed to authenticate with Microsoft 365");
  }
  const token = tokenData.access_token;

  // Fetch MFA registration details
  const mfaRes = await fetch(
    "https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (mfaRes.status === 403 || mfaRes.status === 404) {
    return {
      source: "Microsoft 365",
      gathered_at: now,
      facts: [
        "Reports.Read.All permission not granted — ask your Azure admin to add this permission to your app registration.",
      ],
    };
  }

  type MfaUser = {
    id: string;
    userDisplayName: string;
    isMfaRegistered: boolean;
    isMfaCapable: boolean;
    isPasswordlessCapable: boolean;
    methodsRegistered: string[];
  };

  const mfaData = (await mfaRes.json()) as { value?: MfaUser[] };
  const users = mfaData.value ?? [];

  const total = users.length;
  const registered = users.filter(u => u.isMfaRegistered).length;
  const unregistered = users.filter(u => !u.isMfaRegistered);
  const pct = total > 0 ? Math.round((registered / total) * 100) : 0;

  // Method counts
  const methodCounts: Record<string, number> = {};
  for (const u of users) {
    for (const m of u.methodsRegistered ?? []) {
      methodCounts[m] = (methodCounts[m] ?? 0) + 1;
    }
  }
  const methodSummary = Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => `${m} (${c} users)`)
    .join(", ");

  // List unregistered users (up to 10)
  const unregNames = unregistered.slice(0, 10).map(u => u.userDisplayName);
  const moreCount = unregistered.length - 10;
  const unregList =
    unregistered.length === 0
      ? "All users have MFA registered."
      : unregNames.join(", ") + (moreCount > 0 ? `, and ${moreCount} more` : "");

  const facts = [
    `MFA registered: ${registered} of ${total} users (${pct}%)`,
    ...(methodSummary ? [`Methods in use: ${methodSummary}`] : []),
    `Users without MFA: ${unregList}`,
  ];

  return { source: "Microsoft 365 (live)", gathered_at: now, facts };
}

// ── Live MFA evidence — Google Workspace ─────────────────────────────────

export async function gatherMfaFromGoogle(
  schoolId: string,
  db: Database.Database
): Promise<EvidenceFact> {
  const now = new Date().toISOString();

  const { decryptConfig } = await import("./config-crypto");
  const crypto = await import("crypto");

  const row = db
    .prepare("SELECT config FROM directory_connections WHERE school_id = ? AND provider = 'google'")
    .get(schoolId) as { config: string } | undefined;

  if (!row) throw new Error("No Google connection found");

  const cfg = decryptConfig(row.config) as { adminEmail: string; domain: string; serviceAccountJson: string };

  // Parse service account key
  let key: { client_email: string; private_key: string; token_uri?: string };
  try {
    key = JSON.parse(cfg.serviceAccountJson) as typeof key;
  } catch {
    throw new Error("Service account JSON is not valid JSON");
  }

  // Build JWT (same pattern as directory-sync.ts)
  function b64url(data: string | Buffer): string {
    const buf = typeof data === "string" ? Buffer.from(data) : data;
    return buf.toString("base64url");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: key.client_email,
      sub: cfg.adminEmail,
      scope: "https://www.googleapis.com/auth/admin.directory.user.readonly",
      aud: key.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );
  const signing = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signing);
  const sig = signer.sign(key.private_key, "base64url");
  const jwt = `${signing}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenData = (await tokenRes.json()) as Record<string, string>;
  if (!tokenData.access_token) {
    throw new Error(
      tokenData.error_description ?? tokenData.error ?? "Failed to authenticate with Google Workspace"
    );
  }
  const token = tokenData.access_token;

  // Paginate through users
  type GoogleUser = {
    id: string;
    name?: { fullName?: string };
    primaryEmail?: string;
    suspended?: boolean;
    isEnrolledIn2Sv?: boolean;
  };

  const allUsers: GoogleUser[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      domain: cfg.domain,
      maxResults: "500",
      projection: "full",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `Directory API error ${res.status}`);
    }
    const page = (await res.json()) as { users?: GoogleUser[]; nextPageToken?: string };
    for (const u of page.users ?? []) {
      if (!u.suspended) allUsers.push(u);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  const total = allUsers.length;
  const enrolled = allUsers.filter(u => u.isEnrolledIn2Sv).length;
  const notEnrolled = allUsers.filter(u => !u.isEnrolledIn2Sv);
  const pct = total > 0 ? Math.round((enrolled / total) * 100) : 0;

  const notEnrolledNames = notEnrolled.slice(0, 10).map(u => u.name?.fullName ?? u.primaryEmail ?? "Unknown");
  const moreCount = notEnrolled.length - 10;
  const notEnrolledList =
    notEnrolled.length === 0
      ? "All users have 2SV enrolled."
      : notEnrolledNames.join(", ") + (moreCount > 0 ? `, and ${moreCount} more` : "");

  return {
    source: "Google Workspace (live)",
    gathered_at: now,
    facts: [
      `2-Step Verification enrolled: ${enrolled} of ${total} users (${pct}%)`,
      `Users without 2SV: ${notEnrolledList}`,
    ],
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────

export async function gatherEvidence(
  questionId: string,
  schoolId: string,
  db: Database.Database
): Promise<EvidenceFact[]> {
  const spec = AUTO_EVIDENCE_QUESTIONS[questionId];
  if (!spec) return [];

  const facts: EvidenceFact[] = [];

  if (!spec.needsLiveApi) {
    return gatherFromDirectory(questionId, schoolId, db);
  }

  // ce-9 only: MFA gathering
  if (questionId === "ce-9") {
    const msConn = db
      .prepare("SELECT config FROM directory_connections WHERE school_id = ? AND provider = 'microsoft'")
      .get(schoolId);
    if (msConn) {
      try {
        facts.push(await gatherMfaFromMicrosoft(schoolId, db));
      } catch (e: unknown) {
        facts.push({
          source: "Microsoft 365",
          gathered_at: new Date().toISOString(),
          facts: [`Error gathering MFA data: ${e instanceof Error ? e.message : "Unknown error"}`],
        });
      }
    }

    const gConn = db
      .prepare("SELECT config FROM directory_connections WHERE school_id = ? AND provider = 'google'")
      .get(schoolId);
    if (gConn) {
      try {
        facts.push(await gatherMfaFromGoogle(schoolId, db));
      } catch (e: unknown) {
        facts.push({
          source: "Google Workspace",
          gathered_at: new Date().toISOString(),
          facts: [`Error gathering 2SV data: ${e instanceof Error ? e.message : "Unknown error"}`],
        });
      }
    }

    if (facts.length === 0) {
      facts.push({
        source: "Directory",
        gathered_at: new Date().toISOString(),
        facts: [
          "No directory connections configured. Connect Microsoft 365 or Google Workspace from the Directory tab to gather MFA evidence.",
        ],
      });
    }
  }

  return facts;
}
