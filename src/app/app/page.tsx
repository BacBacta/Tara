import Link from "next/link";
import { requireShop } from "@/lib/guard";
import { kpis, statsBySource, videoFunnel, todo } from "@/lib/stats";
import { isPaidActive, countActiveProducts, FREE_PRODUCT_LIMIT } from "@/lib/plan";
import { fcfa } from "@/lib/format";
import { db } from "@/lib/db";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";

export const dynamic = "force-dynamic";

function label(source: string): string {
  if (source.startsWith("v:")) return `▶ vidéo …${source.slice(-6)}`;
  if (source.startsWith("src:")) return source.slice(4);
  return "direct";
}

const RACCOURCIS: Array<[string, string, string]> = [
  ["/app/tiktok", "🎵", "TikTok"],
  ["/app/videos", "▶", "Vidéos"],
  ["/app/drops", "📦", "Drops"],
  ["/app/avis", "★", "Avis"],
  ["/app/partage", "🔗", "Partage"],
];

export default async function AppHome(props: { searchParams: Promise<{ ok?: string }> }) {
  const searchParams = await props.searchParams;
  const { shop } = await requireShop();
  const [day, week, month] = await Promise.all([kpis(shop.id, 1), kpis(shop.id, 7), kpis(shop.id, 30)]);
  const aFaire = await todo(shop.id);
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
  const maxVisits = Math.max(1, ...sources.map((s) => s.visits));

  const cells: Array<[string, typeof day]> = [["Aujourd'hui", day], ["7 jours", week], ["30 jours", month]];

  return (
    <AppShell
      slug={shop.slug}
      active="/app"
      title={shop.name}
      subtitle={`${shop.city} · ${nProducts} article${nProducts > 1 ? "s" : ""} en ligne`}
    >
      {searchParams.ok === "sub" && (
        <Alert tone="ok" className="mb-4">
          ✓ Abonnement activé — articles illimités jusqu&apos;au{" "}
          {shop.plan_expires_at ? new Date(shop.plan_expires_at).toLocaleDateString("fr-FR") : ""}.
        </Alert>
      )}

      {!paid && (
        <Link href="/app/upgrade" className="mb-4 block">
          <Alert tone="info">
            Palier gratuit : {nProducts}/{FREE_PRODUCT_LIMIT} articles utilisés — passe à
            l&apos;illimité pour 3 000 F/mois →
          </Alert>
        </Link>
      )}

      {/* Ce qui attend un geste d'elle, tout en haut : c'est la raison
          première d'ouvrir cet écran. */}
      {(aFaire.aVerifier > 0 || aFaire.aLivrer > 0) && (
        <>
          <h2 className="label-micro mb-2.5">À faire</h2>
          <div className="mb-6 flex flex-col gap-2">
            {aFaire.aVerifier > 0 && (
              <Link
                href="/app/commandes"
                className="card flex items-center gap-3 rounded-2xl px-4 py-3.5"
              >
                <span className="chip bg-amber-50 font-extrabold text-amber-700">💰</span>
                <span className="flex-1 text-[13.5px] font-bold">
                  {aFaire.aVerifier} paiement{aFaire.aVerifier > 1 ? "s" : ""} annoncé
                  {aFaire.aVerifier > 1 ? "s" : ""} — à vérifier sur ton téléphone
                </span>
                <span aria-hidden className="text-indigo9">→</span>
              </Link>
            )}
            {aFaire.aLivrer > 0 && (
              <Link
                href="/app/commandes"
                className="card flex items-center gap-3 rounded-2xl px-4 py-3.5"
              >
                <span className="chip bg-indigo9/10 font-extrabold text-indigo9">🛵</span>
                <span className="flex-1 text-[13.5px] font-bold">
                  {aFaire.aLivrer} commande{aFaire.aLivrer > 1 ? "s" : ""} payée
                  {aFaire.aLivrer > 1 ? "s" : ""} — à livrer
                </span>
                <span aria-hidden className="text-indigo9">→</span>
              </Link>
            )}
          </div>
        </>
      )}

      <h2 className="label-micro mb-2.5">Tes ventes</h2>
      <div className="grid grid-cols-3 gap-2">
        {cells.map(([labelTxt, k]) => (
          <div key={labelTxt} className="card px-3 py-3.5">
            <p className="text-[9.5px] font-extrabold uppercase tracking-micro text-inkSoft">
              {labelTxt}
            </p>
            <p className="mt-1.5 font-display text-[15px] leading-none tabular-nums text-okgreen">
              {fcfa(k.revenue)}
            </p>
            <p className="mt-1.5 text-[11px] font-bold tabular-nums">
              {k.orders} <span className="font-medium text-inkSoft">cmd</span>
            </p>
            <p className="text-[11px] tabular-nums text-inkSoft">{k.visits} visites</p>
          </div>
        ))}
      </div>

      {/* la meilleure vidéo : d'où viennent réellement les ventes */}
      {best && (
        <>
          <h2 className="label-micro mb-2.5 mt-7">Ta meilleure vidéo (30 j)</h2>
          <div className="card p-4">
            <p className="text-[13.5px] font-bold">▶ {best.title}</p>
            <div className="mt-3 flex items-stretch gap-1.5">
              {[
                ["Vues TikTok", best.views],
                ["Visites boutique", best.visits],
                ["Commandes", best.orders],
              ].map(([labelTxt, value], i) => (
                <div key={labelTxt as string} className="contents">
                  {i > 0 && <span className="self-center text-ink/25">›</span>}
                  <div className="flex-1 rounded-2xl bg-sand p-2.5 text-center">
                    <p className="font-display text-[15px] leading-none tabular-nums">
                      {Number(value).toLocaleString("fr-FR")}
                    </p>
                    <p className="mt-1.5 text-[9px] font-extrabold uppercase tracking-micro text-inkSoft">
                      {labelTxt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[11.5px] font-extrabold text-okgreen">
              Conversion vues → commandes : {best.conversion.toFixed(2)} %
              {avgConv > 0 && (
                <span className="font-bold text-inkSoft"> (moyenne {avgConv.toFixed(2)} %)</span>
              )}
            </p>
          </div>
          <Link
            href="/app/videos"
            className="mt-2.5 block text-center text-[12px] font-extrabold text-indigo9"
          >
            Voir toutes mes vidéos et taguer mes articles →
          </Link>
        </>
      )}

      <h2 className="label-micro mb-2.5 mt-7">D&apos;où viennent tes clientes (30 j)</h2>
      <div className="card p-4">
        {sources.length === 0 && (
          <p className="text-[12.5px] text-inkSoft">
            Partage ton lien pour voir d&apos;où viennent tes clientes.
          </p>
        )}
        {sources.slice(0, 5).map((s) => (
          <div key={s.source} className="flex items-center gap-2 py-1.5 text-[11.5px]">
            <span className="w-24 shrink-0 truncate font-bold">{label(s.source)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-indigo9 to-[#5A6AC2]"
                style={{ width: `${Math.round((s.visits / maxVisits) * 100)}%` }}
              />
            </span>
            <span className="w-[5.6rem] shrink-0 whitespace-nowrap text-right tabular-nums text-inkSoft">
              {s.visits} vis. · <b className="text-ink">{s.orders}</b> cmd
            </span>
          </div>
        ))}
      </div>

      <h2 className="label-micro mb-2.5 mt-7">Dernières commandes</h2>
      <div className="flex flex-col gap-2">
        {lastOrders.length === 0 && (
          <p className="card p-4 text-[12.5px] text-inkSoft">
            Aucune commande pour l&apos;instant.
          </p>
        )}
        {lastOrders.map((o) => (
          <Link
            key={o.id}
            href="/app/commandes"
            className="card flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[12.5px]"
          >
            <span className="min-w-0 truncate font-bold">
              {o.id} · {o.product_name}
            </span>
            <span className="shrink-0 font-display tabular-nums">{fcfa(o.amount_fcfa)}</span>
          </Link>
        ))}
      </div>

      <h2 className="label-micro mb-2.5 mt-7">Faire grandir ta boutique</h2>
      <div className="grid grid-cols-3 gap-2">
        {RACCOURCIS.map(([href, icone, texte]) => (
          <Link
            key={href}
            href={href}
            className="card flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-extrabold"
          >
            <span aria-hidden className="text-base">{icone}</span>
            {texte}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
