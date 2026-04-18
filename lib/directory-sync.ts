import crypto from "crypto";

// ── Shared types ──────────────────────────────────────────────────────────

export type UserRole = "student" | "teacher" | "staff" | "admin";

export interface DirectoryUser {
  external_id: string;
  display_name: string;
  email: string | null;
  role: UserRole;
  department: string | null;
  job_title: string | null;
  ou_path: string | null;
}

export interface MicrosoftConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface GoogleConfig {
  adminEmail: string;
  domain: string;
  serviceAccountJson: string; // raw JSON string
}

// ── Role detection ────────────────────────────────────────────────────────

function detectRole(
  jobTitle?: string | null,
  department?: string | null,
  ouPath?: string | null
): UserRole {
  const s = [jobTitle, department, ouPath]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/student|pupil|learner|year\s*\d/.test(s)) return "student";
  if (/\bteach|\bta\b|teaching assistant|instructor|lecturer/.test(s)) return "teacher";
  if (/\badmin|it manager|technician|network manager/.test(s)) return "admin";
  return "staff";
}

// ══════════════════════════════════════════════════════════════════════════
// Microsoft 365 — Graph API (client credentials flow, no extra packages)
// ══════════════════════════════════════════════════════════════════════════

async function getMicrosoftToken(cfg: MicrosoftConfig): Promise<string> {
  const res = await fetch(
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
  const data = (await res.json()) as Record<string, string>;
  if (!data.access_token) {
    throw new Error(
      data.error_description ?? data.error ?? "Failed to authenticate with Microsoft 365"
    );
  }
  return data.access_token;
}

async function graphGetAll(url: string, token: string): Promise<unknown[]> {
  const items: unknown[] = [];
  let next: string | null = url;
  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `Graph API error ${res.status}`);
    }
    const page = (await res.json()) as {
      value?: unknown[];
      "@odata.nextLink"?: string;
    };
    items.push(...(page.value ?? []));
    next = page["@odata.nextLink"] ?? null;
  }
  return items;
}

export async function syncMicrosoft(
  cfg: MicrosoftConfig
): Promise<DirectoryUser[]> {
  const token = await getMicrosoftToken(cfg);

  // Try Education API first (School Data Sync tenants — has primaryRole)
  try {
    type EduUser = {
      id: string;
      displayName?: string;
      mail?: string;
      primaryRole?: string;
      department?: string;
    };
    const eduUsers = (await graphGetAll(
      "https://graph.microsoft.com/beta/education/users?$select=id,displayName,mail,primaryRole,department&$top=999",
      token
    )) as EduUser[];

    if (eduUsers.length > 0) {
      return eduUsers.map((u) => ({
        external_id: u.id,
        display_name: u.displayName ?? "(no name)",
        email: u.mail ?? null,
        role:
          u.primaryRole === "student"
            ? "student"
            : u.primaryRole === "teacher"
            ? "teacher"
            : detectRole(null, u.department),
        department: u.department ?? null,
        job_title: null,
        ou_path: null,
      }));
    }
  } catch {
    // Not a School Data Sync tenant — fall through
  }

  // Standard users endpoint
  type GraphUser = {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
    jobTitle?: string;
    department?: string;
  };
  const rawUsers = (await graphGetAll(
    "https://graph.microsoft.com/v1.0/users" +
      "?$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled" +
      "&$top=999&$filter=accountEnabled eq true",
    token
  )) as GraphUser[];

  return rawUsers.map((u) => ({
    external_id: u.id,
    display_name: u.displayName ?? "(no name)",
    email: u.mail ?? u.userPrincipalName ?? null,
    role: detectRole(u.jobTitle, u.department),
    department: u.department ?? null,
    job_title: u.jobTitle ?? null,
    ou_path: null,
  }));
}

// ══════════════════════════════════════════════════════════════════════════
// Google Workspace — Admin SDK Directory API (JWT via built-in crypto)
// ══════════════════════════════════════════════════════════════════════════

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function b64url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

function makeGoogleJwt(
  key: ServiceAccountKey,
  subject: string,
  scopes: string[]
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: key.client_email,
      sub: subject,
      scope: scopes.join(" "),
      aud: key.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signing = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signing);
  const sig = signer.sign(key.private_key, "base64url");
  return `${signing}.${sig}`;
}

async function getGoogleToken(cfg: GoogleConfig): Promise<string> {
  let key: ServiceAccountKey;
  try {
    key = JSON.parse(cfg.serviceAccountJson) as ServiceAccountKey;
  } catch {
    throw new Error("Service account JSON is not valid JSON");
  }
  if (!key.client_email || !key.private_key) {
    throw new Error(
      "Service account JSON is missing client_email or private_key"
    );
  }

  const jwt = makeGoogleJwt(key, cfg.adminEmail, [
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
  ]);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as Record<string, string>;
  if (!data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        "Failed to authenticate with Google Workspace. Check admin email and domain-wide delegation."
    );
  }
  return data.access_token;
}

export async function syncGoogle(cfg: GoogleConfig): Promise<DirectoryUser[]> {
  const token = await getGoogleToken(cfg);
  const users: DirectoryUser[] = [];
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
      throw new Error(
        err.error?.message ?? `Directory API error ${res.status}`
      );
    }

    const page = (await res.json()) as {
      users?: Array<{
        id: string;
        name?: { fullName?: string; givenName?: string; familyName?: string };
        primaryEmail?: string;
        isAdmin?: boolean;
        suspended?: boolean;
        orgUnitPath?: string;
        organizations?: Array<{ title?: string; department?: string }>;
      }>;
      nextPageToken?: string;
    };

    for (const u of page.users ?? []) {
      if (u.suspended) continue;
      const org = u.organizations?.[0];
      const nameFull = u.name?.fullName;
      const nameComposed = `${u.name?.givenName ?? ""} ${u.name?.familyName ?? ""}`.trim();
      const name = nameFull ?? (nameComposed || "(no name)");
      users.push({
        external_id: u.id,
        display_name: name,
        email: u.primaryEmail ?? null,
        role: u.isAdmin
          ? "admin"
          : detectRole(org?.title, org?.department, u.orgUnitPath),
        department: org?.department ?? null,
        job_title: org?.title ?? null,
        ou_path: u.orgUnitPath ?? null,
      });
    }

    pageToken = page.nextPageToken;
  } while (pageToken);

  return users;
}

// ── Breakdown helper ──────────────────────────────────────────────────────

export function roleSummary(users: DirectoryUser[]) {
  return {
    total: users.length,
    student: users.filter((u) => u.role === "student").length,
    teacher: users.filter((u) => u.role === "teacher").length,
    staff: users.filter((u) => u.role === "staff").length,
    admin: users.filter((u) => u.role === "admin").length,
  };
}
