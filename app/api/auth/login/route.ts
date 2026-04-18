import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, s.name as school_name
    FROM users u
    LEFT JOIN schools s ON s.id = u.school_id
    WHERE u.username = ?
  `).get(username.trim().toLowerCase()) as (Record<string, string | number> | undefined);

  if (!user || !bcrypt.compareSync(password, user.password_hash as string)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id as string;
  session.username = user.username as string;
  session.role = user.role as "admin" | "user";
  session.schoolId = (user.school_id as string) ?? null;
  session.schoolName = (user.school_name as string) ?? null;
  session.canHelpdesk = !!(user.can_helpdesk);
  session.canCompliance = user.can_compliance !== 0;
  session.canContracts  = user.can_contracts  !== 0;
  session.canAssets     = user.can_assets     !== 0;
  session.canNetwork    = user.can_network    !== 0;
  session.canLoans      = user.can_loans      !== 0;
  session.canDirectory  = user.can_directory  !== 0;
  await session.save();

  return NextResponse.json({ ok: true, role: user.role });
}
