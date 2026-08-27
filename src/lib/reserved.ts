// Slugs réservés : ces chemins existent à la racine du site et masqueraient
// une boutique qui porterait le même nom. Next.js donne la priorité aux
// routes statiques sur la route dynamique [slug] — une boutique nommée
// « admin » ou « confidentialite » serait donc inaccessible.
//
// Toute nouvelle route racine doit être ajoutée ici.
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "avis",
  "creer",
  "desabo",
  // Lot 3 — pages publiques
  "cgu",
  "mentions-legales",
  "confidentialite",
  "robots.txt",
  "sitemap.xml",
  // réservés par prudence (fichiers servis à la racine)
  "favicon.ico",
  "_next",
  "public",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
