// Types Kysely du schéma (source de vérité SQL : /migrations/*.sql).
import type { Generated } from "kysely";

export interface SellersTable {
  id: string;
  phone: string;
  name: string;
  lang: string; // fr | en
  created_at: Generated<string>;
}

export interface ShopsTable {
  id: string;
  seller_id: string;
  slug: string;
  name: string;
  city: string;
  banner_color: Generated<string>;
  momo_enabled: Generated<number>; // 0 | 1
  plan: Generated<string>; // free | paid
  plan_expires_at: string | null;
  suspended: Generated<number>;
  created_at: Generated<string>;
}

export interface ProductsTable {
  id: string;
  shop_id: string;
  name: string;
  price_fcfa: number;
  description: Generated<string>;
  stock_state: Generated<string>; // in_stock | low | out
  video_url: string | null;
  position: Generated<number>;
  removed: Generated<number>;
  created_at: Generated<string>;
}

export interface ProductMediaTable {
  id: string;
  product_id: string;
  url_webp: string;
  position: Generated<number>;
}

export interface VariantsTable {
  id: string;
  product_id: string;
  label: string;
  value: string;
}

export interface OrdersTable {
  id: string; // B-XXXX
  shop_id: string;
  product_id: string;
  variant: string | null;
  qty: Generated<number>;
  amount_fcfa: number;
  buyer_phone: string | null;
  source: string | null;
  status: Generated<string>;
  created_at: Generated<string>;
}

export interface PaymentsTable {
  id: string;
  order_id: string;
  provider: string;
  provider_ref: string;
  operator: string | null;
  amount: number;
  fees: Generated<number>;
  status: Generated<string>;
  raw_webhook_json: string | null;
  created_at: Generated<string>;
}

export interface SubscriptionsTable {
  id: string;
  shop_id: string;
  plan: string;
  amount: number;
  period_start: string;
  period_end: string;
  payment_id: string | null;
  created_at: Generated<string>;
}

export interface VisitsTable {
  id: string;
  shop_id: string;
  product_id: string | null;
  source: string | null;
  user_agent: string | null;
  created_at: Generated<string>;
}

export interface AdminUsersTable {
  id: string;
  email: string;
  password_hash: string;
  role: Generated<string>;
}

export interface AuditLogTable {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: Generated<string>;
}

export interface OtpCodesTable {
  id: string;
  phone: string;
  code_hash: string;
  expires_at: string;
  attempts: Generated<number>;
  consumed: Generated<number>;
  created_at: Generated<string>;
}

export interface DB {
  otp_codes: OtpCodesTable;
  sellers: SellersTable;
  shops: ShopsTable;
  products: ProductsTable;
  product_media: ProductMediaTable;
  variants: VariantsTable;
  orders: OrdersTable;
  payments: PaymentsTable;
  subscriptions: SubscriptionsTable;
  visits: VisitsTable;
  admin_users: AdminUsersTable;
  audit_log: AuditLogTable;
}
