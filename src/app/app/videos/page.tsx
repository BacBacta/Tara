import Link from "next/link";
import { requireShop } from "@/lib/guard";
import { getIdentity } from "@/lib/identities";
import { db } from "@/lib/db";
import AppNav from "@/components/AppNav";

export const dynamic = "force-dynamic";

export default async function Videos({ searchParams }: { searchParams: { ok?: string } }) {
  const { sellerId, shop } = await requireShop();
  const identity = await getIdentity(sellerId);
  if (identity?.status !== "active") {
    return (
      <main className="mx-auto max-w-md px-4 pb-24 pt-6">
        <h1 className="text-lg font-extrabold">Mes vidéos</h1>
        <Link
          href="/app/tiktok"
          className="mt-4 block rounded-2xl border-2 border-dashed border-indigo9/40 bg-indigo-50 p-4 text-center text-sm font-extrabold text-indigo9"
        >
          Connecte ton compte TikTok pour synchroniser tes vidéos →
        </Link>
        <AppNav active="/app" />
      </main>
    );
  }

  const videos = await db
    .selectFrom("videos")
    .selectAll()
    .where("shop_id", "=", shop.id)
    .orderBy("published_at", "desc")
    .execute();
  const products = await db
    .selectFrom("products")
    .select(["id", "name"])
    .where("shop_id", "=", shop.id)
    .where("removed", "=", 0)
    .orderBy("position", "asc")
    .execute();
  const tags = await db.selectFrom("video_products").selectAll().execute();
  const tagged = new Map<string, Set<string>>();
  for (const t of tags) {
    if (!tagged.has(t.video_id)) tagged.set(t.video_id, new Set());
    tagged.get(t.video_id)!.add(t.product_id);
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">
        Mes vidéos <span className="text-xs font-bold text-gray-400">— {videos.length}</span>
      </h1>
      <p className="mt-1 text-xs text-gray-500">
        Tague les articles qui apparaissent dans chaque vidéo : ils s&apos;affichent dans
        « Vu dans mes vidéos » sur ta boutique.
      </p>
      {searchParams.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          ✓ Articles tagués.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {videos.map((v) => {
          const sel = tagged.get(v.id) ?? new Set<string>();
          return (
            <details key={v.id} className="rounded-2xl border border-gray-200 bg-white p-3.5" open={sel.size === 0}>
              <summary className="cursor-pointer text-xs">
                <b>▶ {v.title}</b>
                <span className="ml-2 tabular-nums text-gray-400">
                  {v.views.toLocaleString("fr-FR")} vues · {v.likes.toLocaleString("fr-FR")} ❤
                </span>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    sel.size ? "bg-emerald-50 text-okgreen" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {sel.size ? `${sel.size} article${sel.size > 1 ? "s" : ""}` : "à taguer"}
                </span>
              </summary>
              <form method="post" action="/app/videos/tag" className="mt-3">
                <input type="hidden" name="video" value={v.id} />
                <div className="flex flex-col gap-1.5">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="products"
                        value={p.id}
                        defaultChecked={sel.has(p.id)}
                        className="h-4 w-4 accent-indigo9"
                      />
                      {p.name}
                    </label>
                  ))}
                  {products.length === 0 && (
                    <p className="text-xs text-gray-400">Ajoute d&apos;abord des articles.</p>
                  )}
                </div>
                <button className="mt-3 rounded-full bg-indigo9 px-4 py-1.5 text-[11px] font-extrabold text-white">
                  Enregistrer les tags
                </button>
              </form>
            </details>
          );
        })}
        {videos.length === 0 && (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-400">
            Aucune vidéo synchronisée pour l&apos;instant.
          </p>
        )}
      </div>
      <AppNav active="/app" />
    </main>
  );
}
