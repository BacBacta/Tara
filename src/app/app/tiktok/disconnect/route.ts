import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { revokeIdentity } from "@/lib/identities";

export async function POST() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  await revokeIdentity({ sellerId: session.sellerId });
  return NextResponse.redirect(`${base}/app/tiktok`, 303);
}
