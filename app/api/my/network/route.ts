import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

async function getSchoolId(): Promise<string | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return session.schoolId ?? null;
}

export async function GET() {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const rows = getDb()
    .prepare("SELECT * FROM network_devices WHERE school_id = ? ORDER BY device_type ASC, device_name ASC")
    .all(schoolId);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json();

  if (Array.isArray(body)) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO network_devices (id, school_id, device_type, asset_tag, device_name, make, model,
        serial_number, ip_address, mac_address, management_url, vlan, port_count, firmware_version,
        location, cabinet, purchase_date, warranty_end_date, warranty_type,
        support_contract, support_expiry, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((rows: typeof body) => {
      let count = 0;
      for (const row of rows) {
        if (!row.device_type?.trim()) continue;
        stmt.run(
          randomUUID(), schoolId,
          row.device_type.trim(), row.asset_tag?.trim() || null,
          row.device_name?.trim() || null, row.make?.trim() || null, row.model?.trim() || null,
          row.serial_number?.trim() || null, row.ip_address?.trim() || null,
          row.mac_address?.trim() || null, row.management_url?.trim() || null,
          row.vlan?.trim() || null, row.port_count?.trim() || null,
          row.firmware_version?.trim() || null, row.location?.trim() || null,
          row.cabinet?.trim() || null, row.purchase_date || null,
          row.warranty_end_date || null, row.warranty_type?.trim() || null,
          row.support_contract?.trim() || null, row.support_expiry || null,
          row.status?.trim() || "Active", row.notes?.trim() || null,
          new Date().toISOString()
        );
        count++;
      }
      return count;
    });
    const imported = insertMany(body);
    return NextResponse.json({ ok: true, imported });
  }

  if (!body.device_type?.trim())
    return NextResponse.json({ error: "Device type is required" }, { status: 400 });
  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO network_devices (id, school_id, device_type, asset_tag, device_name, make, model,
      serial_number, ip_address, mac_address, management_url, vlan, port_count, firmware_version,
      location, cabinet, purchase_date, warranty_end_date, warranty_type,
      support_contract, support_expiry, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, schoolId,
    body.device_type.trim(), body.asset_tag?.trim() ?? null,
    body.device_name?.trim() ?? null, body.make?.trim() ?? null, body.model?.trim() ?? null,
    body.serial_number?.trim() ?? null, body.ip_address?.trim() ?? null,
    body.mac_address?.trim() ?? null, body.management_url?.trim() ?? null,
    body.vlan?.trim() ?? null, body.port_count?.trim() ?? null,
    body.firmware_version?.trim() ?? null, body.location?.trim() ?? null,
    body.cabinet?.trim() ?? null, body.purchase_date ?? null,
    body.warranty_end_date ?? null, body.warranty_type?.trim() ?? null,
    body.support_contract?.trim() ?? null, body.support_expiry ?? null,
    body.status?.trim() ?? "Active", body.notes?.trim() ?? null,
    new Date().toISOString()
  );
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json();
  const { id, ...f } = body;
  if (!id) return NextResponse.json({ error: "Device id required" }, { status: 400 });
  const existing = getDb().prepare("SELECT id FROM network_devices WHERE id = ? AND school_id = ?").get(id, schoolId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  getDb().prepare(`
    UPDATE network_devices SET device_type=?, asset_tag=?, device_name=?, make=?, model=?,
      serial_number=?, ip_address=?, mac_address=?, management_url=?, vlan=?, port_count=?,
      firmware_version=?, location=?, cabinet=?, purchase_date=?, warranty_end_date=?,
      warranty_type=?, support_contract=?, support_expiry=?, status=?, notes=?
    WHERE id=?
  `).run(
    f.device_type?.trim(), f.asset_tag?.trim() ?? null, f.device_name?.trim() ?? null,
    f.make?.trim() ?? null, f.model?.trim() ?? null, f.serial_number?.trim() ?? null,
    f.ip_address?.trim() ?? null, f.mac_address?.trim() ?? null, f.management_url?.trim() ?? null,
    f.vlan?.trim() ?? null, f.port_count?.trim() ?? null, f.firmware_version?.trim() ?? null,
    f.location?.trim() ?? null, f.cabinet?.trim() ?? null, f.purchase_date ?? null,
    f.warranty_end_date ?? null, f.warranty_type?.trim() ?? null,
    f.support_contract?.trim() ?? null, f.support_expiry ?? null,
    f.status?.trim() ?? "Active", f.notes?.trim() ?? null, id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const schoolId = await getSchoolId();
  if (!schoolId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await req.json();
  getDb().prepare("DELETE FROM network_devices WHERE id = ? AND school_id = ?").run(id, schoolId);
  return NextResponse.json({ ok: true });
}
