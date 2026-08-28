import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import { openDueDrops } from "@/lib/drops";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";
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
    <AppShell
      slug={shop.slug}
      active="/app"
      title="Mes drops"
      subtitle="Une vente programmée : compte à rebours sur ta boutique, alerte WhatsApp à l'ouverture, premières arrivées premières servies."
    >
      {searchParams.ok && (
        <Alert tone="ok" className="mb-4">
          ✓ Drop programmé.
        </Alert>
      )}

      <details className="card p-4">
        <summary className="cursor-pointer text-[13.5px] font-extrabold text-indigo9">
          ＋ Programmer un drop
        </summary>
        <form method="post" action="/app/drops/create" className="mt-4 flex flex-col gap-4">
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
            <div className="mt-2 flex flex-col gap-2">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 text-[13px]">
                  <input type="checkbox" name="products" value={p.id} className="h-4 w-4 accent-indigo9" />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <label className={labelCls}>
            Pièces disponibles (stock du drop)
            <input name="stock" inputMode="numeric" defaultValue="32"
              className={`${inputCls} tabular-nums`} />
          </label>
          <button className="btn-mango mt-1">Programmer</button>
        </form>
      </details>

      <div className="mt-4 flex flex-col gap-2">
        {drops.map((d) => (
          <a key={d.id} href={`/${shop.slug}/drop/${d.id}`} className="card p-4 text-[12.5px]">
            <div className="flex items-center justify-between gap-3">
              <b className="min-w-0 truncate">📦 {d.title}</b>
              <span
                className={`chip shrink-0 font-extrabold ${
                  d.status === "open" ? "bg-emerald-50 text-okgreen" : "bg-indigo9/10 text-indigo9"
                }`}
              >
                {d.status === "open" ? "ouvert" : "programmé"}
              </span>
            </div>
            <p className="mt-1.5 tabular-nums text-inkSoft">
              {new Date(d.opens_at).toLocaleString("fr-FR")} ·{" "}
              {alertMap.get(d.id) ?? 0} personne(s) alertée(s)
            </p>
          </a>
        ))}
        {drops.length === 0 && (
          <p className="card p-4 text-[12.5px] text-inkSoft">Aucun drop programmé.</p>
        )}
      </div>
    </AppShell>
  );
}
