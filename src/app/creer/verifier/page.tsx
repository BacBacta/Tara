import { redirect } from "next/navigation";
import { ObShell, inputCls, labelCls, ctaCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default function Verifier({
  searchParams,
}: {
  searchParams: { p?: string; d?: string; err?: string };
}) {
  const phone = searchParams.p;
  if (!phone) redirect("/creer");
  return (
    <ObShell
      step={1}
      title="Entre le code reçu 📲"
      subtitle={`Un code à 6 chiffres a été envoyé au ${phone.replace(/^237/, "")}.`}
    >
      {searchParams.d && (
        <p className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo9">
          Mode démo — ton code de test : {searchParams.d}
        </p>
      )}
      {searchParams.err && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Code incorrect ou expiré — réessaie.
        </p>
      )}
      <form method="post" action="/creer/verifier/check">
        <input type="hidden" name="phone" value={phone} />
        <label className={labelCls}>
          Code de confirmation
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            required
            className={`${inputCls} text-center text-2xl tracking-[0.4em]`}
          />
        </label>
        <button type="submit" className={ctaCls}>
          Vérifier →
        </button>
      </form>
      <a href="/creer" className="mt-4 block text-center text-xs font-bold text-gray-500">
        ← Changer de numéro
      </a>
    </ObShell>
  );
}
