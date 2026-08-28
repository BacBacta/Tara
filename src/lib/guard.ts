import { redirect } from "next/navigation";
import { readSession } from "./session";
import { getShopBySeller } from "./sellers";
import type { ShopsTable } from "./schema";
import type { Selectable } from "kysely";

/** Garde des pages /app : session + boutique obligatoires. */
export async function requireShop(): Promise<{
  sellerId: string;
  shop: Selectable<ShopsTable>;
}> {
  const session = await readSession();
  if (!session) redirect("/creer");
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) redirect("/creer/boutique");
  return { sellerId: session.sellerId, shop };
}
