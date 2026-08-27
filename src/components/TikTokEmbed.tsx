"use client";
// Embed TikTok « click-to-load » : rien n'est chargé depuis tiktok.com tant
// que l'acheteur ne le demande pas — indispensable pour le budget 3G.
import { useState } from "react";

export default function TikTokEmbed({
  videoId,
  label,
  caption,
}: {
  videoId: string;
  label: string;
  caption: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      {loaded ? (
        <iframe
          src={`https://www.tiktok.com/embed/v2/${videoId}`}
          className="h-[420px] w-full"
          allow="encrypted-media; fullscreen"
          loading="lazy"
          title="TikTok video"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="flex h-28 w-full items-center justify-center gap-2 bg-gradient-to-br from-[#3B4784] to-[#222848] text-sm font-bold text-white"
        >
          ▶ {label}
        </button>
      )}
      <p className="bg-sand px-3 py-2 text-[11px] text-gray-500">{caption}</p>
    </div>
  );
}
