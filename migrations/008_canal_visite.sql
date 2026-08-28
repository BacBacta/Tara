-- Lot 7 — canal d'arrivée d'une visite.
--
-- Pourquoi une colonne plutôt qu'un calcul à la lecture : la métrique la plus
-- importante du pilote est « cette boutique reçoit-elle encore des visites
-- TikTok ? ». Elle se lit à chaque affichage de l'écran Pilote ; la stocker
-- une fois à l'écriture évite de rejouer une détection sur toutes les visites.
--
-- Le canal est déduit du user_agent (le navigateur intégré de TikTok se
-- signale) et, à défaut, de la source du lien. Voir src/lib/channel.ts.
-- Les visites enregistrées AVANT cette migration ont channel = NULL : le
-- compteur ne vaut donc que pour les données collectées ensuite.
ALTER TABLE visits ADD COLUMN channel TEXT;

CREATE INDEX IF NOT EXISTS idx_visits_canal
  ON visits(shop_id, channel, created_at);
