// Bascule des notifications sur WhatsApp Cloud (décision MIKE, 2026-08-28).
// Ces tests vérifient la FORME des appels à l'API Graph avec un fetch simulé :
// c'est elle que Meta accepte ou rejette, et un rejet d'OTP bloquerait toute
// inscription.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppCloudProvider } from "@/lib/notify";
import { getOtpProvider } from "@/lib/otp";

const ENV = {
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_ACCESS_TOKEN: "jeton-de-test",
};

function stubFetch(status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status });
    })
  );
  return calls;
}

describe("WhatsAppCloudProvider — forme des appels", () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(ENV)) delete process.env[k];
    delete process.env.WHATSAPP_TEMPLATE_PREFIX;
    delete process.env.WHATSAPP_TEMPLATE_LANG;
  });

  it("un template utilitaire envoie le texte ET le lien dans le paramètre", async () => {
    // Défaut corrigé : l'ancien fournisseur ignorait le lien — les alertes
    // de drop partaient sans l'URL de la boutique.
    const calls = stubFetch();
    const r = await new WhatsAppCloudProvider().send({
      phone: "237699112233",
      template: "drop_open",
      body: "C'est ouvert : Colis — premiers arrivés !",
      link: "https://tara.shop/nadia?src=drop",
    });
    expect(r.delivered).toBe(true);

    const payload = JSON.parse(String(calls[0].init.body));
    expect(payload.template.name).toBe("drop_open");
    expect(payload.template.components).toHaveLength(1); // pas de bouton
    const texte = payload.template.components[0].parameters[0].text;
    expect(texte).toContain("C'est ouvert");
    expect(texte).toContain("https://tara.shop/nadia?src=drop");
    // Meta refuse les retours à la ligne dans un paramètre
    expect(texte).not.toMatch(/[\n\t]/);
  });

  it("le template OTP envoie le code seul, avec le bouton « copier le code »", async () => {
    // Gabarit d'authentification imposé par Meta : paramètre court (le code)
    // et bouton obligatoire. La phrase complète serait rejetée (> 15 car.).
    const calls = stubFetch();
    const r = await new WhatsAppCloudProvider().send({
      phone: "237699112233",
      template: "otp",
      body: "Ton code Tara : 482913 (valable 10 minutes).",
      code: "482913",
    });
    expect(r.delivered).toBe(true);

    const { components } = JSON.parse(String(calls[0].init.body)).template;
    expect(components).toHaveLength(2);
    expect(components[0].parameters[0].text).toBe("482913"); // le code, pas la phrase
    expect(components[1]).toMatchObject({
      type: "button",
      sub_type: "url",
      index: "0",
    });
    expect(components[1].parameters[0].text).toBe("482913");
  });

  it("refuse d'envoyer un OTP sans code isolé, sans appeler l'API", async () => {
    const calls = stubFetch();
    const r = await new WhatsAppCloudProvider().send({
      phone: "237699112233",
      template: "otp",
      body: "Ton code Tara : 482913",
      // pas de code → l'appel serait rejeté par Meta de toute façon
    });
    expect(r.delivered).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("identifiants absents : échec propre, aucun appel réseau", async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    const calls = stubFetch();
    const r = await new WhatsAppCloudProvider().send({
      phone: "237699112233", template: "review_request", body: "x",
    });
    expect(r.delivered).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("un refus 4xx de Meta ne lève pas : delivered=false", async () => {
    // Un template non approuvé ne doit jamais casser une commande.
    stubFetch(400);
    const r = await new WhatsAppCloudProvider().send({
      phone: "237699112233", template: "review_request", body: "x",
    });
    expect(r.delivered).toBe(false);
  });

  it("une panne réseau ne lève pas : delivered=false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau"); }));
    const r = await new WhatsAppCloudProvider().send({
      phone: "237699112233", template: "new_video_tag", body: "x",
    });
    expect(r.delivered).toBe(false);
  });

  it("respecte le préfixe de template et la langue configurés", async () => {
    process.env.WHATSAPP_TEMPLATE_PREFIX = "tara_";
    process.env.WHATSAPP_TEMPLATE_LANG = "en";
    const calls = stubFetch();
    await new WhatsAppCloudProvider().send({
      phone: "237699112233", template: "review_request", body: "x",
    });
    const t = JSON.parse(String(calls[0].init.body)).template;
    expect(t.name).toBe("tara_review_request");
    expect(t.language.code).toBe("en");
  });
});

describe("OTP délégué au canal de notifications", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OTP_PROVIDER;
    delete process.env.NOTIFY_PROVIDER;
    for (const k of Object.keys(ENV)) delete process.env[k];
  });

  it("OTP_PROVIDER=whatsapp fait partir le code isolé vers l'API Graph", async () => {
    process.env.OTP_PROVIDER = "whatsapp";
    process.env.NOTIFY_PROVIDER = "whatsapp_cloud";
    Object.assign(process.env, ENV);
    const calls = stubFetch();

    await getOtpProvider().send("237699112233", "654321");

    expect(calls).toHaveLength(1);
    const { components } = JSON.parse(String(calls[0].init.body)).template;
    expect(components[0].parameters[0].text).toBe("654321");
    expect(components[1].type).toBe("button");
  });

  it("OTP_PROVIDER=sms délègue aussi ; mock reste le défaut", () => {
    process.env.OTP_PROVIDER = "sms";
    expect(getOtpProvider().name).toBe("sms");
    process.env.OTP_PROVIDER = "whatsapp";
    expect(getOtpProvider().name).toBe("whatsapp");
    delete process.env.OTP_PROVIDER;
    expect(getOtpProvider().name).toBe("mock");
  });
});
