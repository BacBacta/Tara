// create-seller.mjs — inscription manuelle des vendeuses pilotes, tant que
// la passerelle SMS n'est pas sous contrat.
//
// Les aides du script DUPLIQUENT la logique TypeScript (un .mjs ne peut pas
// l'importer sans build). Les tests de parité ci-dessous font échouer la
// suite si les deux copies divergent : c'est ce qui rend la duplication
// tolérable.
import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/format";
import { RESERVED_SLUGS } from "@/lib/reserved";
import { phoneCm } from "@/lib/payments";
import {
  normalizePhoneCm,
  RESERVED_SLUGS_MJS,
  slugCandidates,
  slugifyMjs,
} from "../scripts/seller-utils.mjs";

describe("parité avec la source TypeScript", () => {
  it("slugifyMjs produit exactement les mêmes slugs que slugify", () => {
    const cas = [
      "Nadia Friperie 237",
      "Chez Bébé — Vêtements & Co",
      "ÀÉÎÕÜ çŒ",
      "   espaces   partout   ",
      "!!!",
      "Kev' Sneakers (Douala)",
    ];
    for (const c of cas) expect(slugifyMjs(c)).toBe(slugify(c));
  });

  it("RESERVED_SLUGS_MJS est identique à RESERVED_SLUGS", () => {
    expect([...RESERVED_SLUGS_MJS].sort()).toEqual([...RESERVED_SLUGS].sort());
  });

  it("normalizePhoneCm accepte et rejette comme phoneCm (Zod)", () => {
    const cas = ["677123456", "237677123456", "6 77 12 34 56", "555123456", "67712345", "abc"];
    for (const c of cas) {
      const zod = phoneCm.safeParse(c);
      const mjs = normalizePhoneCm(c);
      expect(mjs !== null).toBe(zod.success);
      if (zod.success) expect(mjs).toBe(zod.data);
    }
  });
});

describe("candidats de slug", () => {
  it("suit l'ordre de uniqueSlug : base, puis base-2, base-3…", () => {
    const c = slugCandidates("Nadia Friperie");
    expect(c[0]).toBe("nadia-friperie");
    expect(c[1]).toBe("nadia-friperie-2");
    expect(c[2]).toBe("nadia-friperie-3");
  });

  it("décale un nom réservé, comme uniqueSlug", () => {
    const c = slugCandidates("Admin");
    expect(c[0]).toBe("admin-boutique");
    expect(c).not.toContain("admin");
  });

  it("un nom sans caractère utilisable retombe sur ma-boutique", () => {
    expect(slugCandidates("!!!")[0]).toBe("ma-boutique");
  });

  it("aucun candidat n'est un slug réservé", () => {
    for (const nom of ["Admin", "Creer", "CGU", "Api"]) {
      for (const c of slugCandidates(nom)) {
        expect(RESERVED_SLUGS_MJS.has(c)).toBe(false);
      }
    }
  });
});
