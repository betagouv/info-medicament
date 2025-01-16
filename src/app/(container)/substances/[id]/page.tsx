import React from "react";
import { fr } from "@codegouvfr/react-dsfr";

import { pdbmMySQL } from "@/db/pdbmMySQL";
import { groupSpecialites } from "@/displayUtils";
import { PdbmMySQL, Specialite, SubstanceNom } from "@/db/pdbmMySQL/types";
import { notFound } from "next/navigation";
import { MedGroupSpecListList } from "@/components/MedGroupSpecList";
import { Expression, expressionBuilder, SqlBool } from "kysely";
import { getGristTableData } from "@/data/grist";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import DefinitionBanner from "@/components/DefinitionBanner";

export const dynamic = "error";
export const dynamicParams = true;

function withSubstances(
  specId: Expression<string>,
  nomIds: string[],
): Expression<SqlBool> {
  const eb = expressionBuilder<PdbmMySQL, never>();

  return eb.exists(
    eb
      .selectFrom("Composant")
      .select("Composant.SpecId")
      .where("Composant.NomId", "in", nomIds)
      .where("Composant.SpecId", "=", specId)
      .where(({ eb, selectFrom }) =>
        eb(
          "Composant.SpecId",
          "not in",
          selectFrom("Composant as subquery")
            .select("SpecId")
            .where("subquery.NomId", "not in", nomIds)
            .whereRef(
              "subquery.CompNum",
              "not in",
              selectFrom("Composant as subquery2")
                .select("CompNum")
                .where("subquery2.SpecId", "=", specId)
                .where("subquery2.NomId", "in", nomIds),
            ),
        ),
      )
      .groupBy("Composant.SpecId")
      .having((eb) =>
        eb(
          eb.fn.count("Composant.CompNum").distinct(),
          "=",
          eb.val(nomIds.length),
        ),
      ),
  );
}

async function getSubstance(ids: string[]) {
  const substances: SubstanceNom[] | undefined = await pdbmMySQL
    .selectFrom("Subs_Nom")
    .where("NomId", "in", ids)
    .selectAll()
    .execute();

  if (!substances || substances.length < ids.length) return notFound();

  const specialites: Specialite[] = await pdbmMySQL
    .selectFrom("Specialite")
    .selectAll("Specialite")
    .where((eb) => withSubstances(eb.ref("Specialite.SpecId"), ids))
    .groupBy("Specialite.SpecId")
    .execute();

  const definitions = (
    await getGristTableData("Definitions_Substances_Actives", [
      "NomId",
      "SA",
      "Definition",
    ])
  ).filter((d) => ids.includes(d.fields.NomId as string)) as {
    fields: { NomId: string; SA: string; Definition: string };
  }[];

  return {
    substances,
    specialites,
    definitions,
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const ids = decodeURIComponent(id).split(",");
  const { substances, specialites, definitions } = await getSubstance(ids);
  const specialitiesGroups = groupSpecialites(specialites);

  return (
    <div className={fr.cx("fr-grid-row")}>
      <div className={fr.cx("fr-col-md-8")}>
        <Breadcrumb
          segments={[
            { label: "Accueil", linkProps: { href: "/" } },
            {
              label: "Listes des substances",
              linkProps: {
                href: `/substances/${substances[0].NomLib.slice(0, 1)}`,
              },
            },
          ]}
          currentPageLabel={substances.map((s) => s.NomLib).join(", ")}
        />
        <DefinitionBanner
          type={`Substance${ids.length > 1 ? "s" : ""} active${ids.length > 1 ? "s" : ""}`}
          title={substances.map((s) => s.NomLib).join(", ")}
          definition={definitions.map((d) => ({
            title: d.fields.SA,
            desc: d.fields.Definition,
          }))}
        />

        <h2 className={fr.cx("fr-h3", "fr-mt-4w")}>
          {specialitiesGroups.length} médicaments contenant{" "}
          {substances.length < 2
            ? `uniquement la substance « ${substances[0].NomLib} »`
            : `les substances « ${substances.map((s) => s.NomLib).join(", ")} »`}
        </h2>
        <MedGroupSpecListList items={specialitiesGroups} />
      </div>
    </div>
  );
}
