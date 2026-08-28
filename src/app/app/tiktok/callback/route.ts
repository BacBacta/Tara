// Retour d'autorisation TikTok : vérifie l'état, échange le code, synchronise.
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { getTikTokProvider } from "@/lib/tiktok";
import { connectIdentity, syncIdentity } from "@/lib/identities";

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("tk_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${base}/app/tiktok?err=state`, 303);
  }

  try {
    const provider = getTikTokProvider();
    const tokens = await provider.exchangeCode(code, `${base}/app/tiktok/callback`);
    const profile = await provider.fetchProfile(tokens.accessToken);
    await connectIdentity(session.sellerId, tokens, profile);
    await syncIdentity(session.sellerId, shop.id);
  } catch {
    return NextResponse.redirect(`${base}/app/tiktok?err=exchange`, 303);
  }

  const res = NextResponse.redirect(`${base}/app/tiktok?ok=1`, 303);
  res.cookies.set("tk_state", "", { maxAge: 0, path: "/" });
  return res;
}
