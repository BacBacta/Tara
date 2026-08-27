"use client";
// Étape 2 : le lien tara.shop/{slug} se génère en direct pendant la frappe.
import { useState } from "react";

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
  const slug = slugify(name) || "ma-boutique";
  return (
    <>
      <label className="block text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
        Nom de la boutique
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Nadia Friperie 237"
          required
          minLength={3}
          maxLength={60}
          className="mt-1.5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base font-bold focus:border-indigo9 focus:outline-none"
        />
      </label>
      <p className="mt-2 flex items-center gap-1.5 break-all rounded-xl border-2 border-dashed border-indigo9 bg-white px-3.5 py-3 text-sm font-extrabold text-indigo9">
        🔗 {host}/{slug}
      </p>
    </>
  );
}
