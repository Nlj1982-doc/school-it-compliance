import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId: string;
  username: string;
  role: "admin" | "user";
  schoolName: string | null;
}

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "change-this-secret-to-something-long-and-random-32chars",
  cookieName: "school-compliance-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}
