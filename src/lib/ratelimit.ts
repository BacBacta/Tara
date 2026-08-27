// Limitation de débit — fenêtre glissante en mémoire.
// Suffisant pour la V1 mono-instance ; en multi-instance, remplacer le Map
// par Redis (même signature) sans toucher aux appelants.

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

/** Nettoyage paresseux : purge les compteurs expirés au fil des appels. */
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  cur.count += 1;
  const allowed = cur.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - cur.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((cur.resetAt - now) / 1000),
  };
}

/** IP du client derrière un reverse proxy (X-Forwarded-For). */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** Réinitialisation — usage tests uniquement. */
export function __resetRateLimits(): void {
  buckets.clear();
}
