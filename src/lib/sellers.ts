import { db, newId } from "./db";
import { slugify } from "./format";

export async function upsertSellerByPhone(phone: string, lang: "fr" | "en" = "fr") {
  const existing = await db
    .selectFrom("sellers")
    .selectAll()
    .where("phone", "=", phone)
    .executeTakeFirst();
  if (existing) return existing;
  const id = newId();
  await db
    .insertInto("sellers")
    .values({ id, phone, name: "", lang })
    .execute();
  return { id, phone, name: "", lang, created_at: new Date().toISOString() };
}

export async function getShopBySeller(sellerId: string) {
  return db
    .selectFrom("shops")
    .selectAll()
    .where("seller_id", "=", sellerId)
    .executeTakeFirst();
}

/** Slug unique : base, base-2, base-3… */
export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "ma-boutique";
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const taken = await db
      .selectFrom("shops")
      .select("id")
      .where("slug", "=", candidate)
      .executeTakeFirst();
    if (!taken) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
