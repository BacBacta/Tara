// Seed réaliste : 2 boutiques de démo, articles, variantes, commandes, visites.
import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// GARDE-FOU : ce script fait un DELETE sur toutes les tables. Le lancer par
// mégarde sur la base de production effacerait boutiques, commandes et
// abonnements. Il refuse donc de tourner ailleurs qu'en développement.
if (process.env.NODE_ENV === "production") {
  console.error("Refus : db:seed efface toutes les tables et NODE_ENV=production.");
  process.exit(1);
}
if (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refus : db:seed vise une base PostgreSQL.");
  console.error("Ce script est réservé au développement local sur SQLite.");
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const db = new Database(url.replace(/^file:/, ""));
db.pragma("foreign_keys = ON");

const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// reset dev
// ordre inverse des dépendances (clés étrangères actives)
const TABLES = [
  "drop_alerts", "drop_products", "drops",
  "announcements", "followers", "reviews",
  "video_products", "videos", "external_identities", "webhook_events",
  "visits", "sub_payments", "payments", "subscriptions", "orders",
  "variants", "product_media", "products",
  "shops", "otp_codes", "sellers", "audit_log", "admin_users",
];
for (const t of TABLES) db.exec(`DELETE FROM ${t}`);

const ins = (table, obj) => {
  const keys = Object.keys(obj);
  db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`)
    .run(...keys.map((k) => obj[k]));
};

// vendeuses
const nadiaId = id(), kevinId = id();
ins("sellers", { id: nadiaId, phone: "237691882210", name: "Nadia T.", lang: "fr" });
ins("sellers", { id: kevinId, phone: "237677554433", name: "Kevin M.", lang: "en" });

const shopNadia = id(), shopKevin = id();
ins("shops", { id: shopNadia, seller_id: nadiaId, slug: "nadia-friperie-237",
  name: "Nadia Friperie 237", city: "Douala", momo_enabled: 1, plan: "paid",
  plan_expires_at: daysAgo(-30),
  // Mode direct : le cas d'une vraie vendeuse sans contrat agrégateur.
  payment_mode: "direct", momo_number: "237691882210", momo_operator: "mtn" });
ins("shops", { id: shopKevin, seller_id: kevinId, slug: "kev-sneakers",
  name: "Kev Sneakers Store", city: "Yaoundé", momo_enabled: 1, plan: "free",
  plan_expires_at: null,
  // Mode agrégateur : garde le parcours passerelle démontrable.
  payment_mode: "agregateur", momo_number: null, momo_operator: "orange" });

const products = [
  [shopNadia, "Robe wax cintrée — tissu Vlisco", 8500,
   "Friperie triée AA, comme neuve. Coupe cintrée, tissu wax épais.",
   "https://www.tiktok.com/@nadia_friperie/video/7211111111111111111",
   [["Taille","S"],["Taille","M"],["Taille","L"]]],
  [shopNadia, "Sneakers T.42 (neuf)", 15000, "Jamais portées, boîte d'origine.",
   "https://www.tiktok.com/@nadia_friperie/video/7222222222222222222", [["Pointure","42"]]],
  [shopNadia, "Sac cuir (occasion AA)", 6000, "Cuir véritable, fermeture impeccable.", null, []],
  [shopNadia, "Veste en jean oversize", 7500, "Style années 90, unisexe.", null,
   [["Taille","M"],["Taille","L"]]],
  [shopKevin, "Air classic — Black/White", 22000, "Grade A. DM for more colors.",
   "https://www.tiktok.com/@kevsneakers/video/7233333333333333333",
   [["Size","41"],["Size","42"],["Size","43"]]],
  [shopKevin, "Slides confort", 5500, "Daily wear, très solides.", null, [["Size","42"]]],
];

const prodIds = [];
// Photos de démonstration : générées, jamais versionnées. Sans elles, les
// boutiques de démo afficheraient des images cassées — pire qu'un dégradé.
const demoPhotos = [];
products.forEach(([shop, name, price, desc, video, variants], i) => {
  const pid = id();
  prodIds.push({ pid, shop, price });
  ins("products", { id: pid, shop_id: shop, name, price_fcfa: price,
    description: desc, video_url: video, position: i });
  ins("product_media", { id: id(), product_id: pid, url_webp: `/demo/p${i}.webp`, position: 0 });
  demoPhotos.push({ index: i, name });
  for (const [label, value] of variants) ins("variants", { id: id(), product_id: pid, label, value });
});

// commandes de démo
let n = 1000;
const mkOrder = (p, status, src, days) => {
  const oid = `B-${n++}`;
  ins("orders", { id: oid, shop_id: p.shop, product_id: p.pid, variant: null,
    qty: 1, amount_fcfa: p.price, buyer_phone: "237699001122", source: src,
    status, created_at: daysAgo(days) });
  if (status === "paid" || status === "delivered") {
    ins("payments", { id: id(), order_id: oid, provider: "mock",
      provider_ref: `mock_${oid}`, operator: "mtn", amount: p.price,
      status: "success", raw_webhook_json: null });
  }
};
mkOrder(prodIds[0], "paid", "v:7211111111111111111", 0);
mkOrder(prodIds[0], "delivered", "v:7211111111111111111", 2);
mkOrder(prodIds[1], "to_deliver", "v:7222222222222222222", 1);
mkOrder(prodIds[2], "initiated", "src:whatsapp", 0);

// visites de démo
for (let i = 0; i < 40; i++) {
  ins("visits", { id: id(), shop_id: shopNadia,
    product_id: i % 3 === 0 ? prodIds[0].pid : null,
    source: i % 2 === 0 ? "v:7211111111111111111" : "src:bio",
    user_agent: "seed", created_at: daysAgo(i % 7) });
}

const salt = randomBytes(16).toString("hex");
const adminHash = `${salt}:${scryptSync("tara2026", salt, 64).toString("hex")}`;
ins("admin_users", { id: id(), email: "admin@tara.shop",
  password_hash: adminHash, role: "admin" });

// --- photos de démonstration ---
const demoDir = join(process.cwd(), "public", "demo");
rmSync(demoDir, { recursive: true, force: true });
mkdirSync(demoDir, { recursive: true });

// Palettes bicolores inspirées du wax : fond + encre du motif.
const PALETTES = [
  ["#2B3A8F", "#F5A623"], // indigo / mango
  ["#0E7C66", "#F7F0DC"], // teck / coquille
  ["#B44E14", "#20242E"], // terre / encre
  ["#7C3AED", "#FBD38D"], // violet / sable doré
  ["#20242E", "#E9B44C"], // nuit / laiton
  ["#BE123C", "#F7E7CE"], // grenat / champagne
];

// Un « tissu » wax en SVG : cercles concentriques décalés, semis de points,
// peigne diagonal — puis un léger vignettage studio. Portrait 3:4, le format
// de la mode. Aucune dépendance : sharp rend le SVG.
function tissuWax(index) {
  const [fond, encre] = PALETTES[index % PALETTES.length];
  const cercles = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = 100 + c * 200 + (r % 2 ? 100 : 0);
      const cy = 100 + r * 200;
      cercles.push(`<g transform="translate(${cx},${cy})">
        <circle r="78" fill="none" stroke="${encre}" stroke-width="10" opacity="0.85"/>
        <circle r="52" fill="none" stroke="${encre}" stroke-width="5" opacity="0.55"/>
        <circle r="26" fill="${encre}" opacity="0.9"/>
        <circle r="8" fill="${fond}"/>
      </g>`);
    }
  }
  const points = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 6; c++)
      points.push(`<circle cx="${50 + c * 100}" cy="${50 + r * 100}" r="6" fill="${encre}" opacity="0.35"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <rect width="600" height="800" fill="${fond}"/>
    <g opacity="0.9">${points.join("")}</g>
    ${cercles.join("")}
    <g stroke="${encre}" stroke-width="3" opacity="0.25">
      ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 60 - 100}" y1="820" x2="${i * 60 + 240}" y2="-20"/>`).join("")}
    </g>
    <rect width="600" height="800" fill="url(#v)"/>
    <defs><radialGradient id="v" cx="50%" cy="42%" r="75%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.28"/>
    </radialGradient></defs>
  </svg>`;
}

for (const { index } of demoPhotos) {
  await sharp(Buffer.from(tissuWax(index))).webp({ quality: 82 }).toFile(join(demoDir, `p${index}.webp`));
}

console.log(`Seed OK — boutiques : nadia-friperie-237 et kev-sneakers (${demoPhotos.length} photos de démo générées)`);
