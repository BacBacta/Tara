import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/format";
import { canTransition, genOrderId } from "@/lib/orders";
import { orderMessage, tiktokVideoId } from "@/lib/whatsapp";

describe("slugify", () => {
  it("minuscules, accents retirés, tirets", () => {
    expect(slugify("Nadia Friperie 237")).toBe("nadia-friperie-237");
    expect(slugify("  Bébé & Co !! ")).toBe("bebe-co");
    expect(slugify("Chaussures__à_Yaoundé")).toBe("chaussures-a-yaounde");
  });
  it("jamais de tiret en bord", () => {
    expect(slugify("---boutique---")).toBe("boutique");
  });
});

describe("machine à états des commandes", () => {
  it("transitions valides", () => {
    expect(canTransition("initiated", "paid")).toBe(true);
    expect(canTransition("paid", "delivered")).toBe(true);
    expect(canTransition("pending_payment", "paid")).toBe(true);
  });
  it("transitions interdites", () => {
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
    expect(canTransition("paid", "initiated")).toBe(false);
  });
});

describe("genOrderId", () => {
  it("format B-XXXX", () => {
    expect(genOrderId(() => 0)).toBe("B-1000");
    expect(genOrderId(() => 0.9999)).toMatch(/^B-\d{4}$/);
  });
});

describe("orderMessage", () => {
  it("contient produit, variante, prix et n° de commande (FR)", () => {
    const msg = orderMessage({
      productName: "Robe wax", variant: "M", qty: 2, priceLabel: "17 000 F",
      productUrl: "https://bioshop.cm/nadia/p/1", orderId: "B-1234", lang: "fr",
    });
    expect(msg).toContain("Robe wax (M) × 2");
    expect(msg).toContain("17 000 F");
    expect(msg).toContain("B-1234");
  });
  it("version EN", () => {
    const msg = orderMessage({
      productName: "Sneakers", qty: 1, priceLabel: "22 000 F",
      productUrl: "u", orderId: "B-1", lang: "en",
    });
    expect(msg).toContain("I want to order");
  });
});

describe("tiktokVideoId", () => {
  it("extrait l'id d'une URL vidéo", () => {
    expect(
      tiktokVideoId("https://www.tiktok.com/@nadia/video/7211111111111111111")
    ).toBe("7211111111111111111");
    expect(tiktokVideoId("https://tiktok.com/pas-une-video")).toBeNull();
  });
});
