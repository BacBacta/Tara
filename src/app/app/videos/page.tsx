import Link from "next/link";
import { requireShop } from "@/lib/guard";
import { getIdentity } from "@/lib/identities";
import { db } from "@/lib/db";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";

export const dynamic = "force-dynamic";

export default async function Videos(props: { searchParams: Promise<{ ok?: string }> }) {
  const searchParams = await props.searchParams;
  const { sellerId, shop } = await requireShop();
  const identity = await getIdentity(sellerId);
  if (identity?.status !== "active") {
    return (
      <AppShell slug={shop.slug} active="/app" title="Mes vidéos">
        <Link
          href="/app/tiktok"
          className="card block border-dashed border-indigo9/35 bg-indigo9/[0.05] p-4 text-center text-[13.5px] font-extrabold text-indigo9"
        >
          Connecte ton compte TikTok pour synchroniser tes vidéos →
        </Link>
      </AppShell>
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
    <AppShell
      slug={shop.slug}
      active="/app"
      title="Mes vidéos"
      subtitle="Tague les articles qui apparaissent dans chaque vidéo : ils s'affichent dans « Vu dans mes vidéos » sur ta boutique."
    >
      {searchParams.ok && (
        <Alert tone="ok" className="mb-4">
          ✓ Articles tagués.
        </Alert>
      )}

      <div className="flex flex-col gap-2.5">
        {videos.map((v) => {
          const sel = tagged.get(v.id) ?? new Set<string>();
          return (
            <details key={v.id} className="card p-4" open={sel.size === 0}>
              <summary className="cursor-pointer text-[12.5px] leading-relaxed">
                <b>▶ {v.title}</b>
                <span className="ml-2 tabular-nums text-inkSoft">
                  {v.views.toLocaleString("fr-FR")} vues · {v.likes.toLocaleString("fr-FR")} ❤
                </span>
                <span
                  className={`chip ml-2 font-extrabold ${
                    sel.size ? "bg-emerald-50 text-okgreen" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {sel.size ? `${sel.size} article${sel.size > 1 ? "s" : ""}` : "à taguer"}
                </span>
              </summary>
              <form method="post" action="/app/videos/tag" className="mt-4">
                <input type="hidden" name="video" value={v.id} />
                <div className="flex flex-col gap-2">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2.5 text-[13px]">
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
                    <p className="text-[12.5px] text-inkSoft">Ajoute d&apos;abord des articles.</p>
                  )}
                </div>
                <button className="chip mt-4 bg-indigo9 px-4 py-1.5 font-extrabold text-white transition-transform active:scale-[0.97]">
                  Enregistrer les tags
                </button>
              </form>
            </details>
          );
        })}
        {videos.length === 0 && (
          <p className="card p-4 text-[12.5px] text-inkSoft">
            Aucune vidéo synchronisée pour l&apos;instant.
          </p>
        )}
      </div>
    </AppShell>
  );
}
