import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import { openDueDrops } from "@/lib/drops";
import AppNav from "@/components/AppNav";
import { inputCls, labelCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default async function Drops(props: { searchParams: Promise<{ ok?: string }> }) {
  const searchParams = await props.searchParams;
  const { shop } = await requireShop();
  await openDueDrops(shop.id);

  const drops = await db
    .selectFrom("drops").selectAll()
    .where("shop_id", "=", shop.id)
    .orderBy("opens_at", "desc").execute();
  const products = await db
    .selectFrom("products").select(["id", "name", "stock_qty"])
    .where("shop_id", "=", shop.id).where("removed", "=", 0)
    .orderBy("position", "asc").execute();
  const counts = await db
    .selectFrom("drop_alerts")
    .select(["drop_id", db.fn.countAll<number>().as("n")])
    .groupBy("drop_id").execute();
  const alertMap = new Map(counts.map((c) => [c.drop_id, Number(c.n)]));

  const defaultDate = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 16);

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">Mes drops</h1>
      <p className="mt-1 text-xs text-gray-500">
        Une vente programmée : compte à rebours sur ta boutique, alerte WhatsApp à
        l&apos;ouverture, premiers arrivés premiers servis.
      </p>
      {searchParams.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          ✓ Drop programmé.
        </p>
      )}

      <details className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-extrabold text-indigo9">
          ＋ Programmer un drop
        </summary>
        <form method="post" action="/app/drops/create" className="mt-3 flex flex-col gap-3">
          <label className={labelCls}>
            Titre
            <input name="title" required minLength={3} maxLength={80}
              defaultValue="Colis Dubaï ✈️" className={inputCls} />
          </label>
          <label className={labelCls}>
            Ouverture
            <input type="datetime-local" name="opens_at" required
              defaultValue={defaultDate} className={inputCls} />
          </label>
          <div>
            <p className={labelCls}>Articles du drop</p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="products" value={p.id} className="h-4 w-4 accent-indigo9" />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <label className={labelCls}>
            Pièces disponibles (stock du drop)
            <input name="stock" inputMode="numeric" defaultValue="32" className={inputCls} />
          </label>
          <button className="rounded-2xl bg-mango px-5 py-3.5 text-sm font-extrabold text-[#3A2A00]">
            Programmer
          </button>
        </form>
      </details>

      <div className="mt-4 flex flex-col gap-2">
        {drops.map((d) => (
          <a key={d.id} href={`/${shop.slug}/drop/${d.id}`}
            className="rounded-2xl border border-gray-200 bg-white p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <b>📦 {d.title}</b>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                d.status === "open" ? "bg-emerald-50 text-okgreen" : "bg-indigo-50 text-indigo9"
              }`}>
                {d.status === "open" ? "ouvert" : "programmé"}
              </span>
            </div>
            <p className="mt-1 tabular-nums text-gray-500">
              {new Date(d.opens_at).toLocaleString("fr-FR")} ·{" "}
              {alertMap.get(d.id) ?? 0} personne(s) alertée(s)
            </p>
          </a>
        ))}
        {drops.length === 0 && (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-400">
            Aucun drop programmé.
          </p>
        )}
      </div>
      <AppNav active="/app" />
    </main>
  );
}
