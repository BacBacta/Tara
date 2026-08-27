import QRCode from "qrcode";
import { requireShop } from "@/lib/guard";
import AppNav from "@/components/AppNav";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function Partage() {
  const { shop } = await requireShop();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const link = `${base}/${shop.slug}`;
  const display = link.replace(/^https?:\/\//, "");
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 300 });

  const pinned = `Commandez ici 👉 ${display}\nPaiement MoMo ✅ Livraison ${shop.city} 🛵`;
  const bioText = display;

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">Kit de partage</h1>
      <p className="mt-1 text-xs text-gray-500">
        Tout ce qu&apos;il faut pour envoyer tes clients vers ta boutique.
      </p>

      {/* 1. lien */}
      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
          Ton lien
        </p>
        <p className="mt-1 break-all text-base font-extrabold text-indigo9">{display}</p>
        <CopyButton text={link} />
      </section>

      {/* 2. QR */}
      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
          Ton QR code
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt={`QR code de ${display}`}
          width={180}
          height={180}
          className="mx-auto mt-3 rounded-xl border border-gray-200"
        />
        <p className="mt-2 text-[11px] text-gray-500">
          Montre-le en fin de vidéo, en live, ou sur ton comptoir.
        </p>
        <a
          href="/app/partage/qr"
          download={`bioshop-${shop.slug}.png`}
          className="mt-3 inline-block rounded-2xl bg-indigo9 px-5 py-3 text-sm font-extrabold text-white"
        >
          ⬇ Télécharger le QR
        </a>
      </section>

      {/* 3. commentaire épinglé */}
      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
          Texte à épingler en commentaire
        </p>
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-sand p-3 text-xs font-semibold">
          {pinned}
        </pre>
        <CopyButton text={pinned} />
        <p className="mt-2 text-[11px] text-gray-500">
          Astuce : épingle ce commentaire sous chacune de tes vidéos — souvent plus cliqué
          que la bio.
        </p>
      </section>

      {/* 4. guide bio TikTok */}
      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-xs">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
          Mettre le lien dans ta bio TikTok
        </p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-gray-600">
          <li>Ouvre TikTok → <b>Profil</b> → <b>Modifier le profil</b></li>
          <li>Champ <b>Site web</b> → colle <b className="break-all">{bioText}</b></li>
          <li>Enregistre, puis dis-le dans ta prochaine vidéo</li>
        </ol>
        <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-[11px] font-semibold text-amber-800">
          Le champ « Site web » apparaît à partir de 1 000 abonnés (ou avec un compte
          Business). En attendant : utilise le commentaire épinglé ci-dessus, ou envoie ton
          lien en message privé à celles et ceux qui commentent.
        </p>
      </section>

      <AppNav active="/app" />
    </main>
  );
}
