-- Paiements d'abonnement (distincts des paiements de commandes).
CREATE TABLE IF NOT EXISTS sub_payments (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  provider TEXT NOT NULL,
  provider_ref TEXT NOT NULL UNIQUE,
  operator TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed | expired
  raw_webhook_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subpay_sub ON sub_payments(subscription_id);
