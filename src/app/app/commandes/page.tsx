import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { ORDER_STATUSES, canTransition, type OrderStatus } from "@/lib/orders";
import AppNav from "@/components/AppNav";

export const dynamic = "force-dynamic";

const STATUS_FR: Record<string, [string, string]> = {
  initiated: ["Initiée", "bg-gray-100 text-gray-600"],
  pending_payment: ["Attente paiement", "bg-amber-50 text-amber-700"],
  payment_announced: ["💰 Paiement annoncé — à vérifier", "bg-amber-50 text-amber-700"],
  paid: ["✓ Payée MoMo", "bg-emerald-50 text-okgreen"],
  to_deliver: ["🛵 À livrer", "bg-indigo-50 text-indigo9"],
  delivered: ["✓ Livrée", "bg-emerald-50 text-okgreen"],
  cancelled: ["Annulée", "bg-red-50 text-red-500"],
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  paid: "Marquer payée",
  to_deliver: "À livrer",
  delivered: "Livrée",
  cancelled: "Annuler",
};

export default async function Commandes() {
  const { shop } = await requireShop();
  const orders = await db
    .selectFrom("orders")
    .innerJoin("products", "products.id", "orders.product_id")
    .select([
      "orders.id", "orders.status", "orders.variant", "orders.qty",
      "orders.amount_fcfa", "orders.buyer_phone", "orders.created_at",
      "products.name as product_name",
    ])
    .where("orders.shop_id", "=", shop.id)
    .orderBy("orders.created_at", "desc")
    .limit(50)
    .execute();

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">Commandes</h1>
      <div className="mt-4 flex flex-col gap-2.5">
        {orders.length === 0 && (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-400">
            Aucune commande pour l&apos;instant.
          </p>
        )}
        {orders.map((o) => {
          const [txt, cls] = STATUS_FR[o.status] ?? [o.status, "bg-gray-100"];
          const nexts = ORDER_STATUSES.filter(
            (s) => canTransition(o.status as OrderStatus, s) && NEXT_LABEL[s]
          );
          return (
            <div key={o.id} className="rounded-2xl border border-gray-200 bg-white p-3.5">
              <div className="flex items-center justify-between text-xs">
                <b>{o.id} · {o.product_name}{o.variant ? ` (${o.variant})` : ""} × {o.qty}</b>
                <span className="tabular-nums font-extrabold text-indigo9">{fcfa(o.amount_fcfa)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>{txt}</span>
                {o.buyer_phone && (
                  <a
                    href={`https://wa.me/${o.buyer_phone}?text=${encodeURIComponent(`Bonjour ! Au sujet de ta commande ${o.id} (${o.product_name})…`)}`}
                    className="rounded-full bg-wagreen/15 px-2 py-0.5 text-[10px] font-extrabold text-[#0a7a41]"
                  >
                    💬 Écrire au client
                  </a>
                )}
                <span className="flex-1" />
                {nexts.map((s) => (
                  <form key={s} method="post" action="/app/commandes/update">
                    <input type="hidden" name="order" value={o.id} />
                    <input type="hidden" name="to" value={s} />
                    <button
                      type="submit"
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${
                        s === "cancelled"
                          ? "border-red-200 text-red-500"
                          : "border-indigo9/40 text-indigo9"
                      }`}
                    >
                      {NEXT_LABEL[s]}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <AppNav active="/app/commandes" />
    </main>
  );
}
