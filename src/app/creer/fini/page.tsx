import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { ObHeader } from "@/components/Onboarding";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function Etape4() {
  const session = await readSession();
  if (!session) redirect("/creer");
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) redirect("/creer/boutique");

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const link = `${base}/${shop.slug}`;
  const displayLink = link.replace(/^https?:\/\//, "");
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 220 });

  const steps: Array<[string, string]> = [
    ["Colle le lien dans ta bio TikTok", "Profil → Modifier le profil → Site web"],
    ["Dis-le dans ta prochaine vidéo", "« Le lien est dans ma bio ! »"],
    ["Reçois tes commandes sur WhatsApp", "Article, taille, adresse — tout arrive prêt"],
  ];

  return (
    <main className="mx-auto max-w-md px-5 pb-14 pt-5">
      <ObHeader step={4} label="Terminé" />

      <div className="mt-7 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
          🎉
        </div>
        <h1 className="mt-4 font-display text-[26px] leading-[1.14] tracking-tight">
          Ta boutique est en ligne
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-inkSoft">
          Il ne reste qu&apos;une chose à faire : partager ton lien.
        </p>
      </div>

      {/* Le lien est le produit de tout l'onboarding : il a droit à la même
          carte que le numéro de paiement sur la fiche acheteuse. */}
      <section className="grain mt-7 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo9 via-indigoDeep to-indigoNight px-5 py-6 text-center text-white shadow-float">
        <p className="text-[10.5px] font-extrabold uppercase tracking-micro text-white/50">
          Ton lien
        </p>
        <p className="mt-2 select-all break-words font-display text-[19px] leading-snug tracking-tight">
          {displayLink}
        </p>
        {/* QR généré côté serveur : aucun JS requis pour l'afficher */}
        <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-2.5 shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code de ${displayLink}`}
            width={140}
            height={140}
            className="block rounded-lg"
          />
        </div>
        <p className="mt-3 text-[11.5px] text-white/55">
          Montre ce QR en fin de vidéo ou en live
        </p>
      </section>

      <div className="mt-4">
        <CopyButton text={link} />
      </div>

      <ol className="card mt-7 divide-y divide-ink/[0.06] px-4">
        {steps.map(([titre, aide], i) => (
          <li key={titre} className="flex items-start gap-3 py-3.5">
            <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo9 text-[11px] font-extrabold text-white">
              {i + 1}
            </span>
            <span className="text-[13.5px] leading-relaxed">
              <b>{titre}</b>
              <br />
              <span className="text-inkSoft">{aide}</span>
            </span>
          </li>
        ))}
      </ol>

      <a href="/app" className="btn-ghost mt-6">
        Voir mon tableau de bord →
      </a>
    </main>
  );
}
