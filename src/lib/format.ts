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

/**
 * Date stockée → « YYYY-MM-DD HH:MM:SS », toujours.
 *
 * Deux formats cohabitent en base : le format SQL pour tout ce qu'écrivent
 * les migrations (`created_at`), et l'ISO 8601 pour ce qu'écrit JavaScript
 * (`plan_expires_at`, via toISOString). Les deux se comparent bien en Date,
 * mais l'export CSV les mettait côte à côte dans la même feuille de calcul.
 */
export function dateCsv(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v.includes("T") ? v : `${v.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString().slice(0, 19).replace("T", " ");
}
