import Link from "next/link";
import { requireShop } from "@/lib/guard";
import { kpis, statsBySource, videoFunnel } from "@/lib/stats";
import { isPaidActive, countActiveProducts, FREE_PRODUCT_LIMIT } from "@/lib/plan";
import { fcfa } from "@/lib/format";
import { db } from "@/lib/db";
import AppNav from "@/components/AppNav";

export const dynamic = "force-dynamic";

function label(source: string): string {
  if (source.startsWith("v:")) return `▶ vidéo …${source.slice(-6)}`;
  if (source.startsWith("src:")) return source.slice(4);
  return "direct";
}

export default async function AppHome(props: { searchParams: Promise<{ ok?: string }> }) {
  const searchParams = await props.searchParams;
  const { shop } = await requireShop();
  const [day, week, month] = await Promise.all([kpis(shop.id, 1), kpis(shop.id, 7), kpis(shop.id, 30)]);
  const sources = await statsBySource(shop.id);
  const funnel = await videoFunnel(shop.id);
  const best = funnel[0];
  const avgConv =
    funnel.length > 0
      ? funnel.reduce((a, f) => a + f.conversion, 0) / funnel.length
      : 0;
  const lastOrders = await db
    .selectFrom("orders")
    .innerJoin("products", "products.id", "orders.product_id")
    .select([
      "orders.id", "orders.status", "orders.amount_fcfa",
      "orders.created_at", "products.name as product_name",
    ])
    .where("orders.shop_id", "=", shop.id)
    .orderBy("orders.created_at", "desc")
    .limit(5)
    .execute();
  const paid = isPaidActive(shop);
  const nProducts = await countActiveProducts(shop.id);
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/^https?:\/\//, "");
  const maxVisits = Math.max(1, ...sources.map((s) => s.visits));

  const cells: Array<[string, typeof day]> = [["Aujourd'hui", day], ["7 jours", week], ["30 jours", month]];

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-extrabold">
          Bio·<span className="text-mango">Shop</span>
        </h1>
        <a href={`/${shop.slug}`} className="text-xs font-bold text-indigo9 underline">
          {base}/{shop.slug}
        </a>
      </div>

      {searchParams.ok === "sub" && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          ✓ Abonnement activé — articles illimités jusqu&apos;au{" "}
          {shop.plan_expires_at ? new Date(shop.plan_expires_at).toLocaleDateString("fr-FR") : ""}.
        </p>
      )}

      {!paid && (
        <Link
          href="/app/upgrade"
          className="mt-3 block rounded-2xl border border-indigo9/30 bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo9"
        >
          Palier gratuit : {nProducts}/{FREE_PRODUCT_LIMIT} articles utilisés — passe à
          l&apos;illimité pour 3 000 F/mois →
        </Link>
      )}

      <Link
        href="/app/tiktok"
        className="mt-3 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold"
      >
        <span className="text-base">🎵</span>
        Mon compte TikTok — badge vérifié et vidéos
        <span className="ml-auto text-indigo9">→</span>
      </Link>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["/app/videos", "▶", "Vidéos"],
          ["/app/drops", "📦", "Drops"],
          ["/app/avis", "★", "Avis"],
        ].map(([href, icon, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-center text-[11px] font-extrabold"
          >
            <span className="block text-base">{icon}</span>
            {label}
          </Link>
        ))}
      </div>

      <Link
        href="/app/partage"
        className="mt-3 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold"
      >
        <span className="text-base">🔗</span>
        Kit de partage — lien, QR code et texte à épingler
        <span className="ml-auto text-indigo9">→</span>
      </Link>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {cells.map(([labelTxt, k]) => (
          <div key={labelTxt} className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">{labelTxt}</p>
            <p className="mt-1 text-base font-extrabold tabular-nums">{k.orders} <span className="text-[10px] font-bold text-gray-400">cmd</span></p>
            <p className="text-[11px] font-bold tabular-nums text-okgreen">{fcfa(k.revenue)}</p>
            <p className="text-[10px] tabular-nums text-gray-400">{k.visits} visites</p>
          </div>
        ))}
      </div>

      {/* V2 — funnel de la meilleure vidéo */}
      {best && (
        <>
          <h2 className="mb-2 mt-6 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
            Ta meilleure vidéo (30 j)
          </h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-bold">▶ {best.title}</p>
            <div className="mt-2.5 flex items-stretch gap-1.5">
              {[
                ["Vues TikTok", best.views],
                ["Visites boutique", best.visits],
                ["Commandes", best.orders],
              ].map(([label, value], i) => (
                <div key={label as string} className="contents">
                  {i > 0 && <span className="self-center text-gray-300">›</span>}
                  <div className="flex-1 rounded-xl border border-gray-200 bg-sand p-2 text-center">
                    <p className="text-sm font-extrabold tabular-nums">
                      {Number(value).toLocaleString("fr-FR")}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                      {label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] font-extrabold text-okgreen">
              Conversion vues → commandes : {best.conversion.toFixed(2)} %
              {avgConv > 0 && (
                <span className="font-bold text-gray-400">
                  {" "}
                  (moyenne {avgConv.toFixed(2)} %)
                </span>
              )}
            </p>
          </div>
          <Link
            href="/app/videos"
            className="mt-2 block text-center text-[11px] font-extrabold text-indigo9"
          >
            Voir toutes mes vidéos et taguer mes articles →
          </Link>
        </>
      )}

      {/* ventes par source / vidéo */}
      <h2 className="mb-2 mt-6 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
        Visites & commandes par source (30 j)
      </h2>
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {sources.length === 0 && (
          <p className="text-xs text-gray-400">Partage ton lien pour voir d&apos;où viennent tes clients.</p>
        )}
        {sources.slice(0, 5).map((s) => (
          <div key={s.source} className="flex items-center gap-2 py-1.5 text-xs">
            <span className="w-28 shrink-0 truncate font-semibold">{label(s.source)}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-indigo9 to-[#5A6AC2]"
                style={{ width: `${Math.round((s.visits / maxVisits) * 100)}%` }}
              />
            </span>
            <span className="w-20 shrink-0 text-right tabular-nums text-gray-500">
              {s.visits} vis. · <b className="text-ink">{s.orders}</b> cmd
            </span>
          </div>
        ))}
      </div>

      {/* dernières commandes */}
      <h2 className="mb-2 mt-6 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
        Dernières commandes
      </h2>
      <div className="flex flex-col gap-2">
        {lastOrders.length === 0 && (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-400">
            Aucune commande pour l&apos;instant.
          </p>
        )}
        {lastOrders.map((o) => (
          <Link
            key={o.id}
            href="/app/commandes"
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs"
          >
            <span className="font-bold">{o.id} · {o.product_name}</span>
            <span className="tabular-nums text-gray-500">{fcfa(o.amount_fcfa)}</span>
          </Link>
        ))}
      </div>

      <AppNav active="/app" />
    </main>
  );
}
