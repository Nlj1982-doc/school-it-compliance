import type { SessionOptions } from "iron-session";

export interface SessionData {
  userId: string;
  username: string;
  role: "admin" | "user";
  schoolId: string | null;
  schoolName: string | null;
  canHelpdesk?: boolean;
  canCompliance?: boolean;
  canContracts?: boolean;
  canAssets?: boolean;
  canNetwork?: boolean;
  canLoans?: boolean;
  canDirectory?: boolean;
}

export const SESSION_OPTIONS: SessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    "change-this-secret-to-something-long-and-random-32chars",
  cookieName: "school-compliance-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
