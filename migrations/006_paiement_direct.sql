-- Lot 1 — paiement direct vendeuse.
--
-- Mode de paiement de la boutique :
--   'direct'     : l'acheteuse envoie l'argent au téléphone de la vendeuse,
--                  elle-même. Ne dépend d'aucun contrat agrégateur.
--   'agregateur' : passerelle Mobile Money (parcours existant).
--
-- 'direct' est le défaut : c'est le seul mode qui fonctionne sans contrat.
-- Rappel R1 : Tara n'encaisse jamais. Ces colonnes décrivent le portefeuille
-- de la VENDEUSE, jamais un compte détenu par Tara.
ALTER TABLE shops ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE shops ADD COLUMN momo_number TEXT;
ALTER TABLE shops ADD COLUMN momo_operator TEXT;
