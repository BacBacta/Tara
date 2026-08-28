// QR code de la boutique en PNG téléchargeable.
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const png = await QRCode.toBuffer(`${base}/${shop.slug}`, {
    margin: 2,
    width: 900,
  });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="tara-${shop.slug}.png"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
