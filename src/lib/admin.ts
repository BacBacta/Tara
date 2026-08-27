import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, newId } from "./db";

const COOKIE = "bs_admin";
const TTL_S = 60 * 60 * 8; // 8 h

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET manquant");
  return s;
}

/** Hash scrypt salé, format "salt:hash" (pas de dépendance externe). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function makeAdminCookie(adminId: string, email: string) {
  const payload = Buffer.from(
    JSON.stringify({ aid: adminId, em: email, exp: Math.floor(Date.now() / 1000) + TTL_S })
  ).toString("base64url");
  return {
    name: COOKIE,
    value: `${payload}.${sign(payload)}`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL_S,
    },
  };
}

export function readAdmin(): { adminId: string; email: string } | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const a = Buffer.from(raw.slice(dot + 1));
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof d.aid !== "string" || typeof d.exp !== "number") return null;
    if (d.exp * 1000 < Date.now()) return null;
    return { adminId: d.aid, email: String(d.em ?? "") };
  } catch {
    return null;
  }
}

export function requireAdmin(): { adminId: string; email: string } {
  const admin = readAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export const ADMIN_COOKIE = COOKIE;

/** Journalise toute action d'administration (traçabilité). */
export async function audit(actor: string, action: string, target: string) {
  await db
    .insertInto("audit_log")
    .values({ id: newId(), actor, action, target })
    .execute();
}
