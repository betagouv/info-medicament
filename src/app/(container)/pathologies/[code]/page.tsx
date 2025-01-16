import { pdbmMySQL } from "@/db/pdbmMySQL";
import DefinitionBanner from "@/components/DefinitionBanner";
import { notFound } from "next/navigation";
import { Patho, Specialite } from "@/db/pdbmMySQL/types";
import { groupSpecialites } from "@/displayUtils";
import { fr } from "@codegouvfr/react-dsfr";
import { MedGroupSpecListList } from "@/components/MedGroupSpecList";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { getPathologyDefinition } from "@/data/pathologies";

export const dynamic = "error";
export const dynamicParams = true;

async function getPatho(code: string): Promise<Patho> {
  const patho = await pdbmMySQL
    .selectFrom("Patho")
    .selectAll()
    .where("codePatho", "=", code)
    .executeTakeFirst();

  if (!patho) return notFound();

  return patho;
}

async function getPathoSpecialites(code: `${number}`): Promise<Specialite[]> {
  return pdbmMySQL
    .selectFrom("Specialite")
    .selectAll("Specialite")
    .leftJoin("Spec_Patho", "Specialite.SpecId", "Spec_Patho.SpecId")
    .where("Spec_Patho.codePatho", "=", code)
    .execute();
}

export default async function Page(props: {
  params: Promise<{ code: `${number}` }>;
}) {
  const { code } = await props.params;

  const patho = await getPatho(code);
  const definition = await getPathologyDefinition(code);
  const specialites = await getPathoSpecialites(code);
  const medicaments = groupSpecialites(specialites);
  return (
    <>
      <Breadcrumb
        segments={[
          { label: "Accueil", linkProps: { href: "/" } },
          {
            label: "Listes des pathologies",
            linkProps: {
              href: `/pathologies/${patho.NomPatho.slice(0, 1)}`,
            },
          },
        ]}
        currentPageLabel={patho.NomPatho}
      />
      <DefinitionBanner
        type="Pathologie"
        title={patho.NomPatho}
        definition={definition}
      />

      <h2 className={fr.cx("fr-h6", "fr-mt-4w")}>
        {medicaments.length} médicaments traitant la pathologie «&nbsp;
        {patho.NomPatho}&nbsp;»
      </h2>
      <MedGroupSpecListList items={medicaments} />
    </>
  );
}
