import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { ORDER_STATUSES, canTransition, type OrderStatus } from "@/lib/orders";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

const STATUS_FR: Record<string, [string, string]> = {
  initiated: ["Initiée", "bg-ink/[0.06] text-inkSoft"],
  pending_payment: ["Attente paiement", "bg-amber-50 text-amber-700"],
  payment_announced: ["💰 Paiement annoncé — à vérifier", "bg-amber-50 text-amber-700"],
  paid: ["✓ Payée MoMo", "bg-emerald-50 text-okgreen"],
  to_deliver: ["🛵 À livrer", "bg-indigo9/10 text-indigo9"],
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
    <AppShell slug={shop.slug} active="/app/commandes" title="Commandes">
      <div className="flex flex-col gap-2.5">
        {orders.length === 0 && (
          <p className="card p-4 text-[12.5px] text-inkSoft">
            Aucune commande pour l&apos;instant.
          </p>
        )}
        {orders.map((o) => {
          const [txt, cls] = STATUS_FR[o.status] ?? [o.status, "bg-ink/[0.06] text-inkSoft"];
          const nexts = ORDER_STATUSES.filter(
            (s) => canTransition(o.status as OrderStatus, s) && NEXT_LABEL[s]
          );
          return (
            <div key={o.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 text-[12.5px]">
                <b className="min-w-0">
                  {o.id} · {o.product_name}
                  {o.variant ? ` (${o.variant})` : ""} × {o.qty}
                </b>
                <span className="shrink-0 font-display tabular-nums text-indigo9">
                  {fcfa(o.amount_fcfa)}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className={`chip font-extrabold ${cls}`}>{txt}</span>
                {o.buyer_phone && (
                  <a
                    href={`https://wa.me/${o.buyer_phone}?text=${encodeURIComponent(`Bonjour ! Au sujet de ta commande ${o.id} (${o.product_name})…`)}`}
                    className="chip bg-wagreen/15 font-extrabold text-waDeep"
                  >
                    💬 Écrire à la cliente
                  </a>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {nexts.map((s) => (
                  <form key={s} method="post" action="/app/commandes/update">
                    <input type="hidden" name="order" value={o.id} />
                    <input type="hidden" name="to" value={s} />
                    <button
                      type="submit"
                      className={`chip border font-extrabold transition-transform active:scale-[0.97] ${
                        s === "cancelled"
                          ? "border-red-200 text-red-500"
                          : "border-indigo9/35 text-indigo9"
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
    </AppShell>
  );
}
