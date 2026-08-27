-- Tara — schéma V1 (SQLite dev / compatible PostgreSQL prod).
-- Les champs à valeurs contraintes (plan, status…) sont des TEXT validés par Zod.

CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,           -- E.164 sans +, ex: 2376XXXXXXXX
  name TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'fr',      -- fr | en
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  banner_color TEXT NOT NULL DEFAULT '#33418F',
  momo_enabled INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'free',    -- free | paid
  plan_expires_at TEXT,
  suspended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  price_fcfa INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stock_state TEXT NOT NULL DEFAULT 'in_stock', -- in_stock | low | out
  video_url TEXT,                        -- URL TikTok (embed oEmbed)
  position INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_media (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  url_webp TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  label TEXT NOT NULL,                  -- ex: Taille
  value TEXT NOT NULL                   -- ex: M
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                  -- format court B-XXXX
  shop_id TEXT NOT NULL REFERENCES shops(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  variant TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  amount_fcfa INTEGER NOT NULL,
  buyer_phone TEXT,
  source TEXT,                          -- v:{video} | src:{canal} | direct
  status TEXT NOT NULL DEFAULT 'initiated',
  -- initiated | pending_payment | paid | to_deliver | delivered | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,               -- mock | simiz | camerpay
  provider_ref TEXT NOT NULL UNIQUE,    -- clé d'idempotence des webhooks
  operator TEXT,                        -- mtn | orange
  amount INTEGER NOT NULL,
  fees INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initiated',
  -- initiated | pending | success | failed | expired
  raw_webhook_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  plan TEXT NOT NULL,                   -- paid
  amount INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  payment_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  product_id TEXT,
  source TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id, removed, position);
CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_visits_shop ON visits(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
