import { Expression, expressionBuilder, SqlBool } from "kysely";
import { PdbmMySQL, Specialite, SubstanceNom } from "@/db/pdbmMySQL/types";
import { pdbmMySQL } from "@/db/pdbmMySQL";
import { notFound } from "next/navigation";
import liste_CIS_MVP from "@/liste_CIS_MVP.json";
import { NextResponse } from "next/server";

const dynamic = "error";
const dynamicParams = true;

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
    .where("Specialite.SpecId", "in", liste_CIS_MVP)
    .groupBy("Specialite.SpecId")
    .execute();

  return {
    substances: await Promise.all(
      substances.map(async (substance) => ({
        ...substance,
        others: await pdbmMySQL
          .selectFrom("Subs_Nom")
          .where("SubsId", "=", substance.SubsId)
          .where("NomId", "!=", substance.NomId)
          .selectAll()
          .execute(),
      })),
    ),
    specialites,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ids = decodeURIComponent(id).split(",");
  const { substances, specialites } = await getSubstance(ids);

  return NextResponse.json({
    substances: substances.map((substance) => ({
      id: substance.SubsId.trim(),
      idNom: substance.NomId.trim(),
      nom: substance.NomLib.trim(),
      noms: substance.others.map((other) => ({
        idNom: other.NomId.trim(),
        nom: other.NomLib.trim(),
      })),
    })),
    specialites: specialites.map((specialite) => ({
      link: new URL(`/api/specialite/${specialite.SpecId}`, request.url),
      nom: specialite.SpecDenom01.trim(),
    })),
  });
}
