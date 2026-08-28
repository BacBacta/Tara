import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import AppNav from "@/components/AppNav";

export const dynamic = "force-dynamic";

export default async function AvisVendeuse(props: { searchParams: Promise<{ ok?: string }> }) {
  const searchParams = await props.searchParams;
  const { shop } = await requireShop();
  const reviews = await db
    .selectFrom("reviews")
    .innerJoin("products", "products.id", "reviews.product_id")
    .select([
      "reviews.id", "reviews.rating", "reviews.comment", "reviews.status",
      "reviews.reply", "reviews.submitted_at", "reviews.order_id",
      "products.name as product_name",
    ])
    .where("reviews.shop_id", "=", shop.id)
    .orderBy("reviews.created_at", "desc")
    .limit(50)
    .execute();

  const published = reviews.filter((r) => r.status === "published");
  const avg = published.length
    ? published.reduce((a, r) => a + (r.rating ?? 0), 0) / published.length
    : 0;

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">
        Avis clients{" "}
        {published.length > 0 && (
          <span className="text-sm text-[#E8A413]">★ {avg.toFixed(1)} ({published.length})</span>
        )}
      </h1>
      {searchParams.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          ✓ Enregistré.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        {reviews.length === 0 && (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-400">
            Aucun avis pour l&apos;instant. Chaque commande livrée reçoit un lien d&apos;avis.
          </p>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <b>{r.product_name}</b>
              <span className="text-gray-400">{r.order_id}</span>
            </div>
            {r.status === "pending" ? (
              <p className="mt-1 text-gray-400">⏳ Lien envoyé — en attente de la cliente.</p>
            ) : (
              <>
                <p className="mt-1 text-[#E8A413]">{"★".repeat(r.rating ?? 0)}</p>
                {r.comment && <p className="text-gray-600">« {r.comment} »</p>}
                {r.reply && (
                  <p className="mt-1 rounded-lg bg-sand px-2 py-1 text-[11px] text-gray-600">
                    ↳ Ta réponse : {r.reply}
                  </p>
                )}
                <div className="mt-2 flex items-end gap-2">
                  {!r.reply && (
                    <form method="post" action="/app/avis/action" className="flex flex-1 gap-1.5">
                      <input type="hidden" name="review" value={r.id} />
                      <input type="hidden" name="op" value="reply" />
                      <input
                        name="reply"
                        placeholder="Répondre…"
                        maxLength={300}
                        required
                        className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px]"
                      />
                      <button className="rounded-full bg-indigo9 px-2.5 py-1 text-[10px] font-extrabold text-white">
                        Envoyer
                      </button>
                    </form>
                  )}
                  <form method="post" action="/app/avis/action">
                    <input type="hidden" name="review" value={r.id} />
                    <input type="hidden" name="op" value={r.status === "hidden" ? "publish" : "hide"} />
                    <button className="rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-bold text-gray-500">
                      {r.status === "hidden" ? "Republier" : "Masquer"}
                    </button>
                  </form>
                </div>
                {r.status === "hidden" && (
                  <p className="mt-1 text-[10px] font-bold text-amber-700">
                    Masqué — invisible sur ta boutique (signalé à la modération).
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <AppNav active="/app" />
    </main>
  );
}
