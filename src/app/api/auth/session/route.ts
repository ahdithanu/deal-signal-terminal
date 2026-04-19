import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  return NextResponse.json({
    session: {
      userId: session.userId,
      orgId: session.orgId,
      orgName: session.orgName,
      orgSlug: session.orgSlug,
      email: session.email,
      name: session.name,
      role: session.role,
    },
  });
}
