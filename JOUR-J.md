# Jour J — ouvrir Tara à de vraies vendeuses

Tout ce que contient cette page a été **joué en répétition générale** le
28/08/2026, contre un vrai PostgreSQL et une base vide : de la création de la
première vendeuse jusqu'à l'avis déposé par l'acheteuse, en passant par
l'encaissement de l'abonnement et la suspension d'une boutique.

Les commandes ci-dessous sont celles qui ont réellement été exécutées.

---

## 1. Avant d'ouvrir — ce que le pré-vol exige

```bash
npm run db:migrate          # ré-exécutable, s'arrête au premier échec
node scripts/preflight.mjs  # sort en 1 et refuse tant qu'il reste un blocage
```

Le pré-vol refuse l'ouverture tant que l'un de ces points tient. Ils sont
**tous chez toi**, aucun n'est du code :

| Ce qu'il bloque | Ce qu'il faut faire |
|---|---|
| `NODE_ENV` ≠ `production` | régler l'environnement du service |
| `OTP_PROVIDER` / `NOTIFY_PROVIDER` à `mock` | brancher WhatsApp Cloud (ou la passerelle SMS) |
| `PAYMENT_MOCK_AUTOCONFIRM` non vide | vider la variable |
| `NEXT_PUBLIC_BASE_URL` sur localhost | mettre l'URL publique |
| `[À COMPLÉTER]` dans les pages légales | raison sociale, RCCM, siège, hébergeur, contact — **puis relecture par un juriste** |
| `TARA_MOMO_NUMBER` vide sans agrégateur | renseigner le portefeuille MoMo de Tara, sinon aucune vendeuse ne peut s'abonner |

Vérifie aussi, une fois le service démarré :

```bash
curl -s https://<ton-domaine>/api/sante     # {"ok":true}
```

---

## 2. Recruter une vendeuse (5 minutes, à faire pour chacune)

L'inscription publique passe par un code de confirmation. Tant que la
passerelle n'est pas branchée, tu crées les boutiques à la main :

```bash
node scripts/create-seller.mjs 6XXXXXXXX "Nom de la boutique" Douala fr
```

Le script affiche son lien et son numéro de connexion. **Envoie-lui les deux**
et dis-lui : *« va sur tara.shop/creer, entre ton numéro, tu recevras un code »*.

Ce qu'elle fait ensuite, seule, sur son téléphone — vérifié en répétition :

1. **Réglages** → son numéro Mobile Money et son opérateur.
   Tant que ce numéro est vide, **le bouton de paiement n'apparaît pas** sur sa
   boutique. C'est le réglage le plus important de tous.
2. **Articles** → ses premiers articles avec photo (trois tailles sont générées
   automatiquement : 800, 560 et 320 px).
3. **Partage** → elle copie son lien dans sa bio TikTok, ou épingle le texte
   tout prêt en commentaire.

---

## 3. Ce qui se passe quand une cliente achète

Séquence vérifiée de bout en bout, sans une ligne de JavaScript :

1. la cliente ouvre le lien depuis TikTok → la visite est comptée `tiktok` ;
2. elle commande → la commande part sur **WhatsApp** chez la vendeuse ;
3. elle paie en Mobile Money **directement à la vendeuse**, puis appuie sur
   « J'ai payé » ;
4. la vendeuse voit **« 1 paiement annoncé — à vérifier »** en haut de son
   tableau de bord. Elle regarde son portefeuille MoMo — **elle seule** constate
   l'argent — puis marque la commande payée, à livrer, livrée ;
5. sur l'écran **Commandes**, elle colle le numéro de sa cliente (elle l'a dans
   WhatsApp). C'est ce geste qui allume le bouton « Écrire à la cliente » **et**
   qui envoie le lien d'avis à la livraison ;
6. la cliente dépose son avis — lien à usage unique — et l'avis s'affiche sur
   la fiche article.

> Une annonce de paiement rejouée ne produit rien de plus (idempotence), et
> une transition interdite est refusée (`409`).

---

## 4. Encaisser un abonnement (3 000 F/mois)

Sans agrégateur, la vendeuse ne peut pas payer dans l'application. Son écran
**Tara illimité** lui donne le portefeuille MoMo de Tara, la référence à
indiquer (le nom de sa boutique) et un bouton pour te prévenir sur WhatsApp.

Quand l'argent est arrivé sur ton téléphone :

*Back-office → `/admin` → section Abonnements* : choisis la boutique, le nombre
de mois, **et la référence du versement MoMo**. La référence est obligatoire :
c'est elle qui empêche de créditer deux fois le même paiement — rejouée, elle
répond `err=duplicate` et n'ajoute aucun mois.

Un abonnement offert (`origin=offered`) n'entre pas dans le chiffre d'affaires.

---

## 5. Chaque semaine

- `/admin/pilote` — les quatre métriques du pilote, dont **« Navigateurs
  observés »** : à la première visite réelle depuis TikTok, vérifie qu'elle est
  bien classée `tiktok`. Si elle apparaît en « autre », la métrique la plus
  importante du pilote est fausse (question ouverte n° 5).
- `/admin/export` — le CSV de toutes les boutiques (articles, visites,
  commandes, commandes payées), dates au même format.
- `deploy/tara-backup.sh` — la sauvegarde. Elle a été **exécutée puis
  restaurée** contre un vrai PostgreSQL : elle refuse une archive de moins
  d'un kilo-octet.

---

## 6. Gestes d'urgence

| Situation | Geste | Effet vérifié |
|---|---|---|
| Boutique à couper | `/admin` → Suspendre | vitrine en **404**, commandes refusées |
| Remise en ligne | `/admin` → Réactiver | vitrine à nouveau en 200 |
| Avis diffamatoire | `/admin` → Masquer | invisible sur la boutique |
| Base en panne | `/api/sante` répond **503** | la sonde tombe, le service redémarre |

---

## 7. Ce que la répétition n'a pas pu couvrir

- **Le vrai navigateur TikTok** : le canal a été validé avec un *user agent*
  TikTok réaliste, jamais depuis un vrai téléphone (question n° 5).
- **Les envois réels** (WhatsApp ou SMS) : le fournisseur simulé journalise au
  lieu d'envoyer. Rien ne partira tant que les démarches Meta ne sont pas
  faites (question n° 9).
- **Les drops** : fonctionnalité de croissance, hors du chemin du premier jour.
- **La charge** : une seule vendeuse, une poignée de commandes.
