import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/admin";
import { isPaidActive, FREE_PRODUCT_LIMIT } from "@/lib/plan";

describe("mots de passe administrateur (scrypt)", () => {
  it("vérifie le bon mot de passe et rejette les autres", () => {
    const stored = hashPassword("tara2026");
    expect(verifyPassword("tara2026", stored)).toBe(true);
    expect(verifyPassword("tara2027", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });
  it("deux hachages du même mot de passe diffèrent (sel aléatoire)", () => {
    expect(hashPassword("abc")).not.toBe(hashPassword("abc"));
  });
  it("rejette un format stocké invalide", () => {
    expect(verifyPassword("abc", "pas-un-hash")).toBe(false);
    expect(verifyPassword("abc", "")).toBe(false);
  });
});

describe("plan payant actif (rétrogradation douce)", () => {
  const future = new Date(Date.now() + 86400_000).toISOString();
  const past = new Date(Date.now() - 86400_000).toISOString();

  it("actif avant expiration", () => {
    expect(isPaidActive({ plan: "paid", plan_expires_at: future })).toBe(true);
  });
  it("inactif après expiration — sans tâche planifiée", () => {
    expect(isPaidActive({ plan: "paid", plan_expires_at: past })).toBe(false);
  });
  it("inactif si plan gratuit ou date manquante", () => {
    expect(isPaidActive({ plan: "free", plan_expires_at: future })).toBe(false);
    expect(isPaidActive({ plan: "paid", plan_expires_at: null })).toBe(false);
  });
  it("la limite gratuite est bien de 10 articles", () => {
    expect(FREE_PRODUCT_LIMIT).toBe(10);
  });
});
