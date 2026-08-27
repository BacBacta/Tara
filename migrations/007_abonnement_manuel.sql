-- Lot 2 — encaissement de l'abonnement à la main.
--
-- Sans compte marchand, la vendeuse envoie les 3 000 F sur le MoMo personnel
-- de MIKE, qui active ensuite l'abonnement depuis le back-office.
--
-- origin distingue les trois provenances d'une période :
--   'aggregator' : confirmée par le webhook de l'agrégateur (chemin V1) ;
--   'manual'     : payée, encaissée à la main, référence MoMo saisie ;
--   'offered'    : période offerte (vendeuse pilote) — NE COMPTE PAS
--                  comme revenu, et son montant est 0.
-- Sans cette distinction, les chiffres de revenu seraient faux dès le
-- premier mois du pilote.
ALTER TABLE subscriptions ADD COLUMN origin TEXT NOT NULL DEFAULT 'aggregator';
ALTER TABLE subscriptions ADD COLUMN payment_ref TEXT;
ALTER TABLE subscriptions ADD COLUMN note TEXT;
ALTER TABLE subscriptions ADD COLUMN activated_by TEXT;

-- Idempotence de l'activation manuelle : une même référence de paiement
-- MoMo ne peut pas créditer deux fois la même boutique (double clic,
-- double soumission du formulaire). Index partiel : les périodes sans
-- référence (offertes, agrégateur) ne sont pas contraintes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_shop_ref
  ON subscriptions(shop_id, payment_ref) WHERE payment_ref IS NOT NULL;
