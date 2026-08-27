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
  payment_mode: Generated<string>; // direct | agregateur
  momo_number: string | null; // portefeuille MoMo de la VENDEUSE (mode direct)
  momo_operator: string | null; // mtn | orange
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
  stock_qty: number | null; // NULL = illimité
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
  origin: Generated<string>; // aggregator | manual | offered
  payment_ref: string | null; // référence MoMo saisie à la main
  note: string | null;
  activated_by: string | null; // e-mail de l'admin qui a activé
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

export interface SubPaymentsTable {
  id: string;
  subscription_id: string;
  provider: string;
  provider_ref: string;
  operator: string | null;
  amount: number;
  status: Generated<string>;
  raw_webhook_json: string | null;
  created_at: Generated<string>;
}


// ===== V2 =====
export interface ExternalIdentitiesTable {
  id: string;
  seller_id: string;
  provider: string;
  open_id: string;
  username: string | null;
  avatar_url: string | null;
  follower_count: Generated<number>;
  likes_count: Generated<number>;
  access_token_enc: string;
  refresh_token_enc: string | null;
  scopes: Generated<string>;
  status: Generated<string>;
  connected_at: Generated<string>;
  synced_at: string | null;
}

export interface VideosTable {
  id: string;
  shop_id: string;
  tiktok_video_id: string;
  title: Generated<string>;
  cover_url: string | null;
  views: Generated<number>;
  likes: Generated<number>;
  published_at: string | null;
  synced_at: Generated<string>;
}

export interface VideoProductsTable {
  video_id: string;
  product_id: string;
}

export interface ReviewsTable {
  id: string;
  order_id: string;
  shop_id: string;
  product_id: string;
  token: string;
  rating: number | null;
  comment: string | null;
  status: Generated<string>;
  reply: string | null;
  created_at: Generated<string>;
  submitted_at: string | null;
}

export interface FollowersTable {
  id: string;
  shop_id: string;
  phone: string;
  opted_in_at: Generated<string>;
  opted_out_at: string | null;
}

export interface AnnouncementsTable {
  id: string;
  shop_id: string;
  body: string;
  sent_at: Generated<string>;
  sent_count: Generated<number>;
  open_est: Generated<number>;
  visits: Generated<number>;
  orders: Generated<number>;
}

export interface DropsTable {
  id: string;
  shop_id: string;
  title: string;
  opens_at: string;
  status: Generated<string>;
  created_at: Generated<string>;
}

export interface DropProductsTable {
  drop_id: string;
  product_id: string;
}

export interface DropAlertsTable {
  id: string;
  drop_id: string;
  phone: string;
  created_at: Generated<string>;
}

export interface WebhookEventsTable {
  id: string;
  provider: string;
  type: string;
  dedup_key: string;
  payload: string;
  received_at: Generated<string>;
  processed_at: string | null;
}

export interface DB {
  external_identities: ExternalIdentitiesTable;
  videos: VideosTable;
  video_products: VideoProductsTable;
  reviews: ReviewsTable;
  followers: FollowersTable;
  announcements: AnnouncementsTable;
  drops: DropsTable;
  drop_products: DropProductsTable;
  drop_alerts: DropAlertsTable;
  webhook_events: WebhookEventsTable;
  otp_codes: OtpCodesTable;
  sub_payments: SubPaymentsTable;
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
