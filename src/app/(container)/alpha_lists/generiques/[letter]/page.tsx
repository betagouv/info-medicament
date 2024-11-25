import { pdbmMySQL } from "@/db/pdbmMySQL";
import liste_CIS_MVP from "@/liste_CIS_MVP.json";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { fr } from "@codegouvfr/react-dsfr";
import AlphabeticNav from "@/components/AlphabeticNav";
import Link from "next/link";
import GenericAccordion from "@/components/GenericAccordion";
import { formatSpecName, groupGeneNameToDCI } from "@/displayUtils";

async function getLetters() {
  return (
    (
      await pdbmMySQL
        .selectFrom("GroupeGene")
        .select(({ fn, val }) =>
          fn<string>("substr", ["GroupeGene.LibLong", val(1), val(1)]).as(
            "letter",
          ),
        )

        // Filter the 500 list
        .leftJoin("Specialite", "GroupeGene.SpecId", "Specialite.SpecId")
        .where("Specialite.SpecId", "in", liste_CIS_MVP)
        .orderBy("letter")
        .groupBy("letter")
        .execute()
    ).map((r) => r.letter)
  );
}

export default async function Page({
  params: { letter },
}: {
  params: { letter: string };
}) {
  const letters = await getLetters();
  const generics = await pdbmMySQL
    .selectFrom("GroupeGene")
    .select(["GroupeGene.LibLong", "GroupeGene.SpecId"])
    .where("GroupeGene.LibLong", "like", `${letter.toUpperCase()}%`)
    // Filter the 500 list
    .leftJoin("Specialite", "GroupeGene.SpecId", "Specialite.SpecGeneId")
    .where("Specialite.SpecId", "in", liste_CIS_MVP)
    .groupBy(["GroupeGene.LibLong", "GroupeGene.SpecId"])
    .execute();

  return (
    <>
      {" "}
      <Breadcrumb
        segments={[{ label: "Accueil", linkProps: { href: "/" } }]}
        currentPageLabel="Liste des groupes génériques"
      />
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-md-8")}>
          <h1 className={fr.cx("fr-h1", "fr-mb-8w")}>
            Liste des groupes génériques
          </h1>
          <GenericAccordion />
          <AlphabeticNav
            letters={letters}
            url={(letter) => `/generiques/${letter}`}
          />
          <ul className={fr.cx("fr-raw-list")}>
            {generics.map((g, i) => (
              <li key={i} className={fr.cx("fr-mb-1v")}>
                <Link
                  href={`/generiques/${g.SpecId}`}
                  className={fr.cx("fr-link")}
                >
                  {formatSpecName(groupGeneNameToDCI(g.LibLong))}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}