import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";

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
    <AppShell
      slug={shop.slug}
      active="/app"
      title="Avis clientes"
      subtitle={
        published.length > 0
          ? `★ ${avg.toFixed(1)} sur ${published.length} avis publié${published.length > 1 ? "s" : ""}`
          : "Chaque commande livrée reçoit un lien d'avis."
      }
    >
      {searchParams.ok && (
        <Alert tone="ok" className="mb-4">
          ✓ Enregistré.
        </Alert>
      )}

      <div className="flex flex-col gap-2.5">
        {reviews.length === 0 && (
          <p className="card p-4 text-[12.5px] text-inkSoft">
            Aucun avis pour l&apos;instant.
          </p>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="card p-4 text-[12.5px]">
            <div className="flex items-center justify-between gap-3">
              <b className="min-w-0 truncate">{r.product_name}</b>
              <span className="shrink-0 text-[11px] tabular-nums text-inkSoft">{r.order_id}</span>
            </div>
            {r.status === "pending" ? (
              <p className="mt-1.5 text-inkSoft">⏳ Lien envoyé — en attente de la cliente.</p>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] tracking-wide text-[#E8A413]">
                  {"★".repeat(r.rating ?? 0)}
                </p>
                {r.comment && <p className="mt-1 leading-relaxed">« {r.comment} »</p>}
                {r.reply && (
                  <p className="mt-2 rounded-xl bg-sand px-3 py-2 text-[11.5px] text-inkSoft">
                    ↳ Ta réponse : {r.reply}
                  </p>
                )}
                <div className="mt-3 flex items-end gap-2">
                  {!r.reply && (
                    <form method="post" action="/app/avis/action" className="flex flex-1 gap-1.5">
                      <input type="hidden" name="review" value={r.id} />
                      <input type="hidden" name="op" value="reply" />
                      <input
                        name="reply"
                        placeholder="Répondre…"
                        maxLength={300}
                        required
                        className="flex-1 rounded-xl border border-ink/10 bg-cream px-3 py-1.5 text-[12px] font-semibold"
                      />
                      <button className="chip bg-indigo9 font-extrabold text-white transition-transform active:scale-[0.97]">
                        Envoyer
                      </button>
                    </form>
                  )}
                  <form method="post" action="/app/avis/action">
                    <input type="hidden" name="review" value={r.id} />
                    <input type="hidden" name="op" value={r.status === "hidden" ? "publish" : "hide"} />
                    <button className="chip border border-ink/10 font-bold text-inkSoft transition-transform active:scale-[0.97]">
                      {r.status === "hidden" ? "Republier" : "Masquer"}
                    </button>
                  </form>
                </div>
                {r.status === "hidden" && (
                  <p className="mt-2 text-[11px] font-bold text-amber-700">
                    Masqué — invisible sur ta boutique (signalé à la modération).
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
