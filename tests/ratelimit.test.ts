import { beforeEach, describe, expect, it } from "vitest";
import { __resetRateLimits, clientIp, rateLimit } from "@/lib/ratelimit";

describe("limitation de débit", () => {
  beforeEach(() => __resetRateLimits());

  it("autorise jusqu'à la limite puis bloque", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", 5, 60).allowed).toBe(true);
    }
    const blocked = rateLimit("k", 5, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("les clés sont indépendantes (une IP ne bloque pas les autres)", () => {
    for (let i = 0; i < 5; i++) rateLimit("ip-a", 5, 60);
    expect(rateLimit("ip-a", 5, 60).allowed).toBe(false);
    expect(rateLimit("ip-b", 5, 60).allowed).toBe(true);
  });

  it("la fenêtre se réinitialise après expiration", () => {
    expect(rateLimit("court", 1, 0).allowed).toBe(true);
    // fenêtre de 0 s : le compteur suivant repart à zéro
    expect(rateLimit("court", 1, 0).allowed).toBe(true);
  });

  it("décompte correctement le restant", () => {
    expect(rateLimit("r", 3, 60).remaining).toBe(2);
    expect(rateLimit("r", 3, 60).remaining).toBe(1);
    expect(rateLimit("r", 3, 60).remaining).toBe(0);
  });
});

describe("clientIp derrière un reverse proxy", () => {
  it("prend la première IP de X-Forwarded-For", () => {
    const h = new Headers({ "x-forwarded-for": "41.202.1.5, 10.0.0.1" });
    expect(clientIp(h)).toBe("41.202.1.5");
  });
  it("retombe sur x-real-ip puis unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
