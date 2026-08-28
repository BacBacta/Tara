// Aides pures de create-seller.mjs — séparées pour être testables.
//
// slugifyMjs et RESERVED_SLUGS_MJS dupliquent src/lib/format.ts et
// src/lib/reserved.ts : un script .mjs ne peut pas importer du TypeScript
// sans étape de build. Un test de parité (tests/create-seller.test.ts)
// échoue si les deux copies divergent.

/** Miroir de slugify (src/lib/format.ts). */
export function slugifyMjs(input) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Miroir de RESERVED_SLUGS (src/lib/reserved.ts). */
export const RESERVED_SLUGS_MJS = new Set([
  "admin", "api", "app", "avis", "creer", "desabo",
  "cgu", "mentions-legales", "confidentialite",
  "robots.txt", "sitemap.xml", "favicon.ico", "_next", "public",
]);

/** Miroir de phoneCm (src/lib/payments.ts) : normalise ou renvoie null. */
export function normalizePhoneCm(input) {
  const digits = String(input).replace(/[^0-9]/g, "");
  if (!/^(237)?6\d{8}$/.test(digits)) return null;
  return digits.startsWith("237") ? digits : `237${digits}`;
}

/** Candidats de slug, dans l'ordre d'essai — même logique que uniqueSlug. */
export function slugCandidates(name) {
  const base = slugifyMjs(name) || "ma-boutique";
  const first = RESERVED_SLUGS_MJS.has(base) ? `${base}-boutique` : base;
  const list = [first];
  for (let i = 2; i < 50; i++) list.push(`${base}-${i}`);
  return list.filter((c) => !RESERVED_SLUGS_MJS.has(c));
}
