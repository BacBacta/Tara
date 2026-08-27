export function fcfa(n: number): string {
  return n.toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
}

/** Slug : minuscules, sans accents, tirets. Utilisé par l'onboarding (phase 4). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
