import type { Metadata, Viewport } from "next";
// UNE police auto-hébergée par next/font, pour le titrage seulement :
// téléchargée à la compilation, servie depuis /_next/static, aucune requête
// vers Google à l'exécution, aucun JavaScript. Le corps de texte reste en
// police système (Roboto sur Android) — chaque Ko coûte des ventes en 3G.
import { Sora } from "next/font/google";
import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tara",
  description:
    "Ta boutique dans ta bio TikTok — commandes WhatsApp, paiement Mobile Money.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#33418F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={display.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
