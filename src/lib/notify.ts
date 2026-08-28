// Notifications sortantes — WhatsApp Cloud en production (décision MIKE,
// 2026-08-28), SMS local en alternative, mock en développement.
//
// Pourquoi WhatsApp : l'utilisatrice type vit dans TikTok et WhatsApp — un
// message WhatsApp est lu, un SMS l'est de moins en moins ; et à volume égal
// le template WhatsApp coûte moins cher que le SMS camerounais. Le prix de ce
// choix : une société vérifiée par Meta, un numéro dédié, un moyen de paiement
// international et CINQ templates approuvés dans la bonne catégorie (voir
// TEMPLATE_CATEGORY — envoyer du marketing sous « utility » expose à une
// suspension du compte). La passerelle SMS reste le repli si la vérification
// Meta traîne : le changement se fait ici, sans toucher au reste du code.
//
// Garde-fou (CLAUDE.md) : ce canal n'envoie QUE des templates transactionnels
// et marketing approuvés. Jamais de conversation automatisée — Meta interdit
// les assistants IA généralistes sur l'API Cloud depuis janvier 2026.

export type TemplateName =
  | "otp"                // code de connexion à 6 chiffres
  | "new_video_tag"      // « tague les articles de ta nouvelle vidéo »
  | "review_request"     // « donne ton avis sur ta commande »
  | "shop_announcement"  // annonce d'une boutique à ses abonnées
  | "drop_open";         // ouverture d'un drop

/** Catégorie de message — déterminante pour la conformité et le coût. */
export const TEMPLATE_CATEGORY: Record<TemplateName, "utility" | "marketing" | "authentication"> = {
  otp: "authentication",
  new_video_tag: "utility",
  review_request: "utility",
  shop_announcement: "marketing",
  drop_open: "marketing",
};

export interface NotifyProvider {
  readonly name: string;
  send(opts: {
    phone: string;
    template: TemplateName;
    body: string;
    link?: string;
    /**
     * Le code seul, pour le template « otp ». Les templates d'authentification
     * WhatsApp n'acceptent qu'un paramètre court (le code, 15 caractères max)
     * et exigent un bouton « copier le code » : la phrase complète part en SMS,
     * le code seul part en WhatsApp.
     */
    code?: string;
  }): Promise<{ delivered: boolean }>;
}

/** Développement et démonstration : journalise, n'envoie rien. */
class MockNotifyProvider implements NotifyProvider {
  readonly name = "mock";
  async send(opts: { phone: string; template: TemplateName; body: string; link?: string }) {
    console.log(
      `[notify mock] ${opts.phone} · ${opts.template} · ${opts.body}${opts.link ? ` · ${opts.link}` : ""}`
    );
    return { delivered: true };
  }
}

/**
 * Passerelle SMS locale (chemin de production par défaut).
 * Renseigner SMS_API_URL, SMS_API_KEY et SMS_SENDER_ID, puis adapter le corps
 * de la requête au format de la passerelle retenue — c'est le seul endroit à
 * modifier. La plupart des passerelles camerounaises attendent un POST JSON
 * { to, from, text } avec la clé en en-tête.
 */
class SmsNotifyProvider implements NotifyProvider {
  readonly name = "sms";

  private readonly url = process.env.SMS_API_URL ?? "";
  private readonly key = process.env.SMS_API_KEY ?? "";
  private readonly sender = process.env.SMS_SENDER_ID ?? "TARA";

  /** Un SMS = 160 caractères : on raccourcit plutôt que de payer 2 segments. */
  private compose(body: string, link?: string): string {
    const text = link ? `${body} ${link}` : body;
    return text.length <= 160 ? text : `${text.slice(0, 157)}...`;
  }

  async send(opts: { phone: string; template: TemplateName; body: string; link?: string }) {
    if (!this.url || !this.key) {
      console.warn("[notify sms] passerelle non configurée — message non envoyé");
      return { delivered: false };
    }
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({
          to: opts.phone,               // format E.164 sans « + » (237XXXXXXXXX)
          from: this.sender,
          text: this.compose(opts.body, opts.link),
        }),
        // une passerelle lente ne doit jamais bloquer une page
        signal: AbortSignal.timeout(8000),
      });
      return { delivered: res.ok };
    } catch {
      return { delivered: false };
    }
  }
}

/**
 * WhatsApp Cloud API — chemin de production.
 * Prérequis : société vérifiée par Meta, numéro dédié, moyen de paiement
 * international, et les cinq templates approuvés dans la BONNE catégorie.
 * Aucun BSP n'est obligatoire : l'onboarding direct chez Meta suffit.
 *
 * Côté Meta, chaque template porte le nom de son TemplateName (préfixable via
 * WHATSAPP_TEMPLATE_PREFIX si le WABA impose un espace de noms), avec UN
 * paramètre de corps {{1}} :
 *  - templates utility/marketing : {{1}} reçoit le texte, lien compris ;
 *  - template « otp » (authentication) : gabarit imposé par Meta — {{1}} reçoit
 *    le code seul, et le bouton « copier le code » est obligatoire dans l'appel.
 */
export class WhatsAppCloudProvider implements NotifyProvider {
  readonly name = "whatsapp_cloud";

  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  private readonly token = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  private readonly lang = process.env.WHATSAPP_TEMPLATE_LANG ?? "fr";
  private readonly prefix = process.env.WHATSAPP_TEMPLATE_PREFIX ?? "";
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";

  /** Un paramètre de template ne doit contenir ni retour à la ligne ni tabulation. */
  private compose(body: string, link?: string): string {
    const text = link ? `${body} ${link}` : body;
    return text.replace(/\s+/g, " ").trim();
  }

  async send(opts: {
    phone: string;
    template: TemplateName;
    body: string;
    link?: string;
    code?: string;
  }) {
    if (!this.phoneNumberId || !this.token) {
      console.warn("[notify whatsapp] identifiants absents — message non envoyé");
      return { delivered: false };
    }

    const authentication = TEMPLATE_CATEGORY[opts.template] === "authentication";
    if (authentication && !opts.code) {
      // Sans le code isolé, l'appel serait rejeté par Meta (paramètre > 15
      // caractères) : autant échouer ici, avec un message qui dit quoi faire.
      console.warn("[notify whatsapp] template d'authentification sans code — message non envoyé");
      return { delivered: false };
    }

    // Template d'authentification : corps = le code, + bouton « copier le
    // code » exigé par Meta. Autres templates : corps = texte et lien.
    const components = authentication
      ? [
          { type: "body", parameters: [{ type: "text", text: opts.code }] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: opts.code }],
          },
        ]
      : [
          {
            type: "body",
            parameters: [{ type: "text", text: this.compose(opts.body, opts.link) }],
          },
        ];

    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: opts.phone,
            type: "template",
            template: {
              name: `${this.prefix}${opts.template}`,
              language: { code: this.lang },
              components,
            },
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) {
        // le corps d'erreur Meta dit pourquoi (template inconnu, catégorie…)
        console.warn(`[notify whatsapp] refus ${res.status} — message non délivré`);
      }
      return { delivered: res.ok };
    } catch {
      return { delivered: false };
    }
  }
}

export function getNotifyProvider(): NotifyProvider {
  switch (process.env.NOTIFY_PROVIDER) {
    case "sms":
      return new SmsNotifyProvider();
    case "whatsapp_cloud":
      return new WhatsAppCloudProvider();
    default:
      return new MockNotifyProvider();
  }
}

/** Envoi groupé, tolérant aux échecs unitaires. */
export async function sendBulk(
  phones: string[],
  template: TemplateName,
  body: string,
  link?: string
): Promise<number> {
  const provider = getNotifyProvider();
  let ok = 0;
  for (const phone of phones) {
    try {
      const r = await provider.send({ phone, template, body, link });
      if (r.delivered) ok++;
    } catch {
      // un échec unitaire ne bloque pas la diffusion
    }
  }
  return ok;
}
