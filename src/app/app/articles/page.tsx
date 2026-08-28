import Link from "next/link";
import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { canAddProduct, FREE_PRODUCT_LIMIT, isPaidActive, countActiveProducts } from "@/lib/plan";
import { photosByProduct, photoVariant } from "@/lib/photos";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";
import { inputCls, labelCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default async function Articles(props: {
  searchParams: Promise<{ err?: string; photo?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { shop } = await requireShop();
  const products = await db
    .selectFrom("products")
    .selectAll()
    .where("shop_id", "=", shop.id)
    .where("removed", "=", 0)
    .orderBy("position", "asc")
    .execute();
  // la vendeuse gérait son catalogue à l'aveugle : la vignette est celle
  // que voit sa cliente, en variante 320 px (forfait compté)
  const photos = await photosByProduct(products.map((p) => p.id));
  const addable = await canAddProduct(shop);
  const paid = isPaidActive(shop);
  const n = await countActiveProducts(shop.id);

  return (
    <AppShell
      slug={shop.slug}
      active="/app/articles"
      title="Articles"
      subtitle={`${n}${paid ? "" : ` sur ${FREE_PRODUCT_LIMIT}`} en ligne`}
    >
      {searchParams.err && (
        <Alert className="mb-4">Vérifie le nom et le prix de l&apos;article.</Alert>
      )}
      {searchParams.photo === "echec" && (
        <Alert tone="attention" className="mb-4">
          ⚠️ L&apos;article est bien créé, mais sa photo n&apos;a pas pu être enregistrée.
          Réessaie avec une autre image — sans photo, un article se vend beaucoup moins.
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        {products.length === 0 && (
          <p className="card p-4 text-[12.5px] text-inkSoft">
            Aucun article pour l&apos;instant.
          </p>
        )}
        {products.map((p) => {
          const photo = photos.get(p.id);
          return (
            <div key={p.id} className="card flex items-start gap-3 rounded-2xl p-2.5">
              {photo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoVariant(photo, 320)}
                  alt=""
                  width={112}
                  height={112}
                  className="img-frame h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sand text-lg">
                  🛍️
                </span>
              )}
              <div className="min-w-0 flex-1">
                <b className="block text-[13px] leading-snug">{p.name}</b>
                <p className="mt-0.5 font-display text-[13.5px] tabular-nums text-indigo9">
                  {fcfa(p.price_fcfa)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <form method="post" action="/app/articles/update">
                    <input type="hidden" name="product" value={p.id} />
                    <input
                      type="hidden"
                      name="op"
                      value={p.stock_state === "out" ? "restock" : "out"}
                    />
                    <button
                      className={`chip font-extrabold transition-transform active:scale-[0.97] ${
                        p.stock_state === "out"
                          ? "bg-emerald-50 text-okgreen"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {p.stock_state === "out" ? "Remettre en stock" : "Rupture"}
                    </button>
                  </form>
                  <form method="post" action="/app/articles/update">
                    <input type="hidden" name="product" value={p.id} />
                    <input type="hidden" name="op" value="remove" />
                    <button className="chip bg-red-50 font-extrabold text-red-500 transition-transform active:scale-[0.97]">
                      Retirer
                    </button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {addable ? (
        <details className="card mt-5 p-4">
          <summary className="cursor-pointer text-[13.5px] font-extrabold text-indigo9">
            ＋ Ajouter un article
          </summary>
          <form
            method="post"
            action="/app/articles/add"
            encType="multipart/form-data"
            className="mt-4 flex flex-col gap-4"
          >
            <label className={labelCls}>
              Photo (facultatif)
              <input
                type="file"
                name="photo"
                accept="image/*"
                className="mt-2 block w-full text-[12px] text-inkSoft"
              />
            </label>
            <label className={labelCls}>
              Nom
              <input name="name" required minLength={3} maxLength={80} className={inputCls} />
            </label>
            <label className={labelCls}>
              Prix en FCFA
              <input
                name="price"
                inputMode="numeric"
                required
                className={`${inputCls} tabular-nums`}
              />
            </label>
            <label className={labelCls}>
              Lien vidéo TikTok (facultatif)
              <input name="video_url" inputMode="url" className={inputCls} />
            </label>
            <button className="btn-mango mt-1">Ajouter</button>
          </form>
        </details>
      ) : (
        <Link
          href="/app/upgrade"
          className="card mt-5 block border-dashed border-indigo9/35 bg-indigo9/[0.05] p-4 text-center text-[13.5px] font-extrabold text-indigo9"
        >
          Limite de {FREE_PRODUCT_LIMIT} articles atteinte 🔒
          <br />
          <span className="text-[12px]">Passe à l&apos;illimité — 3 000 F/mois →</span>
        </Link>
      )}
    </AppShell>
  );
}
