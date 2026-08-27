// Notifications sortantes — SMS local par défaut, WhatsApp en option de croissance.
//
// Choix d'architecture (V2) : le SMS via une passerelle camerounaise est le
// chemin par défaut. Il atteint 100 % des téléphones (y compris non-smartphones),
// ne demande ni vérification d'entreprise Meta ni carte bancaire internationale,
// et se facture souvent en FCFA. L'API WhatsApp Cloud devient intéressante plus
// tard, à volume élevé : moins chère au message et mieux lue — mais elle exige
// une société vérifiée par Meta, un moyen de paiement international et des
// templates approuvés. Le changement se fait ici, sans toucher au reste du code.

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
  private readonly sender = process.env.SMS_SENDER_ID ?? "BIOSHOP";

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
 * WhatsApp Cloud API (option de croissance, à fort volume).
 * Prérequis : société vérifiée par Meta, numéro dédié, moyen de paiement
 * international, et les quatre templates approuvés dans la BONNE catégorie
 * (voir TEMPLATE_CATEGORY : envoyer du marketing sous « utility » expose à une
 * suspension du compte). Aucun BSP n'est obligatoire : l'onboarding direct
 * chez Meta suffit.
 */
class WhatsAppCloudProvider implements NotifyProvider {
  readonly name = "whatsapp_cloud";

  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  private readonly token = process.env.WHATSAPP_ACCESS_TOKEN ?? "";

  async send(opts: { phone: string; template: TemplateName; body: string; link?: string }) {
    if (!this.phoneNumberId || !this.token) {
      console.warn("[notify whatsapp] identifiants absents — message non envoyé");
      return { delivered: false };
    }
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
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
              name: opts.template, // le nom du template approuvé côté Meta
              language: { code: "fr" },
              components: [
                {
                  type: "body",
                  parameters: [{ type: "text", text: opts.body }],
                },
              ],
            },
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
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
