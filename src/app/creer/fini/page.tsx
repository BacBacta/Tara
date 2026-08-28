import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { Dots } from "@/components/Onboarding";
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
    <main className="mx-auto max-w-md px-6 pb-10 pt-8">
      <Dots step={4} />
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-4xl">
          🎉
        </div>
        <h1 className="mt-3 text-xl font-extrabold">Ta boutique est en ligne !</h1>
      </div>

      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 text-center">
        <p className="break-all text-base font-extrabold text-indigo9">{displayLink}</p>
        <p className="mt-1 text-xs text-gray-500">ton lien unique — il t&apos;appartient</p>
        <CopyButton text={link} />
        {/* QR généré côté serveur : aucun JS requis pour l'afficher */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt={`QR code de ${displayLink}`}
          width={140}
          height={140}
          className="mx-auto mt-4 rounded-xl border border-gray-200"
        />
        <p className="mt-1 text-[11px] text-gray-400">
          Montre ce QR en fin de vidéo ou en live
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {steps.map(([title, hint], i) => (
          <div key={title} className="flex items-start gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo9 text-[11px] font-extrabold text-white">
              {i + 1}
            </span>
            <span>
              <b>{title}</b>
              <br />
              <span className="text-gray-500">{hint}</span>
            </span>
          </div>
        ))}
      </div>

      <a
        href="/app"
        className="mt-6 block w-full rounded-2xl bg-mango px-5 py-4 text-center text-sm font-extrabold text-[#3A2A00]"
      >
        Voir mon tableau de bord →
      </a>
    </main>
  );
}
