// Gestion des comptes TikTok connectés (G1) et synchronisation (G2).
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { decryptToken, encryptToken } from "./crypto";
import { getTikTokProvider, type TikTokProfile, type TikTokTokens } from "./tiktok";

export async function getIdentity(
  sellerId: string,
  dbi: Kysely<DB> = defaultDb
) {
  return dbi
    .selectFrom("external_identities")
    .selectAll()
    .where("seller_id", "=", sellerId)
    .where("provider", "=", "tiktok")
    .executeTakeFirst();
}

/** Identité active d'une boutique (pour l'affichage du badge vérifié). */
export async function getShopIdentity(
  shopId: string,
  dbi: Kysely<DB> = defaultDb
) {
  return dbi
    .selectFrom("external_identities")
    .innerJoin("shops", "shops.seller_id", "external_identities.seller_id")
    .select([
      "external_identities.username", "external_identities.follower_count",
      "external_identities.status", "external_identities.open_id",
    ])
    .where("shops.id", "=", shopId)
    .where("external_identities.provider", "=", "tiktok")
    .where("external_identities.status", "=", "active")
    .executeTakeFirst();
}

export async function connectIdentity(
  sellerId: string,
  tokens: TikTokTokens,
  profile: TikTokProfile,
  dbi: Kysely<DB> = defaultDb
): Promise<void> {
  const existing = await getIdentity(sellerId, dbi);
  const values = {
    seller_id: sellerId,
    provider: "tiktok",
    open_id: profile.openId,
    username: profile.username,
    avatar_url: profile.avatarUrl || null,
    follower_count: profile.followerCount,
    likes_count: profile.likesCount,
    access_token_enc: encryptToken(tokens.accessToken),
    refresh_token_enc: encryptToken(tokens.refreshToken),
    scopes: tokens.scopes,
    status: "active",
    synced_at: new Date().toISOString(),
  };
  if (existing) {
    await dbi
      .updateTable("external_identities")
      .set(values)
      .where("id", "=", existing.id)
      .execute();
  } else {
    await dbi
      .insertInto("external_identities")
      .values({ id: newId(), ...values })
      .execute();
  }
}

/** Révocation : le badge tombe immédiatement (exigence d'intégrité G1). */
export async function revokeIdentity(
  where: { sellerId?: string; openId?: string },
  dbi: Kysely<DB> = defaultDb
): Promise<number> {
  let q = dbi
    .updateTable("external_identities")
    .set({ status: "revoked" })
    .where("provider", "=", "tiktok")
    .where("status", "=", "active");
  if (where.sellerId) q = q.where("seller_id", "=", where.sellerId);
  if (where.openId) q = q.where("open_id", "=", where.openId);
  const r = await q.executeTakeFirst();
  return Number(r.numUpdatedRows);
}

/**
 * Synchronise profil + vidéos depuis la Display API.
 * Respecte les quotas : appelée au plus 1×/jour ou sur webhook.
 */
export async function syncIdentity(
  sellerId: string,
  shopId: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ videos: number } | { error: string }> {
  const identity = await getIdentity(sellerId, dbi);
  if (!identity || identity.status !== "active") return { error: "not_connected" };
  const accessToken = decryptToken(identity.access_token_enc);
  if (!accessToken) return { error: "token_unreadable" };

  const provider = getTikTokProvider();
  const profile = await provider.fetchProfile(accessToken);
  const videos = await provider.listVideos(accessToken);

  await dbi
    .updateTable("external_identities")
    .set({
      username: profile.username,
      follower_count: profile.followerCount,
      likes_count: profile.likesCount,
      synced_at: new Date().toISOString(),
    })
    .where("id", "=", identity.id)
    .execute();

  for (const v of videos) {
    const existing = await dbi
      .selectFrom("videos")
      .select("id")
      .where("shop_id", "=", shopId)
      .where("tiktok_video_id", "=", v.id)
      .executeTakeFirst();
    if (existing) {
      await dbi
        .updateTable("videos")
        .set({ title: v.title, views: v.views, likes: v.likes, synced_at: new Date().toISOString() })
        .where("id", "=", existing.id)
        .execute();
    } else {
      await dbi
        .insertInto("videos")
        .values({
          id: newId(), shop_id: shopId, tiktok_video_id: v.id, title: v.title,
          cover_url: v.coverUrl || null, views: v.views, likes: v.likes,
          published_at: v.publishedAt,
        })
        .execute();
    }
  }
  return { videos: videos.length };
}

/** Articles tagués sur une vidéo. */
export async function tagProducts(
  videoId: string,
  productIds: string[],
  dbi: Kysely<DB> = defaultDb
): Promise<void> {
  await dbi.deleteFrom("video_products").where("video_id", "=", videoId).execute();
  for (const pid of productIds) {
    await dbi
      .insertInto("video_products")
      .values({ video_id: videoId, product_id: pid })
      .execute();
  }
}
