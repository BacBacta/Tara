import { redirect } from "next/navigation";
import { ObShell, ObAlert, inputCls, labelCls, hintCls, ctaCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export default async function Verifier(
  props: {
    searchParams: Promise<{ p?: string; d?: string; err?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const phone = searchParams.p;
  if (!phone) redirect("/creer");
  return (
    <ObShell
      step={1}
      title="Entre le code reçu"
      subtitle={`Un code à 6 chiffres a été envoyé au ${phone.replace(/^237/, "")}.`}
    >
      {searchParams.d && (
        <ObAlert tone="info">Mode démo — ton code de test : {searchParams.d}</ObAlert>
      )}
      {searchParams.err && <ObAlert>Code incorrect ou expiré — réessaie.</ObAlert>}

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
            autoFocus
            className={`${inputCls} py-4 text-center font-display text-[30px] tabular-nums tracking-[0.35em] placeholder:tracking-[0.35em]`}
          />
        </label>
        <p className={hintCls}>Il est valable 10 minutes.</p>
        <button type="submit" className={ctaCls}>
          Vérifier →
        </button>
      </form>

      <a
        href="/creer"
        className="mt-5 block text-center text-[12.5px] font-bold text-inkSoft underline underline-offset-2"
      >
        ← Changer de numéro
      </a>
    </ObShell>
  );
}
