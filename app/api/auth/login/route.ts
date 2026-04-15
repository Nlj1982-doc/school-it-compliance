import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { User } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username.trim().toLowerCase()) as User | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.role = user.role;
  session.schoolName = user.school_name;
  await session.save();

  return NextResponse.json({ ok: true, role: user.role });
}
