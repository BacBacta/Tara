import QRCode from "qrcode";
import { requireShop } from "@/lib/guard";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function Partage() {
  const { shop } = await requireShop();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const link = `${base}/${shop.slug}`;
  const display = link.replace(/^https?:\/\//, "");
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 300 });

  const pinned = `Commandez ici 👉 ${display}\nPaiement MoMo ✅ Livraison ${shop.city} 🛵`;

  return (
    <AppShell
      slug={shop.slug}
      active="/app"
      title="Kit de partage"
      subtitle="Tout ce qu'il faut pour envoyer tes clientes vers ta boutique."
    >
      {/* 1. le lien — même carte que sur l'écran de fin d'inscription */}
      <section className="grain overflow-hidden rounded-3xl bg-gradient-to-br from-indigo9 via-indigoDeep to-indigoNight px-5 py-6 text-center text-white shadow-float">
        <p className="text-[10.5px] font-extrabold uppercase tracking-micro text-white/50">
          Ton lien
        </p>
        <p className="mt-2 select-all break-words font-display text-[19px] leading-snug tracking-tight">
          {display}
        </p>
        <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-2.5 shadow-card">
          {/* QR rendu côté serveur : visible même sans JavaScript */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code de ${display}`}
            width={160}
            height={160}
            className="block rounded-lg"
          />
        </div>
        <p className="mt-3 text-[11.5px] text-white/55">
          Montre-le en fin de vidéo, en live, ou sur ton comptoir.
        </p>
      </section>

      <div className="mt-4 flex flex-col gap-2.5">
        <CopyButton text={link} />
        <a href="/app/partage/qr" download={`tara-${shop.slug}.png`} className="btn-ghost">
          ⬇ Télécharger le QR
        </a>
      </div>

      {/* 2. commentaire épinglé */}
      <h2 className="label-micro mb-2.5 mt-7">Texte à épingler en commentaire</h2>
      <div className="card p-4">
        <pre className="whitespace-pre-wrap rounded-2xl bg-sand p-3.5 font-sans text-[12.5px] font-semibold leading-relaxed">
          {pinned}
        </pre>
        <div className="mt-3">
          <CopyButton text={pinned} />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-inkSoft">
          Astuce : épingle ce commentaire sous chacune de tes vidéos — souvent plus cliqué que
          la bio.
        </p>
      </div>

      {/* 3. guide bio TikTok */}
      <h2 className="label-micro mb-2.5 mt-7">Mettre le lien dans ta bio TikTok</h2>
      <div className="card p-4">
        <ol className="flex flex-col gap-2.5 text-[13px] leading-relaxed">
          {[
            <>Ouvre TikTok → <b>Profil</b> → <b>Modifier le profil</b></>,
            <>Champ <b>Site web</b> → colle <b className="break-all">{display}</b></>,
            <>Enregistre, puis dis-le dans ta prochaine vidéo</>,
          ].map((etape, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo9 text-[10.5px] font-extrabold text-white">
                {i + 1}
              </span>
              <span>{etape}</span>
            </li>
          ))}
        </ol>
        <Alert tone="attention" className="mt-4">
          Le champ « Site web » apparaît à partir de 1 000 abonnés (ou avec un compte
          Business). En attendant : utilise le commentaire épinglé ci-dessus, ou envoie ton
          lien en message privé à celles et ceux qui commentent.
        </Alert>
      </div>
    </AppShell>
  );
}
