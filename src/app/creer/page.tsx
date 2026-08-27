import { ObShell, inputCls, labelCls, ctaCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default function Etape1({ searchParams }: { searchParams: { err?: string } }) {
  return (
    <ObShell
      step={1}
      title="Crée ta boutique en 10 minutes 🛍️"
      subtitle="Gratuit jusqu'à 10 articles. Il te faut juste ton numéro WhatsApp."
    >
      {searchParams.err === "phone" && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Numéro invalide — entre ton numéro WhatsApp (ex : 6 91 88 22 10).
        </p>
      )}
      {searchParams.err === "rate" && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          Trop de codes demandés — réessaie dans une heure.
        </p>
      )}
      <form method="post" action="/creer/otp">
        <label className={labelCls}>
          Ton numéro WhatsApp
          <input
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="6 91 88 22 10"
            required
            className={inputCls}
          />
        </label>
        <p className="mt-2 text-xs text-gray-500">
          C&apos;est là que tes commandes arriveront. Un code de confirmation t&apos;est envoyé.
        </p>
        <button type="submit" className={ctaCls}>
          Commencer →
        </button>
      </form>
    </ObShell>
  );
}
