// Socle visuel de l'onboarding vendeuse.
// Même vocabulaire que la page d'accueil et la vitrine : marque « tara. »,
// titrage en police d'affichage, bouton mango en relief, ombres teintées.
// Tout est du CSS : l'inscription est un parcours public, elle doit marcher
// sans JavaScript (R2).

const TOTAL = 4;

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display tracking-tight text-indigo9 ${className}`}>
      tara<span className="text-mango">.</span>
    </span>
  );
}

/** Progression : les étapes faites et l'étape en cours sont pleines.
 *  Décoratif — l'information est donnée en toutes lettres dans l'en-tête. */
export function Dots({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div aria-hidden className="flex gap-1.5">
      {Array.from({ length: TOTAL }, (_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full ${i < step ? "bg-indigo9" : "bg-ink/10"}`}
        />
      ))}
    </div>
  );
}

export function ObHeader({ step, label }: { step: 1 | 2 | 3 | 4; label?: string }) {
  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <Wordmark className="text-[17px]" />
        <span className="text-[10.5px] font-extrabold uppercase tracking-micro text-inkSoft">
          {label ?? `Étape ${step} sur ${TOTAL}`}
        </span>
      </div>
      <Dots step={step} />
    </>
  );
}

export function ObShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: 1 | 2 | 3 | 4;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-md px-5 pb-14 pt-5">
      <ObHeader step={step} />
      <h1 className="mt-6 text-balance font-display text-[26px] leading-[1.14] tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-inkSoft">{subtitle}</p>
      )}
      <div className="mt-7">{children}</div>
    </main>
  );
}

const TONES = {
  erreur: "border-red-500/15 bg-red-50 text-red-600",
  attention: "border-mango/30 bg-amber-50 text-amber-700",
  info: "border-indigo9/20 bg-indigo9/[0.09] text-indigo9",
} as const;

export function ObAlert({
  tone = "erreur",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`mb-4 rounded-2xl border px-4 py-3 text-[13px] font-bold leading-snug ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}

export { inputCls, labelCls, hintCls, ctaCls } from "./ob-styles";
