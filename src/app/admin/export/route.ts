// Export CSV des boutiques (métriques globales) — réservé aux administrateurs.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, readAdmin } from "@/lib/admin";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const admin = readAdmin();
  if (!admin) return NextResponse.redirect(`${base}/admin/login`, 303);

  const shops = await db
    .selectFrom("shops")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .select([
      "shops.id", "shops.slug", "shops.name", "shops.city", "shops.plan",
      "shops.plan_expires_at", "shops.suspended", "shops.created_at",
      "sellers.phone as seller_phone",
    ])
    .orderBy("shops.created_at", "desc")
    .execute();

  const orders = await db
    .selectFrom("orders")
    .select(["shop_id", "status", db.fn.countAll<number>().as("n")])
    .groupBy(["shop_id", "status"])
    .execute();
  const products = await db
    .selectFrom("products")
    .select(["shop_id", db.fn.countAll<number>().as("n")])
    .where("removed", "=", 0)
    .groupBy("shop_id")
    .execute();
  const visits = await db
    .selectFrom("visits")
    .select(["shop_id", db.fn.countAll<number>().as("n")])
    .groupBy("shop_id")
    .execute();

  const paidByShop = new Map<string, number>();
  const allByShop = new Map<string, number>();
  for (const o of orders) {
    allByShop.set(o.shop_id, (allByShop.get(o.shop_id) ?? 0) + Number(o.n));
    if (["paid", "to_deliver", "delivered"].includes(o.status)) {
      paidByShop.set(o.shop_id, (paidByShop.get(o.shop_id) ?? 0) + Number(o.n));
    }
  }
  const prodByShop = new Map(products.map((p) => [p.shop_id, Number(p.n)]));
  const visitsByShop = new Map(visits.map((v) => [v.shop_id, Number(v.n)]));

  const header = [
    "slug", "nom", "ville", "telephone", "plan", "expire_le", "suspendue",
    "creee_le", "articles", "visites", "commandes", "commandes_payees",
  ];
  const rows = shops.map((s) =>
    [
      s.slug, s.name, s.city, s.seller_phone, s.plan, s.plan_expires_at ?? "",
      s.suspended === 1 ? "oui" : "non", s.created_at,
      prodByShop.get(s.id) ?? 0, visitsByShop.get(s.id) ?? 0,
      allByShop.get(s.id) ?? 0, paidByShop.get(s.id) ?? 0,
    ].map(csvCell).join(";")
  );
  const csv = "﻿" + [header.join(";"), ...rows].join("\n");

  await audit(admin.email, "export_csv", `${shops.length} boutiques`);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tara-boutiques.csv"`,
    },
  });
}
