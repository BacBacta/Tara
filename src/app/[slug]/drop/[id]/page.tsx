import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { openDueDrops } from "@/lib/drops";
import { fcfa } from "@/lib/format";
import TikTokPixel from "@/components/TikTokPixel";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string; id: string };
  searchParams: { alert?: string };
};

export default async function DropPage({ params, searchParams }: Props) {
  const shop = await db
    .selectFrom("shops").select(["id", "slug", "name"])
    .where("slug", "=", params.slug).where("suspended", "=", 0)
    .executeTakeFirst();
  if (!shop) notFound();
  await openDueDrops(shop.id);

  const drop = await db
    .selectFrom("drops").selectAll()
    .where("id", "=", params.id).where("shop_id", "=", shop.id)
    .executeTakeFirst();
  if (!drop) notFound();

  const items = await db
    .selectFrom("drop_products")
    .innerJoin("products", "products.id", "drop_products.product_id")
    .select(["products.id", "products.name", "products.price_fcfa", "products.stock_qty"])
    .where("drop_products.drop_id", "=", drop.id)
    .where("products.removed", "=", 0)
    .execute();
  const alerts = await db
    .selectFrom("drop_alerts").select(db.fn.countAll<number>().as("n"))
    .where("drop_id", "=", drop.id).executeTakeFirst();

  const opensAt = new Date(drop.opens_at);
  const open = drop.status === "open" || opensAt.getTime() <= Date.now();
  const remaining = items.reduce((a, i) => a + (i.stock_qty ?? 0), 0);

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-4">
      <TikTokPixel />
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/${shop.slug}`} aria-label="Retour"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white">←</Link>
        <b className="text-sm">📦 {drop.title}</b>
      </div>

      {open ? (
        <>
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-extrabold text-okgreen">
            C&apos;est ouvert ! {remaining > 0 ? `${remaining} pièces restantes` : "Tout est parti"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {items.map((i) => (
              <Link key={i.id} href={`/${shop.slug}/p/${i.id}?src=drop`}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="flex h-24 items-center justify-center bg-gradient-to-br from-[#FBE3D2] to-[#F2B98F] text-3xl">
                  🛍️
                </div>
                <p className="px-2.5 pt-2 text-xs font-bold">{i.name}</p>
                <p className="px-2.5 pb-2 text-sm font-extrabold text-indigo9">{fcfa(i.price_fcfa)}</p>
                {i.stock_qty !== null && (
                  <p className={`mx-2.5 mb-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    i.stock_qty > 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                  }`}>
                    {i.stock_qty > 0 ? `${i.stock_qty} restants` : "épuisé"}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-center text-sm text-gray-500">
            Ouverture le{" "}
            <b className="text-ink">
              {opensAt.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}
            </b>{" "}
            — premiers arrivés, premiers servis.
          </p>
          {/* compte à rebours sans JavaScript : recalculé à chaque rendu */}
          <div className="mt-4 flex justify-center gap-2">
            {(() => {
              const ms = Math.max(0, opensAt.getTime() - Date.now());
              const d = Math.floor(ms / 86400000);
              const h = Math.floor((ms % 86400000) / 3600000);
              const m = Math.floor((ms % 3600000) / 60000);
              return [
                [d, "jours"], [h, "heures"], [m, "min"],
              ].map(([v, l]) => (
                <div key={l as string} className="w-20 rounded-2xl border border-gray-200 bg-white py-2.5 text-center">
                  <p className="text-xl font-extrabold tabular-nums">{String(v).padStart(2, "0")}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{l}</p>
                </div>
              ));
            })()}
          </div>

          <p className="mt-5 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
            {items.length} pièce{items.length > 1 ? "s" : ""} en aperçu
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {items.map((i) => (
              <div key={i.id}
                className="relative flex h-20 items-center justify-center rounded-xl border border-gray-200 bg-white text-2xl opacity-60 grayscale">
                🛍️
                <span className="absolute bottom-1.5 right-2 text-[10px]">🔒</span>
              </div>
            ))}
          </div>

          {searchParams.alert === "ok" ? (
            <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-xs font-bold text-okgreen">
              ✓ Alerte programmée — tu recevras un message WhatsApp à l&apos;ouverture.
            </p>
          ) : (
            <form method="post" action={`/${shop.slug}/drop/${drop.id}/alerte`} className="mt-5">
              <div className="flex gap-1.5">
                <input name="phone" inputMode="tel" required placeholder="6 77 12 34 56"
                  className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-3 text-sm font-bold focus:border-indigo9 focus:outline-none" />
                <button className="rounded-xl bg-mango px-4 py-3 text-sm font-extrabold text-[#3A2A00]">
                  🔔 M&apos;alerter
                </button>
              </div>
            </form>
          )}
          <p className="mt-2 text-center text-[11px] text-gray-500">
            {Number(alerts?.n ?? 0)} personne(s) suivent déjà ce drop.
          </p>
        </>
      )}
    </main>
  );
}
