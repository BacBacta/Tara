// Construction des liens wa.me pré-remplis (Phase 1 : lien direct ;
// Phase 2 : création de commande + redirection via /api).
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function orderMessage(opts: {
  productName: string;
  variant?: string | null;
  qty: number;
  priceLabel: string;
  productUrl: string;
  orderId?: string;
  lang: "fr" | "en";
}): string {
  const { productName, variant, qty, priceLabel, productUrl, orderId, lang } = opts;
  if (lang === "en") {
    return [
      `Hello! I want to order:`,
      `• ${productName}${variant ? ` (${variant})` : ""} × ${qty}`,
      `• Price: ${priceLabel}`,
      orderId ? `• Order no: ${orderId}` : null,
      productUrl,
    ].filter(Boolean).join("\n");
  }
  return [
    `Bonjour ! Je veux commander :`,
    `• ${productName}${variant ? ` (${variant})` : ""} × ${qty}`,
    `• Prix : ${priceLabel}`,
    orderId ? `• N° de commande : ${orderId}` : null,
    productUrl,
  ].filter(Boolean).join("\n");
}

/** Extrait l'identifiant vidéo d'une URL TikTok (pour l'embed). */
export function tiktokVideoId(url: string): string | null {
  const m = url.match(/video\/(\d{8,25})/);
  return m ? m[1] : null;
}
