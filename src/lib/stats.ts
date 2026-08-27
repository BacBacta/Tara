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
