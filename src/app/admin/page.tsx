import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { isPaidActive, joursAvantExpiration } from "@/lib/plan";
import { isRevenue, latestSubscriptionByShop } from "@/lib/subscriptions";
import AdminShell from "@/components/AdminShell";
import Alert from "@/components/Alert";
import { inputCls, labelCls } from "@/components/ob-styles";

export const dynamic = "force-dynamic";

const ERR_FR: Record<string, string> = {
  duplicate: "Cette référence de paiement a déjà crédité cette boutique — rien n'a été fait.",
  missing_ref: "Un abonnement payé exige la référence de la transaction MoMo reçue.",
  shop_not_found: "Boutique introuvable.",
  input: "Formulaire incomplet ou invalide.",
};

const selectCls =
  "mt-2 w-full rounded-2xl border border-ink/10 bg-cream px-3.5 py-3 text-[14px] font-bold text-ink";

export default async function AdminHome(
  props: {
    searchParams: Promise<{ ok?: string; err?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const admin = await requireAdmin();
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

  const subsByShop = await latestSubscriptionByShop();

  const productStats = await db
    .selectFrom("products")
    .select(["shop_id", db.fn.countAll<number>().as("n")])
    .where("removed", "=", 0)
    .groupBy("shop_id")
    .execute();
  const productsByShop = new Map(productStats.map((p) => [p.shop_id, Number(p.n)]));

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

  // Ce qui demande une relance : la question du pilote est « ont-elles repayé ? »
  const aRelancer = shops
    .filter((s) => isPaidActive(s) && (joursAvantExpiration(s.plan_expires_at) ?? 99) <= 7)
    .sort((a, b) => (joursAvantExpiration(a.plan_expires_at) ?? 0) - (joursAvantExpiration(b.plan_expires_at) ?? 0));

  const revenue = await db
    .selectFrom("payments")
    .select(db.fn.sum<number>("amount").as("s"))
    .where("status", "=", "success")
    .executeTakeFirst();
  // Revenu d'abonnement : encaissements agrégateur + activations manuelles.
  // Les périodes OFFERTES sont exclues — sinon le chiffre serait faux.
  const subRevenue = await db
    .selectFrom("sub_payments")
    .select(db.fn.sum<number>("amount").as("s"))
    .where("status", "=", "success")
    .executeTakeFirst();
  const manualRevenue = await db
    .selectFrom("subscriptions")
    .select(db.fn.sum<number>("amount").as("s"))
    .where("origin", "=", "manual")
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
    ["Revenu abos", fcfa(Number(subRevenue?.s ?? 0) + Number(manualRevenue?.s ?? 0))],
  ];

  return (
    <AdminShell
      email={admin.email}
      actif="boutiques"
      title="Boutiques"
      subtitle="La GMV passe de l'acheteuse à la vendeuse — Tara ne l'encaisse jamais. Seul le revenu d'abonnement entre ici."
    >
      {searchParams.err && (
        <Alert className="mb-4">{ERR_FR[searchParams.err] ?? "Action impossible."}</Alert>
      )}
      {searchParams.ok && (
        <Alert tone="ok" className="mb-4">
          ✓ Action effectuée et journalisée.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {kpi.map(([label, value]) => (
          <div key={label} className="card px-3 py-3.5">
            <p className="text-[9.5px] font-extrabold uppercase tracking-micro text-inkSoft">
              {label}
            </p>
            <p className="mt-1.5 font-display text-[15px] leading-none tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Les abonnements qui arrivent à terme : c'est la question du pilote. */}
      {aRelancer.length > 0 && (
        <>
          <h2 className="label-micro mb-2.5 mt-7">À relancer — abonnements à échéance</h2>
          <div className="flex flex-col gap-2">
            {aRelancer.map((s) => {
              const j = joursAvantExpiration(s.plan_expires_at) ?? 0;
              return (
                <div key={s.id} className="card flex items-center gap-3 rounded-2xl px-4 py-3">
                  <span className="chip bg-amber-50 font-extrabold text-amber-700">
                    {j <= 0 ? "expire aujourd'hui" : `dans ${j} j`}
                  </span>
                  <b className="min-w-0 flex-1 truncate text-[13px]">{s.name}</b>
                  <a
                    href={`https://wa.me/${s.seller_phone}`}
                    className="chip bg-wagreen/15 font-extrabold text-waDeep"
                  >
                    💬 Relancer
                  </a>
                </div>
              );
            })}
          </div>
        </>
      )}

      <a
        href="/admin/pilote"
        className="card mt-7 flex items-center justify-between border-indigo9/20 px-4 py-3.5 text-[13.5px] font-extrabold text-indigo9"
      >
        📈 Écran Pilote — les 4 chiffres qui décident de la suite
        <span aria-hidden>→</span>
      </a>

      {/* ===== Lot 2 : activation manuelle de l'abonnement =====
          Remonté ici : sans agrégateur, c'est le geste le plus fréquent. */}
      <h2 id="abonnements" className="label-micro mb-2.5 mt-7">
        Activer un abonnement à la main
      </h2>
      <div className="card p-4">
        <p className="mb-4 text-[12.5px] leading-relaxed text-inkSoft">
          La vendeuse envoie les {fcfa(3000)} sur le MoMo de Tara. Saisis ici la référence
          de la transaction reçue, puis active. Une même référence ne peut créditer la
          boutique qu&apos;une seule fois.
        </p>
        <form method="post" action="/admin/abonnement" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              Boutique
              <select name="shop" required className={selectCls}>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.slug})
                  </option>
                ))}
              </select>
            </label>

            <label className={labelCls}>
              Durée
              <select name="months" className={selectCls}>
                {[1, 2, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} mois
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-2.5">
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="origin" value="manual" defaultChecked className="peer sr-only" />
              <span className="block rounded-2xl border border-ink/10 bg-cream py-2.5 text-center text-[13.5px] font-extrabold peer-checked:border-indigo9 peer-checked:bg-indigo9/[0.06] peer-checked:text-indigo9">
                Payé — {fcfa(3000)}/mois
              </span>
            </label>
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="origin" value="offered" className="peer sr-only" />
              <span className="block rounded-2xl border border-ink/10 bg-cream py-2.5 text-center text-[13.5px] font-extrabold peer-checked:border-mango peer-checked:bg-amber-50 peer-checked:text-amber-700">
                Offert — pilote
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              Référence du paiement reçu
              <input
                name="payment_ref"
                maxLength={80}
                placeholder="ex : MP240827.1432.A12345"
                className={`${inputCls} py-3 text-[14px]`}
              />
            </label>
            <label className={labelCls}>
              Note
              <input
                name="note"
                maxLength={200}
                placeholder="facultatif"
                className={`${inputCls} py-3 text-[14px]`}
              />
            </label>
          </div>

          <button className="btn-mango sm:w-auto sm:self-start sm:px-8">
            Activer l&apos;abonnement
          </button>
          <p className="text-[11.5px] leading-relaxed text-inkSoft">
            Obligatoire pour un abonnement payé : sans référence, l&apos;encaissement serait
            intraçable. Une période offerte ne compte pas dans le revenu.
          </p>
        </form>
      </div>

      <h2 className="label-micro mb-2.5 mt-7">Toutes les boutiques</h2>
      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Boutique</th>
              <th>Ville</th>
              <th>Plan</th>
              <th>Abonnement</th>
              <th className="text-right">Articles</th>
              <th className="text-right">Cmd 30 j</th>
              <th>État</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shops.length === 0 && (
              <tr>
                <td colSpan={8} className="text-inkSoft">
                  Aucune boutique.
                </td>
              </tr>
            )}
            {shops.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={`/${s.slug}`} className="font-bold text-indigo9 underline underline-offset-2">
                    {s.name}
                  </a>
                  <div className="text-[10.5px] tabular-nums text-inkSoft">{s.seller_phone}</div>
                </td>
                <td>{s.city}</td>
                <td>
                  {isPaidActive(s) ? (
                    <span className="chip bg-emerald-50 font-extrabold text-okgreen">payant</span>
                  ) : (
                    <span className="chip bg-ink/[0.06] font-extrabold text-inkSoft">gratuit</span>
                  )}
                </td>
                <td>
                  {(() => {
                    const sub = subsByShop.get(s.id);
                    if (!isPaidActive(s) || !s.plan_expires_at) {
                      return <span className="text-inkSoft/60">—</span>;
                    }
                    const offered = sub ? !isRevenue(sub.origin) : false;
                    return (
                      <>
                        <span className="tabular-nums">
                          {new Date(s.plan_expires_at).toLocaleDateString("fr-FR")}
                        </span>
                        <span
                          className={`chip ml-1.5 font-extrabold ${
                            offered ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-okgreen"
                          }`}
                        >
                          {offered ? "offert" : "payé"}
                        </span>
                        {sub?.payment_ref && (
                          <div className="text-[10.5px] text-inkSoft">réf. {sub.payment_ref}</div>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td className="text-right tabular-nums">{productsByShop.get(s.id) ?? 0}</td>
                <td className="text-right tabular-nums">{ordersByShop.get(s.id) ?? 0}</td>
                <td>
                  {s.suspended === 1 ? (
                    <span className="chip bg-red-50 font-extrabold text-red-500">suspendue</span>
                  ) : (
                    <span className="text-inkSoft/60">—</span>
                  )}
                </td>
                <td className="text-right">
                  <form method="post" action="/admin/actions">
                    <input type="hidden" name="shop" value={s.id} />
                    <input
                      type="hidden"
                      name="op"
                      value={s.suspended === 1 ? "unsuspend" : "suspend"}
                    />
                    <button
                      className={`chip border font-extrabold transition-transform active:scale-[0.97] ${
                        s.suspended === 1
                          ? "border-okgreen/40 text-okgreen"
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
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="label-micro mb-2.5">Comptes TikTok connectés</h2>
          <div className="card p-4 text-[12.5px]">
            {identities.length === 0 && <p className="text-inkSoft">Aucun compte connecté.</p>}
            {identities.map((i) => (
              <div
                key={`${i.username}-${i.seller_name}`}
                className="flex items-center gap-2 border-b border-ink/[0.06] py-2 last:border-0"
              >
                <b className="flex-1 truncate">@{i.username}</b>
                <span className="tabular-nums text-inkSoft">
                  {i.follower_count.toLocaleString("fr-FR")} ab.
                </span>
                <span
                  className={`chip font-extrabold ${
                    i.status === "active" ? "bg-emerald-50 text-okgreen" : "bg-red-50 text-red-500"
                  }`}
                >
                  {i.status === "active" ? "actif" : "révoqué"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="label-micro mb-2.5">Webhooks TikTok</h2>
          <div className="card p-4 text-[12.5px]">
            {webhookStats.length === 0 && <p className="text-inkSoft">Aucun événement reçu.</p>}
            {webhookStats.map((w) => (
              <div
                key={w.type}
                className="flex justify-between border-b border-ink/[0.06] py-2 last:border-0"
              >
                <span className="font-semibold">{w.type}</span>
                <span className="tabular-nums text-inkSoft">{Number(w.n)}</span>
              </div>
            ))}
            <p
              className={`mt-3 text-[11.5px] font-bold ${
                Number(unprocessed?.n ?? 0) > 0 ? "text-amber-700" : "text-okgreen"
              }`}
            >
              {Number(unprocessed?.n ?? 0) > 0
                ? `⚠ ${Number(unprocessed?.n)} événement(s) non traité(s)`
                : "✓ Tous les événements traités"}
            </p>
          </div>
        </div>
      </div>

      <h2 className="label-micro mb-2.5 mt-7">Modération des avis</h2>
      <div className="card p-4 text-[12.5px]">
        {flaggedReviews.length === 0 && <p className="text-inkSoft">Aucun avis déposé.</p>}
        {flaggedReviews.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 border-b border-ink/[0.06] py-2 last:border-0"
          >
            <span className="w-24 shrink-0 truncate text-inkSoft">{r.shop_name}</span>
            <span className="shrink-0 text-[#E8A413]">{"★".repeat(r.rating ?? 0)}</span>
            <span className="min-w-0 flex-1 truncate">{r.comment ?? "—"}</span>
            {r.status === "hidden" && (
              <span className="chip bg-amber-50 font-extrabold text-amber-700">masqué</span>
            )}
            <form method="post" action="/admin/actions">
              <input type="hidden" name="review" value={r.id} />
              <input
                type="hidden"
                name="op"
                value={r.status === "hidden" ? "publish_review" : "hide_review"}
              />
              <button className="chip border border-ink/10 font-extrabold text-inkSoft transition-transform active:scale-[0.97]">
                {r.status === "hidden" ? "Republier" : "Masquer"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <h2 className="label-micro mb-2.5 mt-7">Journal d&apos;audit</h2>
      <div className="card overflow-x-auto p-4 text-[12px]">
        {logs.length === 0 && <p className="text-inkSoft">Aucune action enregistrée.</p>}
        {logs.map((l) => (
          <div key={l.id} className="flex gap-3 border-b border-ink/[0.06] py-2 last:border-0">
            <span className="w-36 shrink-0 tabular-nums text-inkSoft">{l.at}</span>
            <span className="w-40 shrink-0 font-bold">{l.actor}</span>
            <span className="font-semibold text-indigo9">{l.action}</span>
            <span className="truncate text-inkSoft">{l.target}</span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
