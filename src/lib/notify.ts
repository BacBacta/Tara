// Notifications sortantes (WhatsApp Business API via un BSP en production).
// V2 côté code : implémentation MOCK qui journalise — aucun envoi réel.
// Les messages template doivent être approuvés côté BSP avant mise en production.

export type TemplateName =
  | "new_video_tag"      // « tague les articles de ta nouvelle vidéo »
  | "review_request"     // « donne ton avis sur ta commande »
  | "shop_announcement"  // annonce d'une boutique à ses abonnées
  | "drop_open";         // ouverture d'un drop

export interface NotifyProvider {
  readonly name: string;
  send(opts: {
    phone: string;
    template: TemplateName;
    body: string;
    link?: string;
  }): Promise<{ delivered: boolean }>;
}

class MockNotifyProvider implements NotifyProvider {
  readonly name = "mock";
  async send(opts: { phone: string; template: TemplateName; body: string; link?: string }) {
    console.log(
      `[notify mock] ${opts.phone} · ${opts.template} · ${opts.body}${opts.link ? ` · ${opts.link}` : ""}`
    );
    return { delivered: true };
  }
}

export function getNotifyProvider(): NotifyProvider {
  // NOTIFY_PROVIDER=whatsapp_bsp → implémentation réelle au branchement
  return new MockNotifyProvider();
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
