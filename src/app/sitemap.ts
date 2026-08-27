import type { MetadataRoute } from "next";
import { listPublicShops } from "@/lib/public";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const shops = await listPublicShops();

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/cgu`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/mentions-legales`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/confidentialite`, changeFrequency: "yearly", priority: 0.3 },
    ...shops.map((s) => ({
      url: `${base}/${s.slug}`,
      lastModified: new Date(s.created_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
