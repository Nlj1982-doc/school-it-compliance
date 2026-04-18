import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      userId: session.userId,
      username: session.username,
      role: session.role,
      schoolName: session.schoolName,
      canHelpdesk:   session.canHelpdesk   ?? false,
      canCompliance: session.canCompliance  ?? true,
      canContracts:  session.canContracts   ?? true,
      canAssets:     session.canAssets      ?? true,
      canNetwork:    session.canNetwork     ?? true,
      canLoans:      session.canLoans       ?? true,
      canDirectory:  session.canDirectory   ?? true,
    },
  });
}
