import type { Metadata } from "next";
import LegalPage, { H2, P, Ul, Todo } from "@/components/LegalPage";

// URL stable : TikTok l'exige au dépôt de la demande Login Kit. Ne pas
// renommer ce chemin une fois l'application déposée.
export const metadata: Metadata = {
  title: "Politique de confidentialité — Tara",
  description:
    "Quelles données Tara collecte, pourquoi, combien de temps, et comment les faire supprimer.",
};

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité" updated="27 août 2026">
      <P>
        Tara collecte le minimum de données nécessaires au fonctionnement du
        service. Rien n&apos;est vendu, loué, ni cédé à des tiers à des fins
        publicitaires.
      </P>

      <H2>Données des vendeuses</H2>
      <Ul>
        <li>
          <b>Numéro de téléphone</b> — sert à créer le compte, à le sécuriser par
          code à usage unique, et à recevoir les notifications de commande.
        </li>
        <li>
          <b>Boutique</b> — nom, ville, articles, photos, prix, numéro Mobile
          Money affiché aux acheteuses.
        </li>
        <li>
          <b>Compte TikTok</b> — si la vendeuse le connecte : identifiant public,
          nom d&apos;utilisateur, photo, nombre d&apos;abonnés, liste de vidéos.
          Les jetons d&apos;accès sont chiffrés. La vendeuse peut déconnecter son
          compte à tout moment, ce qui supprime ces jetons.
        </li>
      </Ul>

      <H2>Données des acheteuses</H2>
      <Ul>
        <li>
          <b>Numéro de téléphone</b> — enregistré lorsqu&apos;une commande ou un
          paiement est engagé, pour permettre à la vendeuse de répondre et pour
          rattacher la commande à son auteur.
        </li>
        <li>
          <b>Commandes</b> — article, quantité, montant, état d&apos;avancement.
        </li>
        <li>
          <b>Alertes et abonnements</b> — numéro de téléphone si l&apos;acheteuse
          demande à être prévenue d&apos;une nouveauté. Un lien de désinscription
          figure dans chaque message.
        </li>
        <li>
          <b>Avis</b> — note et commentaire laissés après une commande livrée.
        </li>
      </Ul>

      <H2>Données techniques</H2>
      <P>
        À chaque visite d&apos;une boutique, Tara enregistre la page consultée,
        la provenance du lien (TikTok, WhatsApp, autre) et le type de navigateur.
        Ces informations servent à montrer à la vendeuse ce qui fait venir ses
        clientes. Elles ne sont pas rattachées à une identité.
      </P>
      <P>
        Le site dépose un cookie de session pour maintenir la vendeuse connectée
        à son espace, et un cookie équivalent pour l&apos;administration. Aucun
        cookie publicitaire n&apos;est déposé par Tara. Si le pixel TikTok est
        activé par l&apos;éditeur, TikTok dépose ses propres traceurs de mesure
        d&apos;audience ; il est désactivé par défaut.
      </P>

      <H2>Ce que Tara ne collecte pas</H2>
      <P>
        Tara ne demande ni ne conserve <b>aucune donnée bancaire</b> : ni numéro
        de carte, ni code PIN Mobile Money, ni solde. Les paiements se font
        directement entre l&apos;acheteuse et la vendeuse, hors du site.
      </P>

      <H2>Durée de conservation</H2>
      <Ul>
        <li>compte vendeuse et boutique : tant que le compte existe ;</li>
        <li>commandes et paiements : 5 ans, à des fins comptables et de preuve ;</li>
        <li>codes à usage unique : quelques minutes, puis supprimés ;</li>
        <li>journaux de visite : 24 mois ;</li>
        <li>
          numéros inscrits aux alertes : jusqu&apos;à la désinscription, immédiate
          et sans justification.
        </li>
      </Ul>

      <H2>Vos droits</H2>
      <P>
        Conformément à la loi camerounaise n° 2010/012 du 21 décembre 2010
        relative à la cybersécurité et à la cybercriminalité, toute personne peut
        demander l&apos;accès à ses données, leur rectification ou leur
        suppression. La demande se fait à <Todo>adresse de contact</Todo> et
        reçoit une réponse sous 30 jours.
      </P>
      <P>
        La suppression d&apos;un compte vendeuse entraîne celle de sa boutique et
        de ses articles. Les commandes déjà passées sont conservées le temps
        légal, sans le nom ni le numéro de la vendeuse lorsque c&apos;est possible.
      </P>

      <H2>Sous-traitants</H2>
      <P>
        Tara fait appel à des prestataires techniques pour l&apos;hébergement,
        l&apos;envoi de SMS et, le cas échéant, l&apos;encaissement des
        abonnements. Ils n&apos;accèdent qu&apos;aux données nécessaires à leur
        mission. Liste et pays d&apos;hébergement :{" "}
        <Todo>prestataires retenus</Todo>.
      </P>

      <H2>Contact</H2>
      <P>
        Responsable du traitement : <Todo>raison sociale</Todo> —{" "}
        <Todo>adresse e-mail</Todo>.
      </P>
    </LegalPage>
  );
}
