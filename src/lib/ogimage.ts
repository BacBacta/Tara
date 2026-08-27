// Image d'aperçu de partage (Open Graph), générée à la volée depuis les
// données de la boutique — aucune vendeuse n'a à fournir de fichier.
//
// Rendue par sharp, déjà présent pour les photos d'articles : pas de nouvelle
// dépendance. Le SVG est converti en PNG parce que WhatsApp et TikTok
// n'affichent pas les aperçus en SVG.
import sharp from "sharp";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Échappe le texte inséré dans le SVG (noms de boutique arbitraires). */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Coupe proprement un texte trop long pour la largeur de l'image. */
export function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Marge latérale du gabarit. */
const MARGIN = 80;
export const OG_TEXT_WIDTH = OG_WIDTH - MARGIN * 2;

/**
 * Taille de police qui tient dans la largeur disponible.
 * Une police fixe faisait déborder les noms d'articles longs hors du cadre :
 * on la réduit jusqu'à ce que la largeur estimée rentre, sans descendre en
 * dessous d'un plancher lisible sur un écran de téléphone.
 *
 * 0.58 est le rapport largeur/hauteur moyen d'un caractère en sans-serif gras
 * — approximation volontaire : sharp ne mesure pas le texte avant rendu.
 */
export function fitFontSize(
  text: string,
  maxSize: number,
  minSize = 40,
  width = OG_TEXT_WIDTH
): number {
  const estimated = text.length * maxSize * 0.58;
  if (estimated <= width) return maxSize;
  return Math.max(minSize, Math.floor(width / (text.length * 0.58)));
}

export function ogSvg(opts: {
  title: string;
  subtitle: string;
  badge?: string | null;
  color: string;
}): string {
  const color = /^#[0-9A-Fa-f]{6}$/.test(opts.color) ? opts.color : "#33418F";
  const rawTitle = clamp(opts.title, 44);
  const rawSubtitle = clamp(opts.subtitle, 56);
  const rawBadge = opts.badge ? clamp(opts.badge, 40) : null;

  const titleSize = fitFontSize(rawTitle, 82, 40);
  const subtitleSize = fitFontSize(rawSubtitle, 38, 24);
  const badgeSize = rawBadge ? fitFontSize(rawBadge, 34, 22) : 34;

  const title = escapeXml(rawTitle);
  const subtitle = escapeXml(rawSubtitle);
  const badge = rawBadge ? escapeXml(rawBadge) : null;
  const family = "DejaVu Sans, Liberation Sans, FreeSans, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${color}"/>
  <rect x="0" y="${OG_HEIGHT - 18}" width="${OG_WIDTH}" height="18" fill="#F5A623"/>
  <text x="${MARGIN}" y="250" font-family="${family}" font-size="${titleSize}" font-weight="bold" fill="#FFFFFF">${title}</text>
  <text x="${MARGIN}" y="330" font-family="${family}" font-size="${subtitleSize}" fill="#FFFFFF" opacity="0.86">${subtitle}</text>
  ${badge ? `<text x="${MARGIN}" y="410" font-family="${family}" font-size="${badgeSize}" fill="#F5A623" font-weight="bold">${badge}</text>` : ""}
  <text x="80" y="${OG_HEIGHT - 70}" font-family="${family}" font-size="30" fill="#FFFFFF" opacity="0.7">tara.shop</text>
</svg>`;
}

/**
 * Rend le PNG. Si le rendu du texte échoue (police absente sur le serveur),
 * on renvoie un aplat de couleur plutôt qu'une erreur 500 : un aperçu terne
 * vaut mieux qu'un lien cassé dans WhatsApp.
 */
export async function renderOgPng(opts: {
  title: string;
  subtitle: string;
  badge?: string | null;
  color: string;
}): Promise<Buffer> {
  try {
    return await sharp(Buffer.from(ogSvg(opts))).png().toBuffer();
  } catch {
    const color = /^#[0-9A-Fa-f]{6}$/.test(opts.color) ? opts.color : "#33418F";
    return sharp({
      create: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        channels: 3,
        background: color,
      },
    })
      .png()
      .toBuffer();
  }
}
