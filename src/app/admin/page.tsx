import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { isPaidActive } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: { ok?: string } }) {
  const admin = requireAdmin();
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 19).replace("T", " ");

  const shops = await db
    .selectFrom("shops")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .select([
      "shops.id", "shops.slug", "shops.name", "shops.city", "shops.plan",
      "shops.plan_expires_at", "shops.suspended", "shops.created_at",
      "sellers.phone as seller_phone",
    ])
    .orderBy("shops.created_at", "desc")
    .execute();

  const orderStats = await db
    .selectFrom("orders")
    .select(["shop_id", db.fn.countAll<number>().as("n")])
    .where("created_at", ">", since30)
    .groupBy("shop_id")
    .execute();
  const ordersByShop = new Map(orderStats.map((o) => [o.shop_id, Number(o.n)]));

  const totalOrders = [...ordersByShop.values()].reduce((a, b) => a + b, 0);
  const paidShops = shops.filter((s) => isPaidActive(s)).length;
  const activeShops = shops.filter((s) => (ordersByShop.get(s.id) ?? 0) > 0).length;
  const conversion = shops.length ? Math.round((paidShops / shops.length) * 100) : 0;

  const revenue = await db
    .selectFrom("payments")
    .select(db.fn.sum<number>("amount").as("s"))
    .where("status", "=", "success")
    .executeTakeFirst();
  const subRevenue = await db
    .selectFrom("sub_payments")
    .select(db.fn.sum<number>("amount").as("s"))
    .where("status", "=", "success")
    .executeTakeFirst();

  // ===== V2 =====
  const identities = await db
    .selectFrom("external_identities")
    .innerJoin("sellers", "sellers.id", "external_identities.seller_id")
    .select([
      "external_identities.username", "external_identities.status",
      "external_identities.follower_count", "external_identities.synced_at",
      "sellers.name as seller_name",
    ])
    .orderBy("external_identities.connected_at", "desc")
    .limit(10)
    .execute();

  const webhookStats = await db
    .selectFrom("webhook_events")
    .select(["type", db.fn.countAll<number>().as("n")])
    .groupBy("type")
    .execute();
  const unprocessed = await db
    .selectFrom("webhook_events")
    .select(db.fn.countAll<number>().as("n"))
    .where("processed_at", "is", null)
    .executeTakeFirst();

  const flaggedReviews = await db
    .selectFrom("reviews")
    .innerJoin("shops", "shops.id", "reviews.shop_id")
    .select([
      "reviews.id", "reviews.rating", "reviews.comment", "reviews.status",
      "shops.name as shop_name",
    ])
    .where("reviews.status", "in", ["published", "hidden"])
    .orderBy("reviews.submitted_at", "desc")
    .limit(8)
    .execute();

  const logs = await db
    .selectFrom("audit_log")
    .selectAll()
    .orderBy("at", "desc")
    .limit(8)
    .execute();

  const kpi: Array<[string, string]> = [
    ["Boutiques", String(shops.length)],
    ["Payantes", `${paidShops} (${conversion} %)`],
    ["Actives 30 j", String(activeShops)],
    ["Commandes 30 j", String(totalOrders)],
    ["GMV encaissée", fcfa(Number(revenue?.s ?? 0))],
    ["Revenu abos", fcfa(Number(subRevenue?.s ?? 0))],
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold">Administration Tara</h1>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">{admin.email}</span>
          <a href="/admin/export" className="font-extrabold text-indigo9 underline">
            ⬇ Export CSV
          </a>
          <form method="post" action="/admin/logout">
            <button className="font-bold text-gray-500">Déconnexion</button>
          </form>
        </div>
      </header>

      {searchParams.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          ✓ Action effectuée et journalisée.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {kpi.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              {label}
            </p>
            <p className="mt-1 text-sm font-extrabold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
        Boutiques
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-sand text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2">Boutique</th>
              <th className="px-3 py-2">Ville</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2 text-right">Cmd 30 j</th>
              <th className="px-3 py-2">État</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <a href={`/${s.slug}`} className="font-bold text-indigo9 underline">
                    {s.name}
                  </a>
                  <div className="text-[10px] text-gray-400">{s.seller_phone}</div>
                </td>
                <td className="px-3 py-2">{s.city}</td>
                <td className="px-3 py-2">
                  {isPaidActive(s) ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-okgreen">
                      payant
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-extrabold text-gray-500">
                      gratuit
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {ordersByShop.get(s.id) ?? 0}
                </td>
                <td className="px-3 py-2">
                  {s.suspended === 1 ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-red-500">
                      suspendue
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <form method="post" action="/admin/actions">
                    <input type="hidden" name="shop" value={s.id} />
                    <input
                      type="hidden"
                      name="op"
                      value={s.suspended === 1 ? "unsuspend" : "suspend"}
                    />
                    <button
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${
                        s.suspended === 1
                          ? "border-emerald-300 text-okgreen"
                          : "border-red-200 text-red-500"
                      }`}
                    >
                      {s.suspended === 1 ? "Réactiver" : "Suspendre"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== V2 ===== */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
            Comptes TikTok connectés
          </h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-3 text-xs">
            {identities.length === 0 && <p className="text-gray-400">Aucun compte connecté.</p>}
            {identities.map((i) => (
              <div key={`${i.username}-${i.seller_name}`} className="flex items-center gap-2 border-b border-gray-100 py-1.5 last:border-0">
                <b className="flex-1 truncate">@{i.username}</b>
                <span className="tabular-nums text-gray-500">
                  {i.follower_count.toLocaleString("fr-FR")} ab.
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  i.status === "active" ? "bg-emerald-50 text-okgreen" : "bg-red-50 text-red-500"
                }`}>
                  {i.status === "active" ? "actif" : "révoqué"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
            Webhooks TikTok
          </h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-3 text-xs">
            {webhookStats.length === 0 && <p className="text-gray-400">Aucun événement reçu.</p>}
            {webhookStats.map((w) => (
              <div key={w.type} className="flex justify-between border-b border-gray-100 py-1.5 last:border-0">
                <span className="font-semibold">{w.type}</span>
                <span className="tabular-nums text-gray-500">{Number(w.n)}</span>
              </div>
            ))}
            <p className={`mt-2 text-[11px] font-bold ${
              Number(unprocessed?.n ?? 0) > 0 ? "text-amber-700" : "text-okgreen"
            }`}>
              {Number(unprocessed?.n ?? 0) > 0
                ? `⚠ ${Number(unprocessed?.n)} événement(s) non traité(s)`
                : "✓ Tous les événements traités"}
            </p>
          </div>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
        Modération des avis
      </h2>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 text-xs">
        {flaggedReviews.length === 0 && <p className="text-gray-400">Aucun avis déposé.</p>}
        {flaggedReviews.map((r) => (
          <div key={r.id} className="flex items-center gap-2 border-b border-gray-100 py-1.5 last:border-0">
            <span className="w-24 shrink-0 truncate text-gray-500">{r.shop_name}</span>
            <span className="text-[#E8A413]">{"★".repeat(r.rating ?? 0)}</span>
            <span className="flex-1 truncate text-gray-600">{r.comment ?? "—"}</span>
            {r.status === "hidden" && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
                masqué
              </span>
            )}
            <form method="post" action="/admin/actions">
              <input type="hidden" name="review" value={r.id} />
              <input type="hidden" name="op" value={r.status === "hidden" ? "publish_review" : "hide_review"} />
              <button className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] font-extrabold text-gray-500">
                {r.status === "hidden" ? "Republier" : "Masquer"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
        Journal d&apos;audit
      </h2>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 text-xs">
        {logs.length === 0 && <p className="text-gray-400">Aucune action enregistrée.</p>}
        {logs.map((l) => (
          <div key={l.id} className="flex gap-3 border-b border-gray-100 py-1.5 last:border-0">
            <span className="w-36 shrink-0 tabular-nums text-gray-400">{l.at}</span>
            <span className="w-40 shrink-0 font-bold">{l.actor}</span>
            <span className="font-semibold text-indigo9">{l.action}</span>
            <span className="truncate text-gray-500">{l.target}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
