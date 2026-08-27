import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { syncIdentity } from "@/lib/identities";

export async function POST() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);
  const r = await syncIdentity(session.sellerId, shop.id);
  const q = "error" in r ? "?err=sync" : "?ok=1";
  return NextResponse.redirect(`${base}/app/tiktok${q}`, 303);
}
