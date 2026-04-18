// Backup provider sync — native fetch only, no external npm packages

export type BackupProvider = "veeam" | "acronis" | "datto" | "azure" | "manual";

export interface BackupJob {
  job_name: string;
  job_type: string | null;
  status: "Success" | "Warning" | "Failed" | "Running" | "Unknown";
  started_at: string | null;
  ended_at: string | null;
  size_gb: number | null;
  protected_items: number | null;
  error_message: string | null;
}

export interface VeeamConfig {
  server: string;
  username: string;
  password: string;
}

export interface AcronisConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface DattoConfig {
  apiKey: string;
  apiSecretKey: string;
}

export interface AzureBackupConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  resourceGroup: string;
  vaultName: string;
}

export interface ManualConfig {
  jobs: Array<{
    name: string;
    type?: string;
    status: string;
    lastRun?: string;
    sizeGb?: number;
    errorMessage?: string;
  }>;
}

function mapVeeamStatus(state: string, result: string | undefined): BackupJob["status"] {
  if (state === "Stopped") {
    if (result === "Succeeded") return "Success";
    if (result === "Failed") return "Failed";
    if (result === "Warning") return "Warning";
  }
  if (state === "Working") return "Running";
  return "Unknown";
}

export async function syncVeeam(cfg: VeeamConfig): Promise<BackupJob[]> {
  // Authenticate
  const tokenRes = await fetch(`${cfg.server}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=password&username=${encodeURIComponent(cfg.username)}&password=${encodeURIComponent(cfg.password)}`,
  });
  if (!tokenRes.ok) throw new Error(`Veeam auth failed: ${tokenRes.status}`);
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const token = tokenData.access_token;

  // Fetch jobs list
  const jobsRes = await fetch(`${cfg.server}/api/v1/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!jobsRes.ok) throw new Error(`Veeam jobs fetch failed: ${jobsRes.status}`);
  const jobsData = (await jobsRes.json()) as { data: Array<{ id: string; name: string; type: string }> };

  const results: BackupJob[] = [];

  for (const job of jobsData.data) {
    const sessRes = await fetch(
      `${cfg.server}/api/v1/jobSessions?jobId=${encodeURIComponent(job.id)}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!sessRes.ok) {
      results.push({
        job_name: job.name,
        job_type: job.type ?? null,
        status: "Unknown",
        started_at: null,
        ended_at: null,
        size_gb: null,
        protected_items: null,
        error_message: null,
      });
      continue;
    }
    const sessData = (await sessRes.json()) as {
      data: Array<{
        state: string;
        result?: { result: string; message?: string };
        startTime?: string;
        endTime?: string;
        statistics?: { processedObjects?: number; transferredSize?: number };
      }>;
    };
    const sess = sessData.data[0];
    if (!sess) {
      results.push({
        job_name: job.name,
        job_type: job.type ?? null,
        status: "Unknown",
        started_at: null,
        ended_at: null,
        size_gb: null,
        protected_items: null,
        error_message: null,
      });
      continue;
    }
    const transferredBytes = sess.statistics?.transferredSize ?? null;
    const sizeGb = transferredBytes !== null ? transferredBytes / (1024 ** 3) : null;
    results.push({
      job_name: job.name,
      job_type: job.type ?? null,
      status: mapVeeamStatus(sess.state, sess.result?.result),
      started_at: sess.startTime ?? null,
      ended_at: sess.endTime ?? null,
      size_gb: sizeGb,
      protected_items: sess.statistics?.processedObjects ?? null,
      error_message: sess.result?.message ?? null,
    });
  }

  return results;
}

function mapAcronisStatus(status: string): BackupJob["status"] {
  switch (status) {
    case "ok": return "Success";
    case "warning": return "Warning";
    case "error": return "Failed";
    case "running": return "Running";
    default: return "Unknown";
  }
}

export async function syncAcronis(cfg: AcronisConfig): Promise<BackupJob[]> {
  const creds = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");

  const tokenRes = await fetch(`${cfg.baseUrl}/bc/idp/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) throw new Error(`Acronis auth failed: ${tokenRes.status}`);
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const token = tokenData.access_token;

  const tasksRes = await fetch(
    `${cfg.baseUrl}/api/2/tasks?type=backup&order=desc%28completedAt%29&limit=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!tasksRes.ok) throw new Error(`Acronis tasks fetch failed: ${tasksRes.status}`);
  const tasksData = (await tasksRes.json()) as {
    items: Array<{
      id: string;
      type: string;
      status: string;
      completedAt?: string;
      startedAt?: string;
      context?: { machineId?: string };
      result?: { code?: string; error?: { code?: string; message?: string } };
    }>;
  };

  return tasksData.items.map((task) => ({
    job_name: task.context?.machineId ?? task.id,
    job_type: task.type ?? null,
    status: mapAcronisStatus(task.status),
    started_at: task.startedAt ?? null,
    ended_at: task.completedAt ?? null,
    size_gb: null,
    protected_items: null,
    error_message: task.result?.error?.message ?? null,
  }));
}

function mapDattoStatus(status: string): BackupJob["status"] {
  switch (status) {
    case "Completed": return "Success";
    case "Failed": return "Failed";
    default: return "Unknown";
  }
}

export async function syncDatto(cfg: DattoConfig): Promise<BackupJob[]> {
  const creds = Buffer.from(`${cfg.apiKey}:${cfg.apiSecretKey}`).toString("base64");
  const headers = { Authorization: `Basic ${creds}` };

  const devicesRes = await fetch("https://api.datto.com/v1/bcdr/device", { headers });
  if (!devicesRes.ok) throw new Error(`Datto devices fetch failed: ${devicesRes.status}`);
  const devicesData = (await devicesRes.json()) as {
    items: Array<{ serialNumber: string; name: string }>;
  };

  const results: BackupJob[] = [];

  for (const device of devicesData.items) {
    const assetsRes = await fetch(
      `https://api.datto.com/v1/bcdr/device/${encodeURIComponent(device.serialNumber)}/asset`,
      { headers }
    );
    if (!assetsRes.ok) continue;
    const assetsData = (await assetsRes.json()) as {
      items: Array<{
        name: string;
        backups?: {
          lastBackup?: { timestamp?: number; status?: string };
        };
      }>;
    };

    for (const asset of assetsData.items) {
      const lb = asset.backups?.lastBackup;
      const startedAt =
        lb?.timestamp != null
          ? new Date(lb.timestamp * 1000).toISOString()
          : null;
      results.push({
        job_name: `${device.name} — ${asset.name}`,
        job_type: null,
        status: mapDattoStatus(lb?.status ?? ""),
        started_at: startedAt,
        ended_at: startedAt,
        size_gb: null,
        protected_items: null,
        error_message: null,
      });
    }
  }

  return results;
}

function mapAzureStatus(status: string): BackupJob["status"] {
  switch (status) {
    case "Completed": return "Success";
    case "CompletedWithWarnings": return "Warning";
    case "Failed": return "Failed";
    case "InProgress": return "Running";
    default: return "Unknown";
  }
}

export async function syncAzureBackup(cfg: AzureBackupConfig): Promise<BackupJob[]> {
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: "https://management.azure.com/.default",
      }).toString(),
    }
  );
  if (!tokenRes.ok) throw new Error(`Azure auth failed: ${tokenRes.status}`);
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const token = tokenData.access_token;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const url =
    `https://management.azure.com/subscriptions/${cfg.subscriptionId}` +
    `/resourceGroups/${cfg.resourceGroup}` +
    `/providers/Microsoft.RecoveryServices/vaults/${cfg.vaultName}` +
    `/backupJobs?api-version=2023-01-01` +
    `&$filter=startTime ge '${sevenDaysAgo}'`;

  const jobsRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!jobsRes.ok) throw new Error(`Azure backup jobs fetch failed: ${jobsRes.status}`);
  const jobsData = (await jobsRes.json()) as {
    value: Array<{
      name: string;
      properties: {
        entityFriendlyName?: string;
        backupManagementType?: string;
        operation?: string;
        status: string;
        startTime?: string;
        endTime?: string;
        duration?: string;
        errorDetails?: Array<{ errorMessage?: string }>;
      };
    }>;
  };

  return jobsData.value.map((job) => ({
    job_name: job.properties.entityFriendlyName ?? job.name,
    job_type: job.properties.operation ?? null,
    status: mapAzureStatus(job.properties.status),
    started_at: job.properties.startTime ?? null,
    ended_at: job.properties.endTime ?? null,
    size_gb: null,
    protected_items: null,
    error_message: job.properties.errorDetails?.[0]?.errorMessage ?? null,
  }));
}

function mapManualStatus(status: string): BackupJob["status"] {
  const s = status.toLowerCase();
  if (s === "success") return "Success";
  if (s === "warning") return "Warning";
  if (s === "failed") return "Failed";
  if (s === "running") return "Running";
  return "Unknown";
}

export async function syncManual(cfg: ManualConfig): Promise<BackupJob[]> {
  return cfg.jobs.map((j) => ({
    job_name: j.name,
    job_type: j.type ?? null,
    status: mapManualStatus(j.status),
    started_at: j.lastRun ?? null,
    ended_at: j.lastRun ?? null,
    size_gb: j.sizeGb ?? null,
    protected_items: null,
    error_message: j.errorMessage ?? null,
  }));
}

export async function syncBackupProvider(
  provider: BackupProvider,
  config: unknown
): Promise<BackupJob[]> {
  switch (provider) {
    case "veeam":
      return syncVeeam(config as VeeamConfig);
    case "acronis":
      return syncAcronis(config as AcronisConfig);
    case "datto":
      return syncDatto(config as DattoConfig);
    case "azure":
      return syncAzureBackup(config as AzureBackupConfig);
    case "manual":
      return syncManual(config as ManualConfig);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
