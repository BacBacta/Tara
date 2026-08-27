import Link from "next/link";
import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { canAddProduct, FREE_PRODUCT_LIMIT, isPaidActive, countActiveProducts } from "@/lib/plan";
import AppNav from "@/components/AppNav";
import { inputCls, labelCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default async function Articles({ searchParams }: { searchParams: { err?: string } }) {
  const { shop } = await requireShop();
  const products = await db
    .selectFrom("products")
    .selectAll()
    .where("shop_id", "=", shop.id)
    .where("removed", "=", 0)
    .orderBy("position", "asc")
    .execute();
  const addable = await canAddProduct(shop);
  const paid = isPaidActive(shop);
  const n = await countActiveProducts(shop.id);

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">
        Articles{" "}
        <span className="text-xs font-bold text-gray-400">
          — {n}{paid ? "" : `/${FREE_PRODUCT_LIMIT}`}
        </span>
      </h1>

      {searchParams.err && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Vérifie le nom et le prix de l&apos;article.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3">
            <div className="flex-1 text-xs">
              <b>{p.name}</b>
              <p className="tabular-nums text-indigo9 font-extrabold">{fcfa(p.price_fcfa)}</p>
            </div>
            <form method="post" action="/app/articles/update">
              <input type="hidden" name="product" value={p.id} />
              <input type="hidden" name="op" value={p.stock_state === "out" ? "restock" : "out"} />
              <button
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
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
              <button className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-extrabold text-red-500">
                Retirer
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* ajout */}
      {addable ? (
        <details className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-extrabold text-indigo9">
            ＋ Ajouter un article
          </summary>
          <form
            method="post"
            action="/app/articles/add"
            encType="multipart/form-data"
            className="mt-3 flex flex-col gap-3"
          >
            <label className={labelCls}>
              Photo (optionnel)
              <input type="file" name="photo" accept="image/*" className="mt-1 block w-full text-xs" />
            </label>
            <label className={labelCls}>
              Nom
              <input name="name" required minLength={3} maxLength={80} className={inputCls} />
            </label>
            <label className={labelCls}>
              Prix (FCFA)
              <input name="price" inputMode="numeric" required className={inputCls} />
            </label>
            <label className={labelCls}>
              Lien vidéo TikTok (optionnel)
              <input name="video_url" inputMode="url" className={inputCls} />
            </label>
            <button className="rounded-2xl bg-mango px-5 py-3.5 text-sm font-extrabold text-[#3A2A00]">
              Ajouter
            </button>
          </form>
        </details>
      ) : (
        <Link
          href="/app/upgrade"
          className="mt-5 block rounded-2xl border-2 border-dashed border-indigo9/40 bg-indigo-50 p-4 text-center text-sm font-extrabold text-indigo9"
        >
          Limite de {FREE_PRODUCT_LIMIT} articles atteinte 🔒
          <br />
          <span className="text-xs font-bold">Passe à l&apos;illimité — 3 000 F/mois →</span>
        </Link>
      )}

      <AppNav active="/app/articles" />
    </main>
  );
}
