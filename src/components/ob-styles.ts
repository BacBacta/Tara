// Classes partagées des champs de l'onboarding.
// Fichier séparé pour que le champ client (NameSlugField) puisse les lire
// sans embarquer les composants serveur dans le paquet JavaScript.
export const inputCls =
  "mt-2 w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3.5 text-base font-bold " +
  "placeholder:font-medium placeholder:text-ink/30 focus:border-indigo9";
export const labelCls =
  "block text-[10.5px] font-extrabold uppercase tracking-micro text-inkSoft";
export const hintCls = "mt-2.5 text-[12.5px] leading-relaxed text-inkSoft";
export const ctaCls = "btn-mango mt-6";
