/** La marque, écrite pareil partout : accueil, onboarding, espace vendeuse. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display tracking-tight text-indigo9 ${className}`}>
      tara<span className="text-mango">.</span>
    </span>
  );
}
