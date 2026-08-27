import type { Metadata } from "next";
import LegalPage, { H2, P, Ul, Todo } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Tara",
  description: "Ce que Tara fait, et surtout ce que Tara ne fait pas.",
};

export default function Cgu() {
  return (
    <LegalPage title="Conditions générales d'utilisation" updated="27 août 2026">
      <H2>1. Ce qu&apos;est Tara</H2>
      <P>
        Tara est un outil qui permet à une vendeuse de présenter ses articles sur
        une page web, et à une acheteuse de la contacter pour commander. Le lien
        de cette page est destiné à être placé dans une biographie TikTok ou
        partagé sur WhatsApp.
      </P>

      <H2>2. Tara n&apos;est pas partie à la vente</H2>
      <P>
        Le contrat de vente se conclut <b>entre l&apos;acheteuse et la
        vendeuse</b>. Tara n&apos;est ni vendeur, ni mandataire, ni intermédiaire
        de paiement. Tara ne détient, ne transporte et ne garantit aucun bien.
      </P>
      <P>
        En conséquence, Tara ne promet ni ne garantit :
      </P>
      <Ul>
        <li>la livraison de la commande ;</li>
        <li>la conformité, la qualité ou l&apos;authenticité des articles ;</li>
        <li>le remboursement d&apos;une somme versée à une vendeuse ;</li>
        <li>la bonne fin d&apos;un paiement Mobile Money.</li>
      </Ul>
      <P>
        Tout litige relatif à une commande se règle directement entre
        l&apos;acheteuse et la vendeuse.
      </P>

      <H2>3. Le paiement</H2>
      <P>
        <b>Tara ne touche jamais l&apos;argent des ventes.</b> L&apos;acheteuse
        envoie le montant directement au portefeuille Mobile Money de la
        vendeuse, depuis son propre téléphone. Aucune somme ne transite par un
        compte détenu par Tara, et Tara ne conserve aucun fonds.
      </P>
      <P>
        Avant de payer, l&apos;acheteuse est invitée à vérifier le numéro affiché
        et à conserver le message de confirmation de son opérateur. C&apos;est sa
        seule preuve de paiement.
      </P>

      <H2>4. Abonnement de la vendeuse</H2>
      <P>
        La création d&apos;une boutique est gratuite jusqu&apos;à 10 articles.
        Au-delà, un abonnement de 3 000 F CFA par mois et par boutique est
        nécessaire. Tara ne prélève <b>aucune commission</b> sur les ventes.
      </P>
      <P>
        L&apos;abonnement est payé d&apos;avance et n&apos;est pas remboursable
        au prorata en cas d&apos;arrêt en cours de mois. À l&apos;expiration, la
        boutique repasse au palier gratuit : les articles au-delà du dixième ne
        sont plus visibles, mais rien n&apos;est supprimé.
      </P>

      <H2>5. Obligations de la vendeuse</H2>
      <Ul>
        <li>ne proposer que des articles dont elle a le droit de disposer ;</li>
        <li>afficher des prix exacts, en francs CFA, toutes taxes comprises ;</li>
        <li>répondre aux commandes reçues et honorer celles qu&apos;elle accepte ;</li>
        <li>
          ne pas publier de contenu illicite, contrefait, dangereux, ni d&apos;article
          dont la vente est réglementée ou interdite au Cameroun (médicaments,
          armes, espèces protégées, produits volés, notamment) ;
        </li>
        <li>
          respecter ses propres obligations fiscales et déclaratives, dont elle
          est seule responsable.
        </li>
      </Ul>

      <H2>6. Suspension</H2>
      <P>
        Tara peut suspendre une boutique qui enfreint ces conditions, sans
        préavis en cas de contenu manifestement illicite, et sans que cela ouvre
        droit à indemnité. L&apos;abonnement en cours n&apos;est pas remboursé si
        la suspension résulte d&apos;un manquement.
      </P>

      <H2>7. Disponibilité</H2>
      <P>
        Tara est fourni en l&apos;état, sans garantie de disponibilité
        ininterrompue. Une interruption de service ne donne pas lieu à
        indemnisation ; elle peut donner lieu, à la demande de la vendeuse, à une
        prolongation de son abonnement d&apos;une durée équivalente.
      </P>

      <H2>8. Droit applicable</H2>
      <P>
        Les présentes conditions sont régies par le droit camerounais. À défaut
        de règlement amiable, le litige relève des juridictions compétentes de{" "}
        <Todo>ville du siège</Todo>.
      </P>

      <H2>9. Contact</H2>
      <P>
        Pour toute question : <Todo>adresse de contact</Todo>.
      </P>
    </LegalPage>
  );
}
