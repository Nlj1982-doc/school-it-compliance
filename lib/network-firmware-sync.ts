// Network management firmware sync — native fetch only, no external npm packages

export type NetMgmtProvider = "unifi" | "meraki" | "aruba" | "extreme";

export interface NetworkDevice {
  device_name: string;
  device_type: string | null;
  model: string | null;
  mac_address: string | null;
  ip_address: string | null;
  firmware_version: string | null;
  latest_firmware: string | null;
  upgrade_available: boolean;
  status: "Online" | "Offline" | "Unknown";
}

// UniFi — self-hosted Network Application or UniFi OS (UDM/UCK)
export interface UniFiConfig {
  host: string;      // https://192.168.1.1:8443 or https://unifi.local
  username: string;
  password: string;
  site: string;      // default "default"
  unifiOs: boolean;  // true for UDM Pro, UCK Gen2+; false for legacy controller
}

// Cisco Meraki Dashboard API
export interface MerakiConfig {
  apiKey: string;
  organizationId: string;
}

// Aruba Central
export interface ArubaConfig {
  baseUrl: string;   // e.g. https://apigw-prod2.central.arubanetworks.com
  clientId: string;
  clientSecret: string;
}

// Extreme Networks ExtremeCloud IQ (XIQ)
export interface ExtremeConfig {
  apiToken: string;  // long-lived API token from XIQ portal
}

function mapUniFiType(t: string | undefined): string | null {
  switch (t) {
    case "usw": return "switch";
    case "ugw": return "firewall";
    case "uap": return "ap";
    case "udm": return "gateway";
    default: return t ?? null;
  }
}

export async function syncUniFi(cfg: UniFiConfig): Promise<NetworkDevice[]> {
  const loginUrl = cfg.unifiOs
    ? `${cfg.host}/api/auth/login`
    : `${cfg.host}/api/login`;

  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: cfg.username, password: cfg.password, remember: false }),
  });
  if (!loginRes.ok) throw new Error(`UniFi login failed: ${loginRes.status}`);

  // Extract cookie from Set-Cookie header
  const rawCookie = loginRes.headers.get("set-cookie") ?? "";
  let cookieHeader: string;
  if (cfg.unifiOs) {
    const tokenMatch = rawCookie.match(/TOKEN=[^;]+/);
    if (!tokenMatch) throw new Error("UniFi OS: TOKEN cookie not found in login response");
    cookieHeader = tokenMatch[0];
  } else {
    const unifisesMatch = rawCookie.match(/unifises=[^;]+/);
    const tokenMatch = rawCookie.match(/TOKEN=[^;]+/);
    const matched = unifisesMatch ?? tokenMatch;
    if (!matched) throw new Error("UniFi: session cookie not found in login response");
    cookieHeader = matched[0];
  }

  const devicesUrl = cfg.unifiOs
    ? `${cfg.host}/proxy/network/api/s/${cfg.site}/stat/device`
    : `${cfg.host}/api/s/${cfg.site}/stat/device`;

  const devicesRes = await fetch(devicesUrl, {
    headers: { Cookie: cookieHeader },
  });
  if (!devicesRes.ok) throw new Error(`UniFi devices fetch failed: ${devicesRes.status}`);

  const devicesData = (await devicesRes.json()) as {
    data: Array<{
      name?: string;
      model?: string;
      type?: string;
      version?: string;
      upgrade_to_firmware?: string;
      upgradable?: boolean;
      mac?: string;
      ip?: string;
      state?: number;
    }>;
  };

  return (devicesData.data ?? []).map((d) => ({
    device_name: d.name ?? d.mac ?? "Unknown",
    device_type: mapUniFiType(d.type),
    model: d.model ?? null,
    mac_address: d.mac ?? null,
    ip_address: d.ip ?? null,
    firmware_version: d.version ?? null,
    latest_firmware: d.upgrade_to_firmware ?? null,
    upgrade_available: d.upgradable === true,
    status: d.state === 1 ? "Online" : d.state === 0 ? "Offline" : "Unknown",
  }));
}

function mapMerakiType(productType: string | undefined): string | null {
  switch (productType) {
    case "switch": return "switch";
    case "wireless": return "ap";
    case "appliance": return "firewall";
    default: return productType ?? null;
  }
}

export async function syncMeraki(cfg: MerakiConfig): Promise<NetworkDevice[]> {
  const res = await fetch(
    `https://api.meraki.com/api/v1/organizations/${cfg.organizationId}/devices`,
    { headers: { "X-Cisco-Meraki-API-Key": cfg.apiKey } }
  );
  if (!res.ok) throw new Error(`Meraki devices fetch failed: ${res.status}`);

  const data = (await res.json()) as Array<{
    serial: string;
    name?: string;
    model?: string;
    firmware?: string;
    lanIp?: string;
    mac?: string;
    productType?: string;
  }>;

  return data.map((d) => ({
    device_name: d.name ?? d.serial,
    device_type: mapMerakiType(d.productType),
    model: d.model ?? null,
    mac_address: d.mac ?? null,
    ip_address: d.lanIp ?? null,
    firmware_version: d.firmware ?? null,
    latest_firmware: null,
    upgrade_available: false,
    status: "Unknown",
  }));
}

function mapArubaStatus(s: string | undefined): "Online" | "Offline" | "Unknown" {
  if (s === "Up") return "Online";
  if (s === "Down") return "Offline";
  return "Unknown";
}

export async function syncAruba(cfg: ArubaConfig): Promise<NetworkDevice[]> {
  // Step 1 — get token
  const tokenRes = await fetch(`${cfg.baseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(cfg.clientId)}&client_secret=${encodeURIComponent(cfg.clientSecret)}`,
  });
  if (!tokenRes.ok) throw new Error(`Aruba auth failed: ${tokenRes.status}`);
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const token = tokenData.access_token;

  const headers = { Authorization: `Bearer ${token}` };

  // Step 2 — fetch three endpoints concurrently
  const [switchRes, apRes, gwRes] = await Promise.all([
    fetch(`${cfg.baseUrl}/monitoring/v1/switches?calculate_total=true&limit=100`, { headers }),
    fetch(`${cfg.baseUrl}/monitoring/v1/aps?calculate_total=true&limit=100`, { headers }),
    fetch(`${cfg.baseUrl}/monitoring/v1/gateways?calculate_total=true&limit=100`, { headers }),
  ]);

  const devices: NetworkDevice[] = [];

  type ArubaDevice = { name?: string; model?: string; firmware_version?: string; ip_address?: string; macaddr?: string; status?: string };

  if (switchRes.ok) {
    const d = (await switchRes.json()) as { switches?: ArubaDevice[] };
    for (const sw of d.switches ?? []) {
      devices.push({
        device_name: sw.name ?? "Unknown",
        device_type: "switch",
        model: sw.model ?? null,
        mac_address: sw.macaddr ?? null,
        ip_address: sw.ip_address ?? null,
        firmware_version: sw.firmware_version ?? null,
        latest_firmware: null,
        upgrade_available: false,
        status: mapArubaStatus(sw.status),
      });
    }
  }

  if (apRes.ok) {
    const d = (await apRes.json()) as { aps?: ArubaDevice[] };
    for (const ap of d.aps ?? []) {
      devices.push({
        device_name: ap.name ?? "Unknown",
        device_type: "ap",
        model: ap.model ?? null,
        mac_address: ap.macaddr ?? null,
        ip_address: ap.ip_address ?? null,
        firmware_version: ap.firmware_version ?? null,
        latest_firmware: null,
        upgrade_available: false,
        status: mapArubaStatus(ap.status),
      });
    }
  }

  if (gwRes.ok) {
    const d = (await gwRes.json()) as { gateways?: ArubaDevice[] };
    for (const gw of d.gateways ?? []) {
      devices.push({
        device_name: gw.name ?? "Unknown",
        device_type: "gateway",
        model: gw.model ?? null,
        mac_address: gw.macaddr ?? null,
        ip_address: gw.ip_address ?? null,
        firmware_version: gw.firmware_version ?? null,
        latest_firmware: null,
        upgrade_available: false,
        status: mapArubaStatus(gw.status),
      });
    }
  }

  return devices;
}

function mapExtremeType(productType: string | undefined): string | null {
  if (!productType) return null;
  if (productType.includes("Switch")) return "switch";
  if (productType.includes("Access Point") || productType.includes("AP")) return "ap";
  if (productType.includes("Router")) return "router";
  return null;
}

export async function syncExtreme(cfg: ExtremeConfig): Promise<NetworkDevice[]> {
  const res = await fetch(
    "https://api.extremecloudiq.com/devices?page=1&limit=100&views=FULL",
    { headers: { Authorization: `Bearer ${cfg.apiToken}` } }
  );
  if (!res.ok) throw new Error(`Extreme XIQ devices fetch failed: ${res.status}`);

  const data = (await res.json()) as {
    data: Array<{
      hostname?: string;
      product_type?: string;
      model_name?: string;
      primary_software_version?: string;
      connected?: boolean;
      mac_address?: string;
      ip_address?: string;
    }>;
  };

  return (data.data ?? []).map((d) => ({
    device_name: d.hostname ?? "Unknown",
    device_type: mapExtremeType(d.product_type),
    model: d.model_name ?? null,
    mac_address: d.mac_address ?? null,
    ip_address: d.ip_address ?? null,
    firmware_version: d.primary_software_version ?? null,
    latest_firmware: null,
    upgrade_available: false,
    status: d.connected ? "Online" : "Offline",
  }));
}

export async function syncNetMgmt(provider: NetMgmtProvider, config: unknown): Promise<NetworkDevice[]> {
  switch (provider) {
    case "unifi":   return syncUniFi(config as UniFiConfig);
    case "meraki":  return syncMeraki(config as MerakiConfig);
    case "aruba":   return syncAruba(config as ArubaConfig);
    case "extreme": return syncExtreme(config as ExtremeConfig);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}
