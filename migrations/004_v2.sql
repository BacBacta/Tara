-- V2 — intégrations TikTok officielles, avis, suivi de boutique, drops.

-- G1 : identités externes (TikTok Login Kit). Jetons chiffrés au repos.
CREATE TABLE IF NOT EXISTS external_identities (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id),
  provider TEXT NOT NULL,              -- tiktok
  open_id TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  access_token_enc TEXT NOT NULL,      -- chiffré AES-256-GCM
  refresh_token_enc TEXT,
  scopes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active', -- active | revoked | expired
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  UNIQUE (provider, open_id)
);
CREATE INDEX IF NOT EXISTS idx_ext_seller ON external_identities(seller_id, provider, status);

-- G2 : vidéos synchronisées (Display API)
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  tiktok_video_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (shop_id, tiktok_video_id)
);
CREATE INDEX IF NOT EXISTS idx_videos_shop ON videos(shop_id, published_at);

-- G2 : tag vidéo ↔ article
CREATE TABLE IF NOT EXISTS video_products (
  video_id TEXT NOT NULL REFERENCES videos(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  PRIMARY KEY (video_id, product_id)
);

-- G5 : avis vérifiés (1 par commande livrée)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  shop_id TEXT NOT NULL REFERENCES shops(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  token TEXT NOT NULL UNIQUE,          -- lien d'avis à usage unique
  rating INTEGER,                      -- 1..5, NULL tant que non déposé
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | published | hidden
  reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);

-- G6 : abonnées de la boutique (opt-in explicite)
CREATE TABLE IF NOT EXISTS followers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  phone TEXT NOT NULL,
  opted_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  opted_out_at TEXT,
  UNIQUE (shop_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_followers_shop ON followers(shop_id, opted_out_at);

-- G6 : annonces (quota 4/mois par boutique)
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_count INTEGER NOT NULL DEFAULT 0,
  open_est INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ann_shop ON announcements(shop_id, sent_at);

-- G7 : drops (ventes programmées)
CREATE TABLE IF NOT EXISTS drops (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  title TEXT NOT NULL,
  opens_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | open | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS drop_products (
  drop_id TEXT NOT NULL REFERENCES drops(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  PRIMARY KEY (drop_id, product_id)
);
CREATE TABLE IF NOT EXISTS drop_alerts (
  id TEXT PRIMARY KEY,
  drop_id TEXT NOT NULL REFERENCES drops(id),
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (drop_id, phone)
);

-- G3 : événements webhook (idempotence + rejeu)
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,              -- tiktok
  type TEXT NOT NULL,
  dedup_key TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wh_events ON webhook_events(provider, type, received_at);
