import { db } from "./db";

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 19).replace("T", " ");
}

export interface Kpis {
  orders: number;
  revenue: number;
  visits: number;
}

export async function kpis(shopId: string, days: number): Promise<Kpis> {
  const since = sinceIso(days);
  const o = await db
    .selectFrom("orders")
    .select([db.fn.countAll<number>().as("n"), db.fn.sum<number>("amount_fcfa").as("s")])
    .where("shop_id", "=", shopId)
    .where("created_at", ">", since)
    .where("status", "in", ["paid", "to_deliver", "delivered"])
    .executeTakeFirst();
  const v = await db
    .selectFrom("visits")
    .select(db.fn.countAll<number>().as("n"))
    .where("shop_id", "=", shopId)
    .where("created_at", ">", since)
    .executeTakeFirst();
  return {
    orders: Number(o?.n ?? 0),
    revenue: Number(o?.s ?? 0),
    visits: Number(v?.n ?? 0),
  };
}

export interface SourceStat {
  source: string;
  visits: number;
  orders: number;
}

/** Visites et commandes par source (v:{video} / src:{canal}) sur 30 jours. */
export async function statsBySource(shopId: string): Promise<SourceStat[]> {
  const since = sinceIso(30);
  const visits = await db
    .selectFrom("visits")
    .select(["source", db.fn.countAll<number>().as("n")])
    .where("shop_id", "=", shopId)
    .where("created_at", ">", since)
    .groupBy("source")
    .execute();
  const orders = await db
    .selectFrom("orders")
    .select(["source", db.fn.countAll<number>().as("n")])
    .where("shop_id", "=", shopId)
    .where("created_at", ">", since)
    .groupBy("source")
    .execute();
  const map = new Map<string, SourceStat>();
  for (const v of visits) {
    const key = v.source ?? "direct";
    map.set(key, { source: key, visits: Number(v.n), orders: 0 });
  }
  for (const o of orders) {
    const key = o.source ?? "direct";
    const cur = map.get(key) ?? { source: key, visits: 0, orders: 0 };
    cur.orders = Number(o.n);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders || b.visits - a.visits);
}

// ===== V2 : funnel vues → visites → commandes par vidéo (G4) =====

export interface VideoFunnel {
  videoId: string;
  title: string;
  views: number;
  visits: number;
  orders: number;
  conversion: number; // commandes / vues, en %
}

export async function videoFunnel(shopId: string): Promise<VideoFunnel[]> {
  const since = sinceIso(30);
  const videos = await db
    .selectFrom("videos")
    .select(["id", "title", "views"])
    .where("shop_id", "=", shopId)
    .orderBy("published_at", "desc")
    .execute();
  if (videos.length === 0) return [];

  const visits = await db
    .selectFrom("visits")
    .select(["source", db.fn.countAll<number>().as("n")])
    .where("shop_id", "=", shopId)
    .where("created_at", ">", since)
    .groupBy("source")
    .execute();
  const orders = await db
    .selectFrom("orders")
    .select(["source", db.fn.countAll<number>().as("n")])
    .where("shop_id", "=", shopId)
    .where("created_at", ">", since)
    .groupBy("source")
    .execute();
  const vMap = new Map(visits.map((v) => [v.source ?? "", Number(v.n)]));
  const oMap = new Map(orders.map((o) => [o.source ?? "", Number(o.n)]));

  return videos
    .map((v) => {
      const key = `v:${v.id}`;
      const visitsN = vMap.get(key) ?? 0;
      const ordersN = oMap.get(key) ?? 0;
      return {
        videoId: v.id,
        title: v.title,
        views: v.views,
        visits: visitsN,
        orders: ordersN,
        conversion: v.views > 0 ? (ordersN / v.views) * 100 : 0,
      };
    })
    .sort((a, b) => b.orders - a.orders || b.visits - a.visits);
}
