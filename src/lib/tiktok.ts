// Intégration TikTok officielle (V2) derrière une interface.
// V1 du branchement : implémentation MOCK complète — aucune requête réseau.
// L'implémentation réelle utilisera Login Kit (OAuth), la Display API
// (user.info.profile, user.info.stats, video.list) et les webhooks.
import { z } from "zod";

export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
] as const;

export interface TikTokProfile {
  openId: string;
  username: string;
  avatarUrl: string;
  followerCount: number;
  likesCount: number;
}

export interface TikTokVideo {
  id: string;
  title: string;
  coverUrl: string;
  views: number;
  likes: number;
  publishedAt: string;
}

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  scopes: string;
}

export interface TikTokProvider {
  readonly name: string;
  /** URL d'autorisation (Login Kit) vers laquelle rediriger la vendeuse. */
  authorizeUrl(state: string, redirectUri: string): string;
  /** Échange le code d'autorisation contre des jetons. */
  exchangeCode(code: string, redirectUri: string): Promise<TikTokTokens>;
  /** Profil + statistiques (user.info.profile / user.info.stats). */
  fetchProfile(accessToken: string): Promise<TikTokProfile>;
  /** Vidéos publiques récentes (video.list). */
  listVideos(accessToken: string, limit?: number): Promise<TikTokVideo[]>;
}

/** Déterministe : le même code produit toujours le même compte de démo. */
function seededInt(seed: string, min: number, max: number): number {
  // mélange FNV-1a + avalanche : deux graines proches donnent des valeurs éloignées
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0; // >>> 0 obligatoire : ^= renvoie un entier signé
  return min + (h % (max - min + 1));
}

export class MockTikTokProvider implements TikTokProvider {
  readonly name = "mock";

  authorizeUrl(state: string, redirectUri: string): string {
    // Le mock renvoie directement vers le callback avec un code fabriqué.
    const p = new URLSearchParams({ code: `mock_code_${state.slice(0, 8)}`, state });
    return `${redirectUri}?${p.toString()}`;
  }

  async exchangeCode(code: string): Promise<TikTokTokens> {
    return {
      accessToken: `mock_at_${code}`,
      refreshToken: `mock_rt_${code}`,
      scopes: TIKTOK_SCOPES.join(","),
    };
  }

  async fetchProfile(accessToken: string): Promise<TikTokProfile> {
    const seed = accessToken.slice(-8);
    return {
      openId: `open_${seed}`,
      username: `boutique_${seed.slice(0, 4)}`,
      avatarUrl: "",
      followerCount: seededInt(seed, 800, 48000),
      likesCount: seededInt(`l${seed}`, 5000, 300000),
    };
  }

  async listVideos(accessToken: string, limit = 12): Promise<TikTokVideo[]> {
    const seed = accessToken.slice(-8);
    const titles = [
      "Colis venu de Dubaï 🔥", "Robes soirée — essayage", "Tri du samedi -50%",
      "Arrivage mèches 🔥", "Nouveautés de la semaine", "Unboxing du carton",
    ];
    return Array.from({ length: Math.min(limit, titles.length) }, (_, i) => ({
      id: `72${seededInt(`${seed}${i}`, 100000000000000, 999999999999999)}${i}`,
      title: titles[i],
      coverUrl: "",
      views: seededInt(`v${seed}${i}`, 1200, 90000),
      likes: seededInt(`k${seed}${i}`, 80, 6000),
      publishedAt: new Date(Date.now() - (i + 1) * 3 * 86400_000).toISOString(),
    }));
  }
}

export function getTikTokProvider(): TikTokProvider {
  // TIKTOK_PROVIDER=real → implémentation OAuth réelle (à écrire au branchement)
  return new MockTikTokProvider();
}

/** Payload des webhooks TikTok traités en V2. */
export const tiktokWebhookInput = z.object({
  event: z.enum(["video.publish.complete", "authorization.removed"]),
  open_id: z.string().min(3).max(120),
  event_id: z.string().min(3).max(120),
  video_id: z.string().max(40).optional(),
});
export type TikTokWebhookInput = z.infer<typeof tiktokWebhookInput>;
