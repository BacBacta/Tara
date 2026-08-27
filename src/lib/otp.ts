import { createHash } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { phoneCm } from "./payments";

export { phoneCm };

/**
 * Fournisseur d'envoi d'OTP. Mock en V1 : le code est journalisé côté
 * serveur (et affiché à l'écran en dev). Le fournisseur réel enverra le
 * code par WhatsApp/SMS via un BSP local.
 */
export interface OtpProvider {
  readonly name: string;
  send(phone: string, code: string): Promise<void>;
}

class MockOtpProvider implements OtpProvider {
  readonly name = "mock";
  async send(phone: string, code: string): Promise<void> {
    console.log(`[OTP mock] ${phone} → code ${code}`);
  }
}

export function getOtpProvider(): OtpProvider {
  return new MockOtpProvider();
}

function hashCode(code: string): string {
  const secret = process.env.SESSION_SECRET ?? "dev";
  return createHash("sha256").update(`${code}:${secret}`).digest("hex");
}

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

export async function requestOtp(
  phone: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  // anti-abus : 5 envois max par heure et par numéro
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const recent = await dbi
    .selectFrom("otp_codes")
    .select(dbi.fn.countAll<number>().as("n"))
    .where("phone", "=", phone)
    .where("created_at", ">", oneHourAgo.slice(0, 19).replace("T", " "))
    .executeTakeFirst();
  if (Number(recent?.n ?? 0) >= MAX_SENDS_PER_HOUR) {
    return { ok: false, error: "too_many_requests" };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await dbi
    .insertInto("otp_codes")
    .values({
      id: newId(),
      phone,
      code_hash: hashCode(code),
      expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
      attempts: 0,
      consumed: 0,
    })
    .execute();

  await getOtpProvider().send(phone, code);
  const isMock = (process.env.OTP_PROVIDER ?? "mock") === "mock";
  return { ok: true, ...(isMock ? { devCode: code } : {}) };
}

export async function verifyOtp(
  phone: string,
  code: string,
  dbi: Kysely<DB> = defaultDb
): Promise<boolean> {
  const row = await dbi
    .selectFrom("otp_codes")
    .selectAll()
    .where("phone", "=", phone)
    .where("consumed", "=", 0)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  if (row.attempts >= MAX_ATTEMPTS) return false;

  await dbi
    .updateTable("otp_codes")
    .set((eb) => ({ attempts: eb("attempts", "+", 1) }))
    .where("id", "=", row.id)
    .execute();

  if (row.code_hash !== hashCode(code)) return false;

  await dbi
    .updateTable("otp_codes")
    .set({ consumed: 1 })
    .where("id", "=", row.id)
    .execute();
  return true;
}
