import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { ObShell, inputCls, labelCls, ctaCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default async function Etape3(props: { searchParams: Promise<{ err?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await readSession();
  if (!session) redirect("/creer");
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) redirect("/creer/boutique");

  return (
    <ObShell
      step={3}
      title="Ajoute ton premier article"
      subtitle="Une photo, un nom, un prix — comme sur ton statut, mais en mieux."
    >
      {searchParams.err && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Vérifie le nom et le prix de l&apos;article.
        </p>
      )}
      <form
        method="post"
        action="/creer/article/save"
        encType="multipart/form-data"
        className="flex flex-col gap-4"
      >
        <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-gray-300 bg-white text-sm font-bold text-gray-500">
          <span className="text-2xl">📷</span>
          Photo de l&apos;article (optionnel)
          <input type="file" name="photo" accept="image/*" className="sr-only" />
        </label>
        <label className={labelCls}>
          Nom de l&apos;article
          <input name="name" placeholder="Ex : Robe wax cintrée" required minLength={3} maxLength={80} className={inputCls} />
        </label>
        <label className={labelCls}>
          Prix (FCFA)
          <input name="price" inputMode="numeric" placeholder="8500" required className={inputCls} />
        </label>
        <label className={labelCls}>
          Lien de ta vidéo TikTok (optionnel)
          <input name="video_url" inputMode="url" placeholder="https://www.tiktok.com/@toncompte/video/…" className={inputCls} />
        </label>
        <p className="-mt-2 text-xs text-gray-500">
          ▶ La vidéo s&apos;affichera sur la fiche — les clients retrouvent ce qu&apos;ils ont vu.
        </p>
        <button type="submit" className={ctaCls}>
          Créer ma boutique 🎉
        </button>
      </form>
      <a href="/creer/fini" className="mt-3 block text-center text-xs font-bold text-gray-500">
        Je le ferai plus tard →
      </a>
    </ObShell>
  );
}
