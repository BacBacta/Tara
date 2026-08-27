// Canaux de notification : sélection du fournisseur et catégories de templates.
import { describe, expect, it } from "vitest";
import { getNotifyProvider, TEMPLATE_CATEGORY, type TemplateName } from "@/lib/notify";

describe("choix du canal de notification", () => {
  it("mock par défaut (aucun envoi réel en développement)", () => {
    delete process.env.NOTIFY_PROVIDER;
    expect(getNotifyProvider().name).toBe("mock");
  });
  it("sms = chemin de production par défaut", () => {
    process.env.NOTIFY_PROVIDER = "sms";
    expect(getNotifyProvider().name).toBe("sms");
    delete process.env.NOTIFY_PROVIDER;
  });
  it("whatsapp_cloud = option de croissance", () => {
    process.env.NOTIFY_PROVIDER = "whatsapp_cloud";
    expect(getNotifyProvider().name).toBe("whatsapp_cloud");
    delete process.env.NOTIFY_PROVIDER;
  });
  it("une valeur inconnue retombe sur mock plutôt que d'échouer", () => {
    process.env.NOTIFY_PROVIDER = "n_importe_quoi";
    expect(getNotifyProvider().name).toBe("mock");
    delete process.env.NOTIFY_PROVIDER;
  });
});

describe("catégories de templates (conformité Meta)", () => {
  it("chaque gabarit a une catégorie explicite", () => {
    const names: TemplateName[] = [
      "otp", "new_video_tag", "review_request", "shop_announcement", "drop_open",
    ];
    for (const n of names) expect(TEMPLATE_CATEGORY[n]).toBeTruthy();
  });
  it("les envois en masse sont bien classés marketing", () => {
    // se tromper ici expose à une suspension du compte WhatsApp
    expect(TEMPLATE_CATEGORY.shop_announcement).toBe("marketing");
    expect(TEMPLATE_CATEGORY.drop_open).toBe("marketing");
  });
  it("les messages déclenchés par une action restent utility/authentication", () => {
    expect(TEMPLATE_CATEGORY.review_request).toBe("utility");
    expect(TEMPLATE_CATEGORY.new_video_tag).toBe("utility");
    expect(TEMPLATE_CATEGORY.otp).toBe("authentication");
  });
});
