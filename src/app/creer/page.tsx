import Link from "next/link";
import { ObShell, ObAlert, inputCls, labelCls, hintCls, ctaCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

// Ce que la vendeuse obtient, avant qu'on lui demande son numéro.
// La troisième ligne dit la vérité de R1 côté vendeuse : l'argent va de
// l'acheteuse à elle, Tara n'est jamais sur le trajet.
const PROMESSES = [
  "Un lien à toi, à coller dans ta bio TikTok",
  "Les commandes arrivent sur ton WhatsApp, prêtes à lire",
  "Tes clientes te paient en Mobile Money, directement — Tara ne touche jamais ton argent",
];

export default async function Etape1(props: { searchParams: Promise<{ err?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <ObShell
      step={1}
      title="Crée ta boutique en 10 minutes"
      subtitle="Il te faut seulement ton numéro WhatsApp. Gratuit jusqu'à 10 articles."
    >
      {searchParams.err === "phone" && (
        <ObAlert>Numéro invalide — entre ton numéro WhatsApp (ex : 6 91 88 22 10).</ObAlert>
      )}
      {searchParams.err === "rate" && (
        <ObAlert tone="attention">Trop de codes demandés — réessaie dans une heure.</ObAlert>
      )}

      <ul className="card mb-7 divide-y divide-ink/[0.06] px-4">
        {PROMESSES.map((texte) => (
          <li key={texte} className="flex items-start gap-3 py-3.5 text-[13.5px] leading-relaxed">
            <span
              aria-hidden
              className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo9/10 text-[11px] font-extrabold text-indigo9"
            >
              ✓
            </span>
            <span>{texte}</span>
          </li>
        ))}
      </ul>

      <form method="post" action="/creer/otp">
        <label className={labelCls}>
          Ton numéro WhatsApp
          <input
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="6 91 88 22 10"
            required
            className={`${inputCls} tabular-nums tracking-wide`}
          />
        </label>
        <p className={hintCls}>
          C&apos;est là que tes commandes arriveront. Un code de confirmation t&apos;est envoyé.
        </p>
        <button type="submit" className={ctaCls}>
          Commencer →
        </button>
      </form>

      {/* /creer sert aussi de porte de retour : le même numéro rouvre la boutique. */}
      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-inkSoft">
        Tu as déjà une boutique ? Entre le même numéro : tu retrouveras ton tableau de bord.
      </p>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-inkSoft/80">
        En continuant, tu acceptes les{" "}
        <Link href="/cgu" className="font-bold underline underline-offset-2">
          conditions d&apos;utilisation
        </Link>
        .
      </p>
    </ObShell>
  );
}
