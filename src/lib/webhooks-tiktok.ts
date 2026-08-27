// Traitement des webhooks TikTok (G3) — idempotent via webhook_events.dedup_key.
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { revokeIdentity, syncIdentity } from "./identities";
import { getNotifyProvider } from "./notify";
import type { TikTokWebhookInput } from "./tiktok";

export async function processTikTokWebhook(
  input: TikTokWebhookInput,
  raw: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ applied: boolean; action?: string }> {
  // 1) idempotence : l'insertion échoue si l'événement a déjà été reçu
  try {
    await dbi
      .insertInto("webhook_events")
      .values({
        id: newId(),
        provider: "tiktok",
        type: input.event,
        dedup_key: `tiktok:${input.event_id}`,
        payload: raw,
        processed_at: null,
      })
      .execute();
  } catch {
    return { applied: false }; // doublon → no-op
  }

  const markDone = async () =>
    dbi
      .updateTable("webhook_events")
      .set({ processed_at: new Date().toISOString() })
      .where("dedup_key", "=", `tiktok:${input.event_id}`)
      .execute();

  // 2) l'événement doit correspondre à une identité connue
  const identity = await dbi
    .selectFrom("external_identities")
    .select(["id", "seller_id", "status"])
    .where("provider", "=", "tiktok")
    .where("open_id", "=", input.open_id)
    .executeTakeFirst();
  if (!identity) {
    await markDone();
    return { applied: true, action: "unknown_open_id" };
  }

  if (input.event === "authorization.removed") {
    // exigence d'intégrité : le badge tombe immédiatement
    await revokeIdentity({ openId: input.open_id }, dbi);
    await markDone();
    return { applied: true, action: "revoked" };
  }

  // video.publish.complete → resynchroniser et inviter à taguer
  const shop = await dbi
    .selectFrom("shops")
    .select(["id", "slug"])
    .where("seller_id", "=", identity.seller_id)
    .executeTakeFirst();
  if (!shop) {
    await markDone();
    return { applied: true, action: "no_shop" };
  }

  await syncIdentity(identity.seller_id, shop.id, dbi);

  const seller = await dbi
    .selectFrom("sellers")
    .select(["phone"])
    .where("id", "=", identity.seller_id)
    .executeTakeFirst();
  if (seller) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    await getNotifyProvider().send({
      phone: seller.phone,
      template: "new_video_tag",
      body: "Nouvelle vidéo détectée — tague les articles qui y apparaissent pendant que le trafic est chaud.",
      link: `${base}/app/videos`,
    });
  }
  await markDone();
  return { applied: true, action: "synced_and_notified" };
}
