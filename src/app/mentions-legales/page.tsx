import type { Metadata } from "next";
import LegalPage, { H2, P, Todo } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Mentions légales — Tara",
  description: "Éditeur, hébergeur et contact du site tara.shop.",
};

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales" updated="27 août 2026">
      <H2>Éditeur du site</H2>
      <P>
        Dénomination : <Todo>raison sociale ou nom de l&apos;exploitant</Todo>
        <br />
        Forme juridique : <Todo>établissement, SARL, SA…</Todo>
        <br />
        Siège : <Todo>adresse complète</Todo>
        <br />
        Registre du commerce (RCCM) : <Todo>numéro RCCM</Todo>
        <br />
        Numéro de contribuable : <Todo>NIU</Todo>
        <br />
        Directeur de la publication : <Todo>nom</Todo>
        <br />
        Contact : <Todo>adresse e-mail et téléphone</Todo>
      </P>

      <H2>Hébergement</H2>
      <P>
        Le site est hébergé par <Todo>nom et adresse de l&apos;hébergeur</Todo>.
      </P>

      <H2>Nature du service</H2>
      <P>
        Tara met à disposition des vendeuses un outil de présentation
        d&apos;articles et de mise en relation avec leurs clientes. Tara
        n&apos;est pas partie aux ventes conclues par leur intermédiaire, ne
        détient aucun fonds et n&apos;exerce aucune activité de paiement ou
        d&apos;intermédiation financière. Les paiements s&apos;effectuent
        directement entre l&apos;acheteuse et la vendeuse, par Mobile Money.
      </P>

      <H2>Propriété intellectuelle</H2>
      <P>
        La marque, le nom de domaine, l&apos;interface et le code du service
        appartiennent à leur éditeur. Les photographies, descriptions et noms
        d&apos;articles restent la propriété des vendeuses qui les publient et
        engagent leur seule responsabilité.
      </P>

      <H2>Signalement d&apos;un contenu</H2>
      <P>
        Un contenu illicite ou contrefait peut être signalé à{" "}
        <Todo>adresse de signalement</Todo>. Le signalement doit préciser
        l&apos;adresse de la page concernée et le motif. Les contenus
        manifestement illicites sont retirés sans délai.
      </P>
    </LegalPage>
  );
}
