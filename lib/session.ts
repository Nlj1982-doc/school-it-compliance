import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS, type SessionData } from "./session-config";

export { SESSION_OPTIONS, type SessionData } from "./session-config";

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}
