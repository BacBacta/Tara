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

/**
 * Mode direct : message envoyé par l'acheteuse à la vendeuse pour annoncer
 * son envoi d'argent. Il annonce un envoi, il ne le prouve pas — c'est la
 * vendeuse qui vérifie la réception sur son téléphone (R1).
 */
export function directPaymentMessage(opts: {
  productName: string;
  variant?: string | null;
  qty: number;
  priceLabel: string;
  orderId: string;
  momoNumber: string;
  operatorLabel: string;
  lang: "fr" | "en";
}): string {
  const { productName, variant, qty, priceLabel, orderId, momoNumber, operatorLabel, lang } = opts;
  const item = `${productName}${variant ? ` (${variant})` : ""} × ${qty}`;
  if (lang === "en") {
    return [
      `Hello! I have just sent the payment for my order:`,
      `• ${item}`,
      `• Amount: ${priceLabel}`,
      `• Sent to: ${momoNumber} (${operatorLabel})`,
      `• Order no: ${orderId}`,
      `Can you confirm you received it?`,
    ].join("\n");
  }
  return [
    `Bonjour ! Je viens d'envoyer le paiement de ma commande :`,
    `• ${item}`,
    `• Montant : ${priceLabel}`,
    `• Envoyé au : ${momoNumber} (${operatorLabel})`,
    `• N° de commande : ${orderId}`,
    `Tu peux me confirmer la réception ?`,
  ].join("\n");
}

/** Extrait l'identifiant vidéo d'une URL TikTok (pour l'embed). */
export function tiktokVideoId(url: string): string | null {
  const m = url.match(/video\/(\d{8,25})/);
  return m ? m[1] : null;
}
