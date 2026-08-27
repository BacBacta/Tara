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
        <h1 className="text-lg font-extrabold">Administration Bio-Shop</h1>
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
