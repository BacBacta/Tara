// Un seul bandeau de message pour tout le produit : succès, erreur,
// avertissement, information. Il remplace une dizaine de <p> recopiés.
const TONES = {
  ok: "border-okgreen/20 bg-emerald-50 text-okgreen",
  erreur: "border-red-500/15 bg-red-50 text-red-600",
  attention: "border-mango/30 bg-amber-50 text-amber-700",
  info: "border-indigo9/20 bg-indigo9/[0.09] text-indigo9",
} as const;

export type Tone = keyof typeof TONES;

export default function Alert({
  tone = "erreur",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-[13px] font-bold leading-snug ${TONES[tone]} ${className}`}
    >
      {children}
    </p>
  );
}
