import type { MetadataRoute } from "next";

// Les espaces privés ne sont pas indexables : back-office, espace vendeuse,
// onboarding, API, et tout le tunnel d'achat lié à une commande précise.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/app", "/api", "/creer", "/avis", "/desabo"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
