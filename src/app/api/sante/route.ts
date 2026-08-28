// GET /api/sante — sonde de disponibilité.
// Utilisée par scripts/deploy.sh après redémarrage et par la surveillance
// externe. Ne renvoie AUCUN détail exploitable : un attaquant n'apprend rien
// de plus que « le site répond » ou « le site ne répond pas ».
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const entetes = { "cache-control": "no-store" };
  try {
    // Une requête triviale, mais qui traverse réellement la base : un
    // processus vivant dont la base est tombée n'est PAS en bonne santé.
    await db.selectFrom("shops").select("id").limit(1).execute();
    return NextResponse.json({ ok: true }, { status: 200, headers: entetes });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: entetes });
  }
}
