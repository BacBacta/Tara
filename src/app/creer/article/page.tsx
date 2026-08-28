import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { ObShell, ObAlert, inputCls, labelCls, hintCls } from "@/components/Onboarding";

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
      {searchParams.err && <ObAlert>Vérifie le nom et le prix de l&apos;article.</ObAlert>}

      <form
        method="post"
        action="/creer/article/save"
        encType="multipart/form-data"
        className="flex flex-col gap-5"
      >
        {/* Envoi de fichier en formulaire natif : aucun JavaScript requis (R2). */}
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-3xl border border-dashed border-indigo9/30 bg-cream px-4 py-7 shadow-card text-center">
          <span aria-hidden className="text-2xl">📷</span>
          <span className="text-[13.5px] font-extrabold text-indigo9">
            Ajouter une photo
          </span>
          <span className="text-[12px] text-inkSoft">
            C&apos;est la première chose que voit ta cliente — facultatif
          </span>
          <input type="file" name="photo" accept="image/*" className="sr-only" />
        </label>

        <label className={labelCls}>
          Nom de l&apos;article
          <input
            name="name"
            placeholder="Ex : Robe wax cintrée"
            required
            minLength={3}
            maxLength={80}
            className={inputCls}
          />
        </label>

        <label className={labelCls}>
          Prix en FCFA
          <input
            name="price"
            inputMode="numeric"
            placeholder="8500"
            required
            className={`${inputCls} tabular-nums`}
          />
        </label>

        <div>
          <label className={labelCls}>
            Lien de ta vidéo TikTok (facultatif)
            <input
              name="video_url"
              inputMode="url"
              placeholder="tiktok.com/@toi/video/…"
              className={inputCls}
            />
          </label>
          <p className={hintCls}>
            ▶ La vidéo s&apos;affichera sur la fiche — tes clientes retrouvent ce qu&apos;elles
            ont vu.
          </p>
        </div>

        <button type="submit" className="btn-mango mt-1">
          Créer ma boutique 🎉
        </button>
      </form>

      <a
        href="/creer/fini"
        className="mt-5 block text-center text-[12.5px] font-bold text-inkSoft underline underline-offset-2"
      >
        Je le ferai plus tard →
      </a>
    </ObShell>
  );
}
