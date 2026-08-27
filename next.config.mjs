/** @type {import('next').NextConfig} */

// En-têtes de sécurité. La CSP autorise TikTok (embed vidéo + pixel) et les
// data: URI (QR codes générés côté serveur), rien d'autre.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://analytics.tiktok.com https://www.tiktok.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://analytics.tiktok.com",
  "frame-src https://www.tiktok.com",
  "form-action 'self' https://wa.me",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
