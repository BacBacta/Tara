// Démarrage du flux Login Kit : état signé + redirection vers TikTok.
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { readSession } from "@/lib/session";
import { getTikTokProvider } from "@/lib/tiktok";

export async function POST() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);

  const state = randomBytes(16).toString("base64url");
  const redirectUri = `${base}/app/tiktok/callback`;
  const url = getTikTokProvider().authorizeUrl(state, redirectUri);

  const res = NextResponse.redirect(url, 303);
  res.cookies.set("tk_state", state, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
