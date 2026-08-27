// Session vendeuse : cookie httpOnly signé HMAC-SHA256 (sans dépendance).
// Payload : { sid: sellerId, exp: epoch_s } encodé base64url + signature.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "bs_session";
const TTL_S = 60 * 60 * 24 * 30; // 30 jours

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET manquant ou trop court");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function makeSessionCookie(sellerId: string): {
  name: string;
  value: string;
  options: Record<string, unknown>;
} {
  const payload = Buffer.from(
    JSON.stringify({ sid: sellerId, exp: Math.floor(Date.now() / 1000) + TTL_S })
  ).toString("base64url");
  return {
    name: COOKIE,
    value: `${payload}.${sign(payload)}`,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL_S,
    },
  };
}

export function readSession(): { sellerId: string } | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.sid !== "string") return null;
    if (typeof data.exp !== "number" || data.exp * 1000 < Date.now()) return null;
    return { sellerId: data.sid };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
