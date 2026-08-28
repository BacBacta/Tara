// Comment la vendeuse paie son abonnement.
//
// Le bouton « Activer l'illimité » lance un paiement chez l'agrégateur. Sans
// contrat agrégateur — la situation du pilote — ce paiement n'aboutit jamais :
// la vendeuse restait sur « Regarde ton téléphone » indéfiniment, sans qu'aucun
// code PIN n'arrive. Son seul moyen de payer était un cul-de-sac.
//
// Tant qu'il n'y a pas d'agrégateur, on dit la vérité : elle envoie l'argent
// au portefeuille MoMo de Tara, et Tara active l'abonnement à la main depuis
// le back-office (/admin, encaissement manuel — déjà en place).
//
// R1 reste intact : l'abonnement est le SEUL argent qui entre chez Tara.

export type OperateurTara = "mtn" | "orange";

export type CollecteAbonnement =
  | { mode: "agregateur" }
  | {
      mode: "manuel";
      /** Portefeuille MoMo de Tara — jamais inventé ici : il vient de l'env. */
      numero: string | null;
      operateur: OperateurTara;
      /** Numéro WhatsApp de Tara, pour prévenir après l'envoi. */
      whatsapp: string | null;
    };

/** Un fournisseur de paiement réel est branché ? */
export function agregateurActif(
  provider = process.env.PAYMENT_PROVIDER
): boolean {
  const v = (provider ?? "").trim().toLowerCase();
  return v !== "" && v !== "mock";
}

export function collecteAbonnement(
  env: Record<string, string | undefined> = process.env
): CollecteAbonnement {
  if (agregateurActif(env.PAYMENT_PROVIDER)) return { mode: "agregateur" };
  const numero = (env.TARA_MOMO_NUMBER ?? "").trim();
  const whatsapp = (env.TARA_WHATSAPP ?? "").trim();
  return {
    mode: "manuel",
    numero: numero === "" ? null : numero,
    operateur: (env.TARA_MOMO_OPERATOR ?? "").trim().toLowerCase() === "orange" ? "orange" : "mtn",
    whatsapp: whatsapp === "" ? null : whatsapp,
  };
}

/** Message tout prêt : elle prévient Tara du virement en un appui. */
export function messagePreviensTara(slug: string, montant: string): string {
  return `Bonjour Tara ! Je viens d'envoyer ${montant} pour l'abonnement de ma boutique « ${slug} ». Peux-tu l'activer ?`;
}
