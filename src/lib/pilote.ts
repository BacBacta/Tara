// Lot 7 — les quatre chiffres qui décident de la suite du pilote.
//
// Regroupement par semaine fait en JavaScript, pas en SQL : les fonctions de
// date diffèrent entre SQLite et PostgreSQL, et à l'échelle d'un pilote
// (10 vendeuses) le volume ne justifie pas de dupliquer la logique par
// dialecte. Le lot 4 a montré ce que coûte une divergence de format de date.
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb } from "./db";
import { isRevenue } from "./subscriptions";

/** Lundi de la semaine ISO d'une date, au format YYYY-MM-DD. */
export function debutSemaine(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"));
  const jour = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - jour);
  return d.toISOString().slice(0, 10);
}

function ilYA(jours: number): string {
  return new Date(Date.now() - jours * 86400_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

export interface SemaineCreation {
  semaine: string;
  boutiques: number;
}

/** 1) Boutiques créées, par semaine. */
export async function boutiquesParSemaine(
  dbi: Kysely<DB> = defaultDb
): Promise<SemaineCreation[]> {
  const rows = await dbi.selectFrom("shops").select(["created_at"]).execute();
  const parSemaine = new Map<string, number>();
  for (const r of rows) {
    const s = debutSemaine(r.created_at);
    parSemaine.set(s, (parSemaine.get(s) ?? 0) + 1);
  }
  return [...parSemaine.entries()]
    .map(([semaine, boutiques]) => ({ semaine, boutiques }))
    .sort((a, b) => b.semaine.localeCompare(a.semaine));
}

export interface BoutiqueVivante {
  id: string;
  slug: string;
  name: string;
  visitesTikTok7j: number;
  derniereVisiteTikTok: string | null;
}

/**
 * 2) LA métrique du projet : la boutique reçoit-elle encore des visites
 * venant de TikTok ? C'est le meilleur indice disponible que le lien est
 * toujours dans la bio de la vendeuse — et donc que Tara lui sert encore.
 */
export async function boutiquesVivantes(
  dbi: Kysely<DB> = defaultDb
): Promise<BoutiqueVivante[]> {
  const shops = await dbi
    .selectFrom("shops")
    .select(["id", "slug", "name"])
    .where("suspended", "=", 0)
    .execute();

  const recentes = await dbi
    .selectFrom("visits")
    .select(["shop_id", "created_at"])
    .where("channel", "=", "tiktok")
    .where("created_at", ">", ilYA(7))
    .execute();

  const toutes = await dbi
    .selectFrom("visits")
    .select(["shop_id", "created_at"])
    .where("channel", "=", "tiktok")
    .execute();

  const compte = new Map<string, number>();
  for (const v of recentes) compte.set(v.shop_id, (compte.get(v.shop_id) ?? 0) + 1);
  const derniere = new Map<string, string>();
  for (const v of toutes) {
    const cur = derniere.get(v.shop_id);
    if (!cur || v.created_at > cur) derniere.set(v.shop_id, v.created_at);
  }

  return shops
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      visitesTikTok7j: compte.get(s.id) ?? 0,
      derniereVisiteTikTok: derniere.get(s.id) ?? null,
    }))
    .sort((a, b) => b.visitesTikTok7j - a.visitesTikTok7j);
}

export interface BoutiqueCommandes {
  slug: string;
  name: string;
  creeLe: string;
  commandes: number;
  parSemaine: { semaine: string; commandes: number }[];
  delaiPremiereCommandeJours: number | null;
}

/** 3) Commandes par boutique et par semaine, et délai avant la première. */
export async function commandesParBoutique(
  dbi: Kysely<DB> = defaultDb
): Promise<BoutiqueCommandes[]> {
  const shops = await dbi
    .selectFrom("shops")
    .select(["id", "slug", "name", "created_at"])
    .execute();
  const orders = await dbi
    .selectFrom("orders")
    .select(["shop_id", "created_at"])
    .execute();

  const parBoutique = new Map<string, string[]>();
  for (const o of orders) {
    const l = parBoutique.get(o.shop_id) ?? [];
    l.push(o.created_at);
    parBoutique.set(o.shop_id, l);
  }

  return shops
    .map((s) => {
      const dates = (parBoutique.get(s.id) ?? []).sort();
      const semaines = new Map<string, number>();
      for (const d of dates) {
        const w = debutSemaine(d);
        semaines.set(w, (semaines.get(w) ?? 0) + 1);
      }
      let delai: number | null = null;
      if (dates.length > 0) {
        const creation = new Date(s.created_at.replace(" ", "T") + "Z").getTime();
        const premiere = new Date(dates[0].replace(" ", "T") + "Z").getTime();
        // Une commande antérieure à la création (jeu de démonstration) ne
        // doit pas produire un délai négatif.
        delai = Math.max(0, Math.round((premiere - creation) / 86400_000));
      }
      return {
        slug: s.slug,
        name: s.name,
        creeLe: s.created_at.slice(0, 10),
        commandes: dates.length,
        parSemaine: [...semaines.entries()]
          .map(([semaine, commandes]) => ({ semaine, commandes }))
          .sort((a, b) => b.semaine.localeCompare(a.semaine)),
        delaiPremiereCommandeJours: delai,
      };
    })
    .sort((a, b) => b.commandes - a.commandes);
}

export interface Renouvellement {
  boutiquesPayantes: number;
  boutiquesRenouvelees: number;
  boutiquesOffertesSeulement: number;
}

/**
 * 4) Abonnements PAYÉS au deuxième mois. Une période offerte ne compte pas :
 * la question du pilote n'est pas « combien de boutiques sont actives » mais
 * « combien ont sorti 3 000 F une deuxième fois ».
 */
export async function renouvellements(
  dbi: Kysely<DB> = defaultDb
): Promise<Renouvellement> {
  const subs = await dbi
    .selectFrom("subscriptions")
    .select(["shop_id", "origin"])
    .execute();

  const payantes = new Map<string, number>();
  const offertes = new Set<string>();
  for (const s of subs) {
    if (isRevenue(s.origin)) {
      payantes.set(s.shop_id, (payantes.get(s.shop_id) ?? 0) + 1);
    } else {
      offertes.add(s.shop_id);
    }
  }
  for (const id of payantes.keys()) offertes.delete(id);

  return {
    boutiquesPayantes: payantes.size,
    boutiquesRenouvelees: [...payantes.values()].filter((n) => n >= 2).length,
    boutiquesOffertesSeulement: offertes.size,
  };
}

/**
 * Garde-fou d'honnêteté : les user agents réellement observés. La détection
 * du canal est une heuristique ; ce tableau permet de la confronter aux
 * vraies visites et de corriger la liste de marqueurs si TikTok change son
 * navigateur.
 */
export async function agentsObserves(
  dbi: Kysely<DB> = defaultDb,
  limite = 12
): Promise<{ agent: string; canal: string; source: string; visites: number }[]> {
  const rows = await dbi
    .selectFrom("visits")
    .select(["user_agent", "channel", "source"])
    .where("created_at", ">", ilYA(30))
    .execute();

  const compte = new Map<
    string,
    { agent: string; canal: string; source: string; visites: number }
  >();
  for (const r of rows) {
    // Le user agent est affiché ENTIER (la colonne en stocke 250 caractères).
    // Il était coupé à 90 : or les marqueurs d'un navigateur intégré —
    // « BytedanceWebview », « musical_ly » — arrivent à la FIN de la chaîne.
    // Le tableau censé vérifier l'heuristique effaçait donc sa propre preuve.
    const agent = r.user_agent ?? "(aucun)";
    const source = r.source ?? "direct";
    const cle = `${agent}|${r.channel ?? "?"}|${source}`;
    const cur = compte.get(cle) ?? {
      agent,
      canal: r.channel ?? "(avant lot 7)",
      source,
      visites: 0,
    };
    cur.visites++;
    compte.set(cle, cur);
  }
  return [...compte.values()].sort((a, b) => b.visites - a.visites).slice(0, limite);
}
