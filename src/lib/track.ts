import { db, newId } from "./db";
import { detectChannel } from "./channel";

const BOT_RE = /bot|crawler|spider|curl|wget|lighthouse|headless|preview/i;

export function parseSource(searchParams: {
  v?: string | string[];
  src?: string | string[];
}): string {
  const v = typeof searchParams.v === "string" ? searchParams.v : undefined;
  const src = typeof searchParams.src === "string" ? searchParams.src : undefined;
  if (v) return `v:${v.slice(0, 40)}`;
  if (src) return `src:${src.slice(0, 40)}`;
  return "direct";
}

/** Query string à propager de la vitrine vers les fiches (attribution). */
export function keepAttribution(searchParams: {
  v?: string | string[];
  src?: string | string[];
}): string {
  const v = typeof searchParams.v === "string" ? searchParams.v : undefined;
  const src = typeof searchParams.src === "string" ? searchParams.src : undefined;
  if (v) return `?v=${encodeURIComponent(v.slice(0, 40))}`;
  if (src) return `?src=${encodeURIComponent(src.slice(0, 40))}`;
  return "";
}

export async function recordVisit(opts: {
  shopId: string;
  productId?: string | null;
  source: string;
  userAgent?: string | null;
}): Promise<void> {
  const ua = opts.userAgent ?? "";
  if (BOT_RE.test(ua)) return;
  try {
    await db
      .insertInto("visits")
      .values({
        id: newId(),
        shop_id: opts.shopId,
        product_id: opts.productId ?? null,
        source: opts.source,
        user_agent: ua.slice(0, 250) || null,
        // Déduit une seule fois, à l'écriture (voir lib/channel.ts).
        channel: detectChannel(ua, opts.source),
      })
      .execute();
  } catch {
    // le tracking ne doit jamais casser le rendu d'une vitrine
  }
}
