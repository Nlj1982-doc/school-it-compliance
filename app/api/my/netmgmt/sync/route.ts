import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { syncNetMgmt, type NetMgmtProvider } from "@/lib/network-firmware-sync";
import { decryptConfig } from "@/lib/config-crypto";

async function requireSchool() {
  const session = await getSession();
  if (!session.userId || !session.schoolId) return null;
  return session.schoolId;
}

// GET — return all devices + connections for the school
export async function GET() {
  const schoolId = await requireSchool();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const connections = getDb()
    .prepare(
      "SELECT id, provider, label, last_polled, last_error FROM netmgmt_connections WHERE school_id = ?"
    )
    .all(schoolId);

  const devices = getDb()
    .prepare(
      `SELECT d.*, c.provider, c.label
       FROM netmgmt_devices d
       JOIN netmgmt_connections c ON c.id = d.connection_id
       WHERE d.school_id = ?
       ORDER BY d.polled_at DESC`
    )
    .all(schoolId);

  return NextResponse.json({ connections, devices });
}

// POST — sync a specific connection
export async function POST(req: NextRequest) {
  const schoolId = await requireSchool();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = (await req.json()) as { connectionId?: string };
  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  const conn = getDb()
    .prepare(
      "SELECT id, provider, config FROM netmgmt_connections WHERE id = ? AND school_id = ?"
    )
    .get(body.connectionId, schoolId) as
    | { id: string; provider: string; config: string }
    | undefined;

  if (!conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  let networkDevices;
  try {
    const config = decryptConfig(conn.config);
    networkDevices = await syncNetMgmt(conn.provider as NetMgmtProvider, config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    getDb()
      .prepare("UPDATE netmgmt_connections SET last_error = ? WHERE id = ? AND school_id = ?")
      .run(msg, conn.id, schoolId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const now = new Date().toISOString();

  // Delete old devices for this connection
  getDb()
    .prepare("DELETE FROM netmgmt_devices WHERE connection_id = ?")
    .run(conn.id);

  // Insert new devices
  const insert = getDb().prepare(
    `INSERT INTO netmgmt_devices (id, school_id, connection_id, device_name, device_type, model, mac_address, ip_address, firmware_version, latest_firmware, upgrade_available, status, polled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAll = getDb().transaction(() => {
    for (const dev of networkDevices) {
      insert.run(
        randomUUID(),
        schoolId,
        conn.id,
        dev.device_name,
        dev.device_type,
        dev.model,
        dev.mac_address,
        dev.ip_address,
        dev.firmware_version,
        dev.latest_firmware,
        dev.upgrade_available ? 1 : 0,
        dev.status,
        now
      );
    }
  });
  insertAll();

  // Update connection metadata
  getDb()
    .prepare(
      "UPDATE netmgmt_connections SET last_polled = ?, last_error = NULL WHERE id = ? AND school_id = ?"
    )
    .run(now, conn.id, schoolId);

  return NextResponse.json({ ok: true, count: networkDevices.length });
}
