"use client";
// Étape 2 : le lien tara.shop/{slug} s'écrit en direct pendant la frappe.
// Confort strictement optionnel (R2) : sans JavaScript le champ reste
// saisissable et l'aperçu montre l'exemple — il n'est jamais bloquant.
import { useState } from "react";
import { inputCls, labelCls } from "./ob-styles";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NameSlugField({ host }: { host: string }) {
  const [name, setName] = useState("");
  const slug = slugify(name);
  return (
    <>
      <label className={labelCls}>
        Nom de la boutique
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Nadia Friperie 237"
          required
          minLength={3}
          maxLength={60}
          className={inputCls}
        />
      </label>

      {/* L'aperçu du lien : c'est la décision la plus durable de l'écran. */}
      <div className="mt-3 rounded-2xl border border-dashed border-indigo9/35 bg-indigo9/[0.05] px-4 py-3.5">
        <span className="text-[10.5px] font-extrabold uppercase tracking-micro text-indigo9/70">
          Ton lien
        </span>
        <p className="mt-1 break-all font-display text-[15px] leading-snug tracking-tight text-indigo9">
          {host}/<span className={slug ? "" : "text-indigo9/40"}>{slug || "ma-boutique"}</span>
        </p>
      </div>
    </>
  );
}
